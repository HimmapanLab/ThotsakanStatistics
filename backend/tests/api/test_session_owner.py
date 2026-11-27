"""A dataset session belongs to the person who uploaded it (roadmap known issue #4)."""

import pytest
from fastapi.testclient import TestClient

from api.deps import require_user
from main import app
from services.auth import User
from sessions.store import get_session

client = TestClient(app)
ALICE, BOB = User(email="alice@cmkl.ac.th"), User(email="bob@cmkl.ac.th")


def act_as(user: User):
    app.dependency_overrides[require_user] = lambda: user


def upload_as(user: User) -> str:
    act_as(user)
    csv = "x,g\n" + "".join(f"{i},{'ab'[i % 2]}\n" for i in range(20))
    response = client.post("/api/data/upload", files={"file": ("data.csv", csv.encode(), "text/csv")})
    assert response.status_code == 200, response.text
    return response.json()["session_id"]


def describe(session_id: str):
    return client.post("/api/descriptive/compute", json={"session_id": session_id, "column": "x"},
                       headers={"x-session-id": session_id})


def test_the_uploader_owns_the_session():
    session_id = upload_as(ALICE)
    assert get_session(session_id, ALICE.email) is not None
    assert describe(session_id).status_code == 200


def test_someone_else_gets_not_found_for_the_same_session_id():
    session_id = upload_as(ALICE)
    act_as(BOB)
    response = describe(session_id)
    # 404, the same as an expired session: the id reveals nothing, and the UI uploads again.
    assert response.status_code == 404
    assert get_session(session_id, BOB.email) is None


@pytest.mark.parametrize("endpoint,body", [
    ("/api/graphical/compute", {"column": "x"}),
    ("/api/inference/ci", {"column": "x"}),
    ("/api/hypothesis/test", {"column": "x", "test_type": "One sample Student's t-test", "mu0": 0}),
])
def test_every_analysis_checks_the_owner(endpoint, body):
    session_id = upload_as(ALICE)
    act_as(BOB)
    response = client.post(endpoint, json={"session_id": session_id, **body}, headers={"x-session-id": session_id})
    assert response.status_code == 404


def test_another_persons_look_does_not_keep_the_session_alive():
    session_id = upload_as(ALICE)
    from sessions import store
    before = store._session_store[session_id]["last_accessed"]
    act_as(BOB)
    describe(session_id)
    assert store._session_store[session_id]["last_accessed"] == before
