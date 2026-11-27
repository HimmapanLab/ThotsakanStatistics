# Load drill: a class on one server

Can one backend (one uvicorn worker, as it must run) serve a class of 60 students at once? Measured on 28 November 2026 with `backend/loadtest/locustfile.py`.

## How it was run

- **Scenario.** Each simulated student uploads the example dataset once, then keeps changing settings with a 2–5 s pause, as the debounced UI does: Descriptive 3 in 10 requests, Graphical 2, Inference CI 2, **bootstrap CI (mean, median and deviation, B = 1000) 2**, one-sample Hypothesis 1. A 404 (session lost) is answered as the UI answers it: upload again and continue.
- **Backend.** `feat/backend-logging` (request limits, session owners, logging), installed from `requirements.lock`, `AUTH_DISABLED=true`, `--no-access-log`. Latencies below come from the backend's own JSON request log, except where the bootstrap and plain CI are split (locust's numbers; same path).
- **Machine.** A laptop (Intel Core i5-13420H, 16 GB, about 1.5 GB free) running both the backend and locust. The real server will do better; treat these as a lower bound.

## Results

| Drill | Data | Students, length | Requests | Errors | Result |
|---|---|---|---|---|---|
| Lecture | Howell (544 rows) | 60, about 9 min | 8 814 | 0 | Pass |
| Heavy | Electricity (17 518 rows) | 60, 2 min | 859 | 0 | **Bootstrap fails the target** |
| Restart | Howell | 60, 2 min, backend killed at 1 min, back 7 s later | 1 814 | 0 after restart | Pass |

Latency in milliseconds:

| Request | Lecture p50 / p95 / p99 | Heavy p50 / p95 / p99 |
|---|---|---|
| Upload | 6 / 27 / 33 | 35 / 40 / 40 |
| Descriptive | 10 / 25 / 39 | 12 / 34 / 1 619 |
| Graphical | 4 / 11 / 22 | 64 / 1 084 / 1 918 |
| Hypothesis | 6 / 12 / 19 | 6 / 15 / 1 350 |
| Inference CI | 8 / 17 / 29 | 7 / 600 / 1 700 |
| **Bootstrap CI, B = 1000** | **170 / 3 800 / 7 100** | **29 000 / 30 000 / 30 000** |

- **Lecture:** everything but bootstrap stays under 40 ms at p99 while bootstraps run. Bootstrap meets the proposed p95 ≤ 5 s, but p99 is 7 s.
- **Heavy:** one bootstrap of the Electricity data is about 1 s of CPU (three statistics × 1000 resamples × 17 518 values), and the single worker finishes about one per second. Sixty students asking for one every few seconds queue up until about 30 are waiting, so each waits about 30 s. Other requests stay fast (Descriptive p95 34 ms), because they are served between the bootstrap loops.
- **Restart:** while the backend was down for 7 s, 57 requests could not connect (the UI shows its "server unreachable" message). After the restart every student got a 404, uploaded again (60 uploads) and carried on. There were no 5xx responses and no errors afterwards; p95 was under 0.5 s.

## What this means

The server holds a class of 60 on the small datasets, survives a restart, and never lets a slow bootstrap block the other pages. **Bootstrap on a dataset the size of Electricity does not scale to a class**: its throughput is about one per second per server, whatever the number of students.

Options, best first (decisions for Irving, since they touch `core/` or the limits):

1. **Vectorise the bootstrap in `core/`.** The four bootstrap functions (`ci_mean.py`, `ci_median.py`, `ci_deviation.py`, `pi_bootstrap.py`) draw one resample at a time in a Python loop. Drawing all B resamples as one `(B, n)` array is typically 10–50× faster. The same change can take a seeded `numpy.random.Generator`, which the golden tests need and CONTRIBUTING asks for.
2. **Lower the work budget** (`MAX_BOOTSTRAP_DRAWS` in `services/inference.py`, now 100 million per statistic). This shortens each request but not the queue.
3. **More CPU per server.** More uvicorn workers would need a shared session store (sessions are in memory), so this is the most work.

## Run it again

```bash
cd backend
uv venv .venv-load --python 3.12 && VIRTUAL_ENV=.venv-load uv pip install -r requirements-load.txt
AUTH_DISABLED=true uvicorn main:app --port 8765 --no-access-log &        # from requirements.lock
DATASET=Howell.csv COLUMN=height .venv-load/bin/locust -f loadtest/locustfile.py --headless \
    -u 60 -r 2 -t 10m --host http://127.0.0.1:8765 --csv drill
```

Run locust on another machine than the backend for numbers closer to the real server.
