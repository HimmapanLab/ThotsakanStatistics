"""Golden snapshots of the API: record what every analysis endpoint returns for fixed requests.

Run from ``backend/`` with the locked environment (see README.md):

    AUTH_DISABLED=true .venv-lock/Scripts/python tests/golden/make_golden.py            # show what would change
    AUTH_DISABLED=true .venv-lock/Scripts/python tests/golden/make_golden.py --update   # write the snapshots

``test_golden.py`` replays the same requests (``build_cases``) and compares with the saved files.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent.parent
sys.path.insert(0, str(BACKEND))  # api, core, main ...

from fastapi.testclient import TestClient  # noqa: E402

from api.deps import require_user  # noqa: E402
from main import app  # noqa: E402
from services.auth import User  # noqa: E402

SNAPSHOTS = HERE / "snapshots"
DATASETS = BACKEND.parent / "frontend" / "public" / "datasets"  # public example data

# dataset key -> (file, numeric columns, mu0 for each column)
# Two numeric columns per dataset. mu0 is a round number near the sample mean, fixed once so the
# one-sample test stays the same request forever (it is not a recommended hypothesis).
DATASET_COLUMNS: dict[str, tuple[str, dict[str, float]]] = {
    "howell": ("Howell.csv", {"height": 140.0, "weight": 35.0}),
    "whr": ("WHR_2023_all_years_processed.csv", {"Life Ladder": 5.5, "Healthy life expectancy at birth": 63.0}),
    "electricity": ("ElectricityDemand.csv", {"Demand": 4600.0, "Temperature": 16.5}),
}

# Regions: the Inference tab's default coverage levels (useInferenceTabState.ts, crProbs). Each response
# holds a 100 x 100 grid (about 0.85 MB), so only a small and a large dataset are recorded.
REGION_PROBS = [0.1, 0.5, 0.75, 0.89, 0.95]
REGIONS_FOR = {("howell", "height"), ("electricity", "Demand")}

# The 12 distributions of the Probability tab with their default parameters (copied from
# DISTRIBUTIONS in frontend/src/hooks/useDistribution.ts on 2026-11-28) and one query each:
# P(X <= k) with k a round number near the distribution's mean.
DISTRIBUTIONS: dict[str, tuple[dict[str, float], float]] = {
    "Poisson": ({"lambda": 5}, 5),
    "Binomial": ({"n": 20, "p": 0.5}, 10),
    "Geometric": ({"p": 0.3}, 3),
    "Negative Binomial": ({"r": 5, "p": 0.5}, 5),
    "Hypergeometric": ({"N": 50, "K": 20, "n": 10}, 4),
    "Normal": ({"mu": 0, "sigma": 1}, 0),
    "Exponential": ({"lambda": 1}, 1),
    "Uniform": ({"a": 0, "b": 1}, 0.5),
    "Gamma": ({"alpha": 2, "beta": 1}, 2),
    "Beta": ({"alpha": 2, "beta": 5}, 0.3),
    "Chi-squared": ({"k": 3}, 3),
    "Student's t": ({"nu": 5}, 0),
}

ONE_SAMPLE_T = "One sample Student's t-test"  # api/schemas/hypothesis.py


@dataclass(frozen=True)
class Case:
    name: str             # the snapshot's file name, without .json
    dataset: str | None   # key of DATASET_COLUMNS; None for endpoints without data
    endpoint: str
    payload: dict         # the request body; session_id is added when the case runs


def _slug(text: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "-" for ch in text).strip("-")


def build_cases() -> list[Case]:
    cases: list[Case] = []
    for key, (_, columns) in DATASET_COLUMNS.items():
        for column, mu0 in columns.items():
            base = f"{key}__{_slug(column)}"
            if (key, column) in REGIONS_FOR:
                cases.append(Case(f"{base}__regions", key, "/api/inference/regions",
                                  {"column": column, "probs": REGION_PROBS}))
            cases += [
                Case(f"{base}__descriptive", key, "/api/descriptive/compute", {"column": column}),
                Case(f"{base}__graphical-histogram", key, "/api/graphical/compute", {"column": column}),
                Case(f"{base}__estimators", key, "/api/inference/estimators", {"column": column}),
                Case(f"{base}__ci", key, "/api/inference/ci", {"column": column}),
                Case(f"{base}__pi", key, "/api/inference/pi", {"column": column}),
                Case(f"{base}__hypothesis-one-sample", key, "/api/hypothesis/test",
                     {"column": column, "test_type": ONE_SAMPLE_T, "mu0": mu0}),
            ]
    # The ECDF (with its confidence band) has one point per row, so it is recorded for the smallest dataset only.
    cases.append(Case("howell__height__graphical-ecdf", "howell", "/api/graphical/compute",
                      {"column": "height", "graph_type": "ECDF"}))
    for dist, (params, k) in DISTRIBUTIONS.items():
        cases.append(Case(f"probability__{_slug(dist)}", None, "/api/probability/compute",
                          {"distName": dist, "params": params, "queryOp": "<=", "queryK": k}))
    return cases


def make_client() -> TestClient:
    app.dependency_overrides.setdefault(require_user, lambda: User(email="tester@cmkl.ac.th"))
    return TestClient(app)


def upload_datasets(client: TestClient) -> dict[str, str]:
    """Upload each example dataset the way the Data tab does; returns dataset key -> session id."""
    sessions = {}
    for key, (filename, _) in DATASET_COLUMNS.items():
        content = (DATASETS / filename).read_bytes()
        response = client.post("/api/data/upload", files={"file": (filename, content, "text/csv")})
        assert response.status_code == 200, response.text
        sessions[key] = response.json()["session_id"]
    return sessions


def _expand_tables(value):
    """Endpoints return their result table as a JSON string; store it as the JSON it holds."""
    if isinstance(value, dict):
        return {k: json.loads(v) if k == "table" and isinstance(v, str) else _expand_tables(v)
                for k, v in value.items()}
    return value


def run_case(client: TestClient, sessions: dict[str, str], case: Case) -> dict:
    """Send the case's request; returns the snapshot document (request without session id, response)."""
    payload, headers = dict(case.payload), {}
    if case.dataset is not None:
        payload["session_id"] = sessions[case.dataset]
        headers["x-session-id"] = sessions[case.dataset]
    response = client.post(case.endpoint, json=payload, headers=headers)
    assert response.status_code == 200, f"{case.name}: {response.status_code} {response.text}"
    return {
        "endpoint": case.endpoint,
        "dataset": DATASET_COLUMNS[case.dataset][0] if case.dataset else None,
        "request": case.payload,
        "response": _expand_tables(response.json()),
    }


