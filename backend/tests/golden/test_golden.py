"""Replay the recorded requests and compare every number with the saved snapshot.

A failure here means a computed value moved: a code change or a library upgrade. See README.md for
what to do. Snapshots are rewritten only by ``make_golden.py --update``.
"""
import json
import math

import pytest

import make_golden as golden

REL_TOL, ABS_TOL = 1e-12, 1e-14
MAX_REPORTED = 15


def differences(expected, actual, path="$") -> list[str]:
    """Where ``actual`` departs from ``expected``: structure and strings exactly, floats within tolerance."""
    if isinstance(expected, bool) or isinstance(actual, bool):
        return [] if expected is actual else [f"{path}: expected {expected!r}, got {actual!r}"]
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        if math.isnan(expected) and math.isnan(actual):
            return []
        if math.isclose(expected, actual, rel_tol=REL_TOL, abs_tol=ABS_TOL):
            return []
        return [f"{path}: expected {expected!r}, got {actual!r}"]
    if isinstance(expected, dict) and isinstance(actual, dict):
        found = []
        for key in sorted(set(expected) | set(actual)):
            if key not in actual:
                found.append(f"{path}.{key}: missing in the new result")
            elif key not in expected:
                found.append(f"{path}.{key}: not in the snapshot")
            else:
                found += differences(expected[key], actual[key], f"{path}.{key}")
        return found
    if isinstance(expected, list) and isinstance(actual, list):
        if len(expected) != len(actual):
            return [f"{path}: expected {len(expected)} items, got {len(actual)}"]
        found = []
        for index, (e, a) in enumerate(zip(expected, actual)):
            found += differences(e, a, f"{path}[{index}]")
        return found
    if type(expected) is type(actual) and expected == actual:
        return []
    return [f"{path}: expected {expected!r}, got {actual!r}"]


@pytest.fixture(scope="module")
def replay():
    client = golden.make_client()
    sessions = golden.upload_datasets(client)
    return lambda case: golden.run_case(client, sessions, case)


CASES = golden.build_cases()


@pytest.mark.parametrize("case", CASES, ids=[case.name for case in CASES])
def test_snapshot_still_matches(case, replay):
    path = golden.SNAPSHOTS / f"{case.name}.json"
    assert path.exists(), f"no snapshot for {case.name}: run make_golden.py --update"
    expected = json.loads(path.read_text(encoding="utf-8"))
    actual = json.loads(golden.to_text(replay(case)))  # the same round trip the file went through
    found = differences(expected, actual)
    shown = "\n  ".join(found[:MAX_REPORTED])
    more = f"\n  ... and {len(found) - MAX_REPORTED} more" if len(found) > MAX_REPORTED else ""
    assert not found, f"{case.name}: {len(found)} difference(s)\n  {shown}{more}"


def test_no_snapshot_is_left_without_a_request():
    recorded = {path.stem for path in golden.SNAPSHOTS.glob("*.json")}
    assert recorded == {case.name for case in CASES}


def test_the_comparison_reports_where_a_number_moved():
    old = {"a": [1.0, {"b": 2.0}], "s": "x", "n": float("nan")}
    assert differences(old, {"a": [1.0, {"b": 2.0 * (1 + 1e-13)}], "s": "x", "n": float("nan")}) == []
    new = {"a": [1.0, {"b": 2.0 * (1 + 1e-9)}], "s": "y", "extra": 1, "n": float("nan")}
    found = differences(old, new)
    assert any(line.startswith("$.a[1].b: expected 2.0") for line in found)
    assert any(line.startswith("$.s:") for line in found)
    assert "$.extra: not in the snapshot" in found
    assert differences([1, 2], [1]) == ["$: expected 2 items, got 1"]
