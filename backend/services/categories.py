"""Match category values as the CSV wrote them.

The UI sends the categories it shows, as text. Comparing as text is what keeps a
bool column right (``pd.Series(['False']).astype(bool)`` is True) and a numeric
category right (a blank cell makes pandas read 1 as 1.0). Filters and the
Hypothesis groups both use this, so they always pick the same rows.
"""

from typing import Iterable

import pandas as pd


def as_text(values: pd.Series) -> pd.Series:
    """Values as the CSV wrote them: drop the trailing ".0" pandas adds to whole numbers."""
    return values.astype(str).str.replace(r"\.0$", "", regex=True)


def is_selected(column: pd.Series, selected: Iterable[str]) -> pd.Series:
    """Row mask: the row's category, as text, is one of ``selected``."""
    wanted = set(as_text(pd.Series(list(selected), dtype=str)))
    return as_text(column).isin(wanted)
