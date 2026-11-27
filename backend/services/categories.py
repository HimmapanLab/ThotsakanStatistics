"""Match the category values the UI sends against a column, by the column's type.

The UI sends each category as the browser read it from the CSV: plain text such as "01", "0.50",
"TRUE" or "a". pandas has meanwhile given the column a type, so the text is compared by value:

- a number column (pandas reads "01" as 1 and "0.50" as 0.5) matches the text read as a number;
- a True/False column (pandas reads "True", "TRUE" and "true" as True) matches the text by its
  meaning, case ignored. Casting the text with ``astype(bool)`` is wrong: any non-empty text,
  "False" included, is True;
- any other column matches the text as written.

Filters and the Hypothesis groups both use this, so they always pick the same rows.
"""

from typing import Iterable

import pandas as pd
from pandas.api.types import is_bool_dtype, is_numeric_dtype

_TRUE = {"true"}
_FALSE = {"false"}


def is_selected(column: pd.Series, selected: Iterable[str]) -> pd.Series:
    """Row mask: the row's category is one of ``selected``."""
    texts = [str(value).strip() for value in selected]
    if is_bool_dtype(column):
        wanted = {True for t in texts if t.lower() in _TRUE} | {False for t in texts if t.lower() in _FALSE}
        return column.isin(wanted)
    if is_numeric_dtype(column):
        wanted = pd.to_numeric(pd.Series(texts, dtype=object), errors="coerce").dropna()
        return column.isin(set(wanted))
    return column.astype(str).isin(set(texts))
