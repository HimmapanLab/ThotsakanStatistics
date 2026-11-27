# 2026-11-28 — Security headers and a warning for an insecure cookie

- **nginx** now sends `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` that turns off camera, microphone, location, payment and USB, and a Content-Security-Policy that allows only this site, Google sign-in and Google Fonts. The CSP is **report-only** for now: once a browser session (sign-in, every page, the exports) shows no CSP violations in the console, rename the header to `Content-Security-Policy`. `/assets/` repeats the headers, because nginx drops inherited headers in a location with its own `add_header`.
- **Body size:** analysis requests are limited to 1 MB; only `/api/data/upload` takes `CLIENT_MAX_BODY_SIZE` (100 MB by default). Before, every request could send 100 MB.
- **Cookie:** `docker-compose.yml` defaults `AUTH_COOKIE_SECURE` to `true` (`.env.example` still sets `false` for local runs, and browsers accept secure cookies on `http://localhost`). The backend logs a warning at startup when sign-in is on and the cookie is not HTTPS-only.
- **CI:** the Docker smoke test checks the headers on `/` and on an `/assets/` file, and that a 2 MB JSON body gets 413.

For Win: HSTS belongs on the HTTPS proxy in front of this server, and the server's own `/opt/thotsakan/.env` should have `AUTH_COOKIE_SECURE=true` once it is served over HTTPS.

Tests: `backend/tests/test_production_guards.py`; header checks in `.github/workflows/docker.yml`.
