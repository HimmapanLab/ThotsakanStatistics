# 2026-11-28 — Hypothesis groups and filters match categories by the column's type

Bugs from the 27 November review (H8, H9, M4).

The UI sends each category as the CSV text ("01", "0.50", "TRUE", "a"), but pandas has already given the column a type. Categories are now matched by value, in `services/categories.py`, for filters and Hypothesis groups alike:

- **a number column** matches the text read as a number, so "01" matches 1 and "0.50" matches 0.5;
- **a True/False column** matches "true"/"false" in any case. Casting the text with `astype(bool)` was the H9 bug: any non-empty text, "False" included, is True, so on the default Electricity dataset Demand by Holiday compared the True rows with themselves (t = 0, p = 1). It now gives groups of 17 038 and 480 rows;
- **any other column** matches the text as written.

Filters compared everything as text, so a filter on "0.50" or "01" matched no rows (M4); fixed by the same rule.

**ANOVA with a one-row level** was a 500 error (H8). Each level now needs at least two values, and the 400 message names the level, as the two-sample tests already did.

Tests:
- `backend/tests/api/test_category_matching.py` goes through the real CSV upload: zero-padded codes, decimal levels, Excel TRUE/FALSE, Python True/False, lower case, text, and a code read as a float after a blank cell, for groups, ANOVA and filters;
- `backend/tests/test_hypothesis_service.py` covers bool groups against `scipy.stats.ttest_ind`, and the one-row ANOVA level;
- `backend/tests/api/test_hypothesis.py`: a one-row level returns 400.