def _dump(value, indent: int = 0) -> str:
    """JSON with one key per line; a list of numbers (or each row of a matrix) takes one line.

    Floats are written with repr, which round-trips every double, so nothing is rounded.
    """
    pad = " " * (indent + 1)
    if isinstance(value, dict) and value:
        body = ",\n".join(f"{pad}{json.dumps(k, ensure_ascii=False)}: {_dump(v, indent + 1)}"
                          for k, v in value.items())
        return "{\n" + body + "\n" + " " * indent + "}"
    if isinstance(value, list) and any(isinstance(v, (dict, list)) for v in value):
        return "[\n" + ",\n".join(pad + _dump(v, indent + 1) for v in value) + "\n" + " " * indent + "]"
    return json.dumps(value, ensure_ascii=False, allow_nan=False)


def to_text(snapshot: dict) -> str:
    return _dump(snapshot) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--update", action="store_true", help="write the snapshots (default: only report)")
    update = parser.parse_args().update

    client = make_client()
    sessions = upload_datasets(client)
    wanted = {case.name: to_text(run_case(client, sessions, case)) for case in build_cases()}
    SNAPSHOTS.mkdir(exist_ok=True)
    existing = {path.stem: path for path in SNAPSHOTS.glob("*.json")}

    changes = 0
    for name, text in wanted.items():
        path = SNAPSHOTS / f"{name}.json"
        if name not in existing:
            status = "new"
        elif path.read_text(encoding="utf-8") != text:
            status = "changed"
        else:
            continue
        changes += 1
        print(f"{status:8} {path.name}")
        if update:
            path.write_text(text, encoding="utf-8", newline="\n")
    for name, path in existing.items():
        if name not in wanted:
            changes += 1
            print(f"{'stale':8} {path.name}")
            if update:
                path.unlink()

    total = sum(len(t) for t in wanted.values())
    print(f"{len(wanted)} snapshots, {total / 1e6:.2f} MB; "
          + (f"{changes} written." if update else f"{changes} would change (use --update)."))
    return 0


if __name__ == "__main__":
    sys.exit(main())
