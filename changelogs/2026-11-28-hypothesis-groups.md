# 2026-11-28 — Hypothesis groups match the categories as written

Two backend bugs in Hypothesis Testing, found in the 27 November review (H8, H9).

- **A True/False column gave identical groups.** The selected categories were cast to the column's type, and `pd.Series(['False']).astype(bool)` is `True`, so "False" and "True" both selected the True rows. On the default Electricity dataset, Demand by Holiday gave t = 0, p = 1. Groups and ANOVA levels now compare the categories as text, the same way the filters always have; it now gives groups of 17 038 and 480 rows.
- **ANOVA with a one-row level was a 500 error.** Each level now needs at least two values, and the 400 message names the level, as the two-sample tests already did.
- The text comparison moved from `api/deps.py` to `services/categories.py`, so filters and groups share one rule.

Tests: `backend/tests/test_hypothesis_service.py` (bool groups against `scipy.stats.ttest_ind`, bool ANOVA levels, numeric codes read as `1.0`, one-row ANOVA level) and `backend/tests/api/test_hypothesis.py` (one-row level → 400).
