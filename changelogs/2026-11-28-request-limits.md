# 2026-11-28 — One request cannot stall the server

The backend runs one worker, so a single slow request makes everyone wait. Measured on a laptop, a bootstrap costs about 1 s per 50 million values drawn: B = 10 000 on the Electricity data (17 518 rows) took 10 s, and the API accepted any B.

- **Bootstrap:** B must be between 1 and 10 000, and B × n at most 100 million per resampled statistic (about 2 s). The 400 message says the largest B that fits the data. The UI slider (100–5000) fits every example dataset. Both numbers are constants in `services/inference.py` for Irving to set.
- **Request fields:** inference α in (0, 1), trim in (0, 0.5), 1–50 confidence-region coverages each in (0, 1), at most 99 descriptive quantiles each in [0, 1]; normal-PDF σ > 0, n ≥ 1, α in (0, 1). Out of range is a 422.
- **Probability:** a missing distribution parameter is a 400 naming it, not a 500.
- **Errors:** Descriptive and Probability no longer put the exception text in a 500 response.
- **Upload:** a declared size over `MAX_UPLOAD_MB` is refused before reading; otherwise the file is read in 1 MB chunks and refused as soon as it passes the limit; the CSV is parsed off the event loop.

Not changed: an out-of-range distribution parameter (σ = −1) still returns numbers instead of an error. The UI never sends one; validating each distribution's parameter space is a separate change for Irving.

Tests: `backend/tests/api/test_limits.py`.
