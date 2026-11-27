"""Every request is logged as one JSON line, and no log line ever carries data."""

import json
import logging

import pytest
from fastapi.testclient import TestClient

from logging_setup import logger, user_tag
from main import app
from sessions.store import set_session

client = TestClient(app)
MARKER = "Zanzibar-7731"  # a value that only exists inside the uploaded data


class Capture(logging.Handler):
    def __init__(self):
        super().__init__(level=logging.DEBUG)
        self.lines: list[str] = []

    def emit(self, record):
        self.lines.append(self.format(record))


@pytest.fixture
def log():
    from logging_setup import JsonFormatter

    capture = Capture()
    capture.setFormatter(JsonFormatter())
    logger.addHandler(capture)
    yield capture
    logger.removeHandler(capture)


def test_a_request_is_one_json_line_with_its_id(log):
    response = client.get("/api/auth/config")
    entries = [json.loads(line) for line in log.lines if '"path": "/api/auth/config"' in line]
    assert len(entries) == 1
    entry = entries[0]
    assert entry["method"] == "GET" and entry["status"] == 200 and entry["duration_ms"] >= 0
    assert response.headers["X-Request-ID"] == entry["request_id"]


def test_a_well_formed_incoming_request_id_is_kept_and_a_bad_one_replaced():
    assert client.get("/api/health", headers={"X-Request-ID": "abc-123"}).headers["X-Request-ID"] == "abc-123"
    replaced = client.get("/api/health", headers={"X-Request-ID": "bad id\n{json}"}).headers["X-Request-ID"]
    assert replaced != "bad id\n{json}" and len(replaced) == 16


def test_uploaded_data_never_reaches_the_log(log):
    csv = f"name,score\n{MARKER},1\nb,2\nc,3\n"
    upload = client.post("/api/data/upload", files={"file": (f"{MARKER}.csv", csv.encode(), "text/csv")})
    assert upload.status_code == 200
    session = upload.json()["session_id"]
    client.post("/api/descriptive/compute", json={"session_id": session, "column": "name"},
                headers={"x-session-id": session})  # a text column: fails with the values in hand
    assert log.lines
    assert not any(MARKER in line for line in log.lines)
    assert not any(session in line for line in log.lines)


def test_an_unexpected_error_logs_where_but_not_its_message(log, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError(f"could not convert string '{MARKER}' to float")

    monkeypatch.setattr("api.routes.descriptive.calculate_descriptive", boom)
    set_session("logging-session", __import__("pandas").DataFrame({"x": [1.0, 2.0, 3.0]}))
    response = client.post("/api/descriptive/compute", json={"session_id": "logging-session", "column": "x"},
                           headers={"x-session-id": "logging-session"})
    assert response.status_code == 500
    body = response.json()
    assert MARKER not in response.text and body["request_id"] == response.headers["X-Request-ID"]

    error = json.loads(next(line for line in log.lines if '"unexpected error"' in line))
    assert error["error"] == "RuntimeError" and error["request_id"] == body["request_id"]
    assert any("in boom" in frame for frame in error["where"])
    assert not any(MARKER in line for line in log.lines)


def test_users_are_told_apart_by_a_hash_not_their_email():
    tag = user_tag("alice@cmkl.ac.th")
    assert tag and "alice" not in tag and tag == user_tag("alice@cmkl.ac.th") != user_tag("bob@cmkl.ac.th")


def test_the_tag_cannot_be_found_by_hashing_a_roster():
    import hashlib

    email = "alice@cmkl.ac.th"
    assert user_tag(email) != hashlib.sha256(email.encode()).hexdigest()[:12]
