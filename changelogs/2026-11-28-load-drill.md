# 2026-11-28 — Load drill: 60 students on one server

`backend/loadtest/locustfile.py` simulates a class using the Lab at once; `docs/load-drill.md` has the method and the numbers.

- 60 students on Howell for about 9 minutes: 8 814 requests, no errors; every page but bootstrap under 40 ms at p99; bootstrap (B = 1000) p95 3.8 s.
- A backend restart mid-class: students see 7 s of "server unreachable", then upload again and carry on; no errors afterwards.
- **Finding:** bootstrap on the Electricity data (17 518 rows) takes about 1 s of CPU, and the single worker finishes about one per second, so with 60 students each waits about 30 s. The other pages stay fast. The fix with the most effect is vectorising the bootstrap in `core/` (a decision for Irving).

Locust is pinned in `backend/requirements-load.txt` and is not part of the image or CI.
