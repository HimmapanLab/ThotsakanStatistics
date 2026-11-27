# 2026-11-28 — Numerical accuracy tests

Two new groups of backend tests guard the numbers, not only the behaviour.

- **`backend/tests/nist/`:** the NIST Statistical Reference Datasets (public domain, copied byte for byte into `data/`). The mean and standard deviation of the Descriptive tab are checked on the nine univariate files, and the one-way ANOVA table (`anova_table`, pingouin) on the eleven ANOVA files, against the certified values in each file's header. Accuracy is the number of correct digits (LRE); each value must be within half a digit of an independent computation (numpy; `scipy.stats.f_oneway` and two-pass sums of squares). `make_report.py` writes `REPORT.md` with every value.
- **`backend/tests/golden/`:** full-precision snapshots of the API responses (descriptive, graphical, inference, hypothesis, probability) for three public example datasets; `test_golden.py` replays the requests and compares at relative 1e-12. They change only through `make_golden.py --update`, in a pull request Irving reviews. Bootstrap is not recorded because its random draws cannot be seeded from the request.

Finding: pingouin's F statistic is less accurate than scipy's `f_oneway` on 8 of the 11 ANOVA files (SmLs01, SmLs04 to SmLs09, AtmWtAg). The cause is the between sum of squares: pingouin's matches a naive two-pass computation, and both lose digits on data with a large constant offset, while scipy centres the data first and keeps about 1.7 digits more (SmLs04: 8.7 correct digits against 10.4). So the sums of squares, mean squares and R-squared pass only because the baseline there is the naive two-pass one. Those F cases are strict `xfail` tests with the measured digits in the reason; `core/` is unchanged. SmLs01 is only a 0.55-digit gap at 14.45 digits.

Checked with the locked versions (`requirements-dev.lock`): the full `pytest` suite passes.
