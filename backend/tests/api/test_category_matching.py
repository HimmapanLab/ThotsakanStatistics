"""Categories sent by the UI match the rows pandas read, whatever type pandas gave the column.

These go through the real upload, because the bug class lives there: the browser sends the CSV
text ("01", "0.50", "TRUE"), while pandas has already read the column as numbers or True/False.
"""

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def upload(levels: tuple[str, str], extra: str = "") -> str:
    rows = "".join(f"{i % 7 + 3 * (i // 20)},{levels[i // 20]}\n" for i in range(40))
    response = client.post("/api/data/upload", files={"file": ("t.csv", ("y,g\n" + rows + extra).encode(), "text/csv")})
    assert response.status_code == 200, response.text
    return response.json()["session_id"]


CASES = {
    "zero-padded codes": ("01", "02"),
    "decimal levels": ("0.50", "1.50"),
    "Excel TRUE/FALSE": ("TRUE", "FALSE"),
    "Python True/False": ("True", "False"),  # H9: 'False' cast to bool was True
    "lower-case true/false": ("true", "false"),
    "text": ("a", "b"),
}


@pytest.mark.parametrize("levels", CASES.values(), ids=CASES.keys())
def test_two_groups_get_their_own_rows(levels):
    session = upload(levels)
    response = client.post("/api/hypothesis/test", headers={"x-session-id": session}, json=dict(
        session_id=session, column="y", test_type="Two samples Student's t-test",
        group1=dict(column="g", values=[levels[0]], name="A"), group2=dict(column="g", values=[levels[1]], name="B")))
    assert response.status_code == 200, response.text
    body = response.json()
    assert [g["n"] for g in body["group_summary"]] == [20, 20]
    assert body["group_summary"][0]["mean"] != body["group_summary"][1]["mean"]
    assert body["warnings"] == []


def test_a_code_read_as_a_float_after_a_blank_cell_still_matches():
    session = upload(("1", "2"), extra="5,\n")  # the blank makes pandas read g as 1.0, 2.0
    response = client.post("/api/hypothesis/test", headers={"x-session-id": session}, json=dict(
        session_id=session, column="y", test_type="One-way ANOVA", anova_column="g", anova_levels=["1", "2"]))
    assert response.status_code == 200, response.text
    assert sorted(g["n"] for g in response.json()["group_summary"]) == [20, 20]


@pytest.mark.parametrize("levels", CASES.values(), ids=CASES.keys())
def test_a_filter_keeps_exactly_its_rows(levels):
    """Roadmap review item M4: filters on levels like 0.50 or 01 matched 0 rows."""
    session = upload(levels)
    response = client.post("/api/descriptive/compute", headers={"x-session-id": session}, json=dict(
        session_id=session, column="y", filters={"g": [levels[0]]}))
    assert response.status_code == 200, response.text
    assert response.json()["summary"]["n"] == 20
