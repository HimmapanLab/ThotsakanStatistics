# 2026-11-28 — A dataset belongs to the person who uploaded it

Until now, any signed-in user who had a dataset's session ID could read that dataset (roadmap known issue #4). On a shared lab computer a session ID can outlive the person who uploaded the data.

- `sessions/store.py` keeps the uploader's email with each session. `get_session_data` reads the session as the signed-in user; anyone else gets the same 404 as an expired session, so an ID reveals nothing, and the UI uploads the data again as it already does after an expiry.
- A request from someone else doesn't keep the session alive.
- Demo mode has one shared demo user, so nothing changes there.

Tests: `backend/tests/api/test_session_owner.py`.
