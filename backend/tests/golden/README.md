# Golden snapshots

`snapshots/` holds what the API returned, at full precision, for fixed requests on three public example datasets (`frontend/public/datasets/`): Howell, WHR 2023 and ElectricityDemand. `test_golden.py` replays the same requests and compares every value. Its job is to catch a number that moves without anyone meaning it to: a code change or a library upgrade.

These are not reference values. They record what the app computes today and say nothing about whether it is right; the tests that compare against independent references are elsewhere in `tests/`. The correctness checks against NIST are in `tests/nist/`.

## What is recorded

| Endpoint | Request |
|---|---|
| `/api/descriptive/compute` | defaults, per column |
| `/api/graphical/compute` | defaults (histogram with KDE), per column; plus the ECDF with its band for Howell `height` only (one point per row, so the file is large) |
| `/api/inference/estimators`, `/ci`, `/pi` | defaults (alpha 0.05, sample mean, sample median, s with ddof=1, normal theory), per column |
| `/api/inference/regions` | the Inference tab's default levels (0.1, 0.5, 0.75, 0.89, 0.95); Howell `height` and Electricity `Demand` only (each response is a 100 x 100 grid, about 0.85 MB) |
| `/api/hypothesis/test` | one-sample t-test, two-sided, alpha 0.05, with a fixed `mu0` per column |
| `/api/probability/compute` | each of the 12 distributions at its default parameters, `P(X <= k)` with `k` a round number near the mean |

Columns (two per dataset) and `mu0` (a round number near the sample mean, fixed once; not a recommended hypothesis):

| Dataset | Column: mu0 |
|---|---|
| Howell | `height`: 140, `weight`: 35 |
| WHR 2023 | `Life Ladder`: 5.5, `Healthy life expectancy at birth`: 63 (has missing values) |
| ElectricityDemand | `Demand`: 4600, `Temperature`: 16.5 |

The probability defaults are copied from `DISTRIBUTIONS` in `frontend/src/hooks/useDistribution.ts`; the copy is in `make_golden.py` so a frontend change does not silently change the request.

**Not recorded: bootstrap.** The bootstrap intervals call the global `np.random` with no seed, and the request has no seed field, so two identical requests return different numbers. Recording one would need a change in `core/` (a seed or a generator argument; `CONTRIBUTING.md` already asks for seedable random procedures).

## Notes on what is compared

- Floats: `math.isclose(rel_tol=1e-12, abs_tol=1e-14)`. Strings, keys, list lengths and booleans must be equal. NaN equals NaN.
- `table` fields (the CI, PI, regions and hypothesis tables) arrive as a JSON string from `DataFrame.to_json`, which rounds to 10 decimals. They are stored as the JSON they contain and compared like everything else, so those cells are only 10 decimals precise.
- A mismatch is reported with its JSON path, for example `$.response.point_estimates.mean: expected 138.26..., got 138.27...`.

## Changing a snapshot

Snapshots change only through the script, in a pull request that Irving reviews:

```bash
cd backend
AUTH_DISABLED=true .venv-lock/Scripts/python tests/golden/make_golden.py            # lists what would change
AUTH_DISABLED=true .venv-lock/Scripts/python tests/golden/make_golden.py --update   # writes the files
```

(Use `.venv-lock/bin/python` on Linux or macOS. The environment is the one installed from `requirements-dev.lock`.)

A dependency upgrade (see "Backend dependencies" in `CONTRIBUTING.md`) must keep these tests green. If a number moves, the pull request explains each changed number (which library, which version, why) before the snapshot is regenerated.
