# 2026-11-28 — The backend logs every request, and never any data

The backend had no logging, so an error on the server could only be reproduced, never looked up.

- `backend/logging_setup.py` writes one JSON line per request to stdout (so `docker compose logs backend` shows it): method, path, status, duration, a request ID and a 12-character keyed hash (HMAC with `AUTH_SECRET_KEY`) of the signed-in user's email, so a class roster can't be hashed to find who sent a request. Health checks log at debug level only.
- Every response carries `X-Request-ID`. A student's error can be matched to its log line.
- An unexpected error answers a plain 500 with the request ID, and logs the exception type and the code location (file, line, function). Never the exception's message: pandas messages can quote cell values.
- Nothing about the data is logged: no bodies, file names, column names, values, session IDs or emails. uvicorn's own access log is off in the image.

Tests: `backend/tests/api/test_logging.py`, including an upload whose marker value must never appear in the log.
