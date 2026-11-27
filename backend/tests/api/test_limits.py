"""One request cannot stall the single server worker, and errors never echo internals."""

import asyncio
import io
import time

import numpy as np
import pandas as pd
import pytest
from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient

import services.inference
from api.routes.data import MB, _read_capped
from main import app
from sessions.store import set_session

client = TestClient(app)
SESSION = "limits-session"


@pytest.fixture(autouse=True)
def session():
    set_session(SESSION, pd.DataFrame({"x": np.random.default_rng(3).normal(10, 2, 200)}))


def ci(**body):
    payload = {"session_id": SESSION, "column": "x", **body}
    return client.post("/api/inference/ci", json=payload, headers={"x-session-id": SESSION})


# ── bootstrap work ─────────────────────────────────────────────────────────────

def test_a_huge_bootstrap_is_refused_at_once():
    start = time.perf_counter()
    response = ci(bootstrap_mean=True, bootstrap_samples=10**9)
    assert time.perf_counter() - start < 1.0
    assert response.status_code == 400
    assert "at most 10,000" in response.json()["detail"]


@pytest.mark.parametrize("B", [0, -5])
def test_a_bootstrap_needs_at_least_one_sample(B):
    response = ci(bootstrap_median=True, bootstrap_samples=B)
    assert response.status_code == 400
    assert "at least 1" in response.json()["detail"]


def test_the_work_budget_counts_the_rows_and_names_the_largest_b(monkeypatch):
    monkeypatch.setattr(services.inference, "MAX_BOOTSTRAP_DRAWS", 200 * 500)  # n = 200 rows
    assert ci(bootstrap_mean=True, bootstrap_samples=500).status_code == 200
    response = ci(bootstrap_mean=True, bootstrap_samples=501)
    assert response.status_code == 400
    assert "Use B ≤ 500" in response.json()["detail"]


def test_b_is_not_checked_when_no_bootstrap_is_asked_for():
    assert ci(bootstrap_samples=10**9).status_code == 200


def test_the_ui_range_fits_the_largest_example_dataset():
    # ElectricityDemand.csv has 17 518 rows; the UI slider goes up to 5000.
    services.inference.check_bootstrap_work(5000, 17_518)


# ── request fields ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("probs", [[], [1.5], [0.0], [0.5] * 51])
def test_confidence_region_coverages_are_bounded(probs):
    payload = {"session_id": SESSION, "column": "x", "probs": probs}
    response = client.post("/api/inference/regions", json=payload, headers={"x-session-id": SESSION})
    assert response.status_code == 422


@pytest.mark.parametrize("alpha", [0.0, 1.0, 2.0])
def test_inference_alpha_is_inside_the_unit_interval(alpha):
    assert ci(alpha=alpha).status_code == 422


@pytest.mark.parametrize("quantiles", [[-0.1], [1.2], [0.5] * 100])
def test_descriptive_quantiles_are_bounded(quantiles):
    payload = {"session_id": SESSION, "column": "x", "quantileProbs": quantiles}
    response = client.post("/api/descriptive/compute", json=payload, headers={"x-session-id": SESSION})
    assert response.status_code == 422


@pytest.mark.parametrize("body", [
    dict(mean=0, std=0, n=10, alpha=0.05),
    dict(mean=0, std=1, n=0, alpha=0.05),
    dict(mean=0, std=1, n=10, alpha=2),
])
def test_normal_pdf_parameters_are_checked(body):
    assert client.post("/api/probability/normal-pdf", json=body).status_code == 422


def test_a_missing_distribution_parameter_is_a_client_error():
    body = dict(distName="Binomial", params={"n": 10}, queryOp="<=", queryK=1)
    response = client.post("/api/probability/compute", json=body)
    assert response.status_code == 400
    assert "'p'" in response.json()["detail"]


# ── unexpected errors ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("module,name,url,body", [
    ("api.routes.descriptive", "calculate_descriptive", "/api/descriptive/compute",
     {"session_id": SESSION, "column": "x"}),
    ("api.routes.probability", "compute_distribution_response", "/api/probability/compute",
     dict(distName="Normal", params={"mu": 0, "sigma": 1}, queryOp="<=", queryK=1)),
])
def test_an_unexpected_error_does_not_echo_its_text(monkeypatch, module, name, url, body):
    def boom(*args, **kwargs):
        raise RuntimeError("internal detail /srv/secret")

    monkeypatch.setattr(f"{module}.{name}", boom)
    response = TestClient(app, raise_server_exceptions=False).post(
        url, json=body, headers={"x-session-id": SESSION})
    assert response.status_code == 500
    assert "secret" not in response.text


# ── uploads ───────────────────────────────────────────────────────────────────

def test_an_upload_is_cut_off_once_it_passes_the_limit():
    upload = UploadFile(file=io.BytesIO(b"x" * (3 * MB)), filename="big.csv")
    with pytest.raises(HTTPException) as refused:
        asyncio.run(_read_capped(upload, MB))
    assert refused.value.status_code == 413
    assert upload.file.tell() <= 2 * MB  # stopped reading after the chunk that crossed the limit


def test_an_upload_under_the_limit_is_read_whole():
    upload = UploadFile(file=io.BytesIO(b"x" * (MB + 5)), filename="ok.csv")
    assert len(asyncio.run(_read_capped(upload, 2 * MB))) == MB + 5
