"""NIST StRD (Statistical Reference Datasets): parsing, LRE and the measurements the tests report.

Everything is read from the text of the files in ``data/`` (certified values and observations);
no number is typed here. The tests in ``test_nist_strd.py`` and the report writer ``make_report.py``
share these functions.

LRE (log relative error) is NIST's accuracy measure: the number of correct significant digits,
``-log10(|x - c| / |c|)``, capped at 15 (a double holds about 15.9 digits).
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

DATA = Path(__file__).parent / "data"
CAP = 15.0

UNIVARIATE = ["PiDigits", "Lottery", "Lew", "Mavro", "Michelso", "NumAcc1", "NumAcc2", "NumAcc3", "NumAcc4"]
ANOVA = ["SiRstv", "SmLs01", "SmLs02", "SmLs03", "SmLs04", "SmLs05", "SmLs06", "SmLs07", "SmLs08",
         "SmLs09", "AtmWtAg"]

_NUMBER = r"[-+]?\d+(?:\.\d*)?(?:[Ee][-+]?\d+)?"


def lre(x: float, c: float) -> float:
    """Correct significant digits of ``x`` against the certified value ``c`` (0 to 15)."""
    if x is None or not math.isfinite(x):
        return 0.0
    if x == c:
        return CAP
    err = abs(x - c) if c == 0 else abs(x - c) / abs(c)
    return max(0.0, min(CAP, -math.log10(err)))


def _lines(name: str) -> list[str]:
    return (DATA / f"{name}.dat").read_text(encoding="ascii").splitlines()


def difficulty(name: str) -> str:
    """NIST's difficulty level (Lower, Average or Higher) from the file header.

    Michelso.dat states none; that is reported as "not stated" rather than guessed.
    """
    match = re.search(r"(Lower|Average|Higher) Level of Difficulty", "\n".join(_lines(name)))
    return match.group(1) if match else "not stated"


NOISE_FLOOR = 14.0  # correct digits at which any value passes (doubles carry about 15.9)


@dataclass(frozen=True)
class Univariate:
    name: str
    difficulty: str
    mean: float
    std: float          # sample standard deviation, denominator n - 1
    autocorr1: float
    n: int
    data: np.ndarray


@dataclass(frozen=True)
class Anova:
    name: str
    difficulty: str
    df_between: float
    ss_between: float
    ms_between: float
    f: float
    df_within: float
    ss_within: float
    ms_within: float
    r_squared: float
    resid_sd: float
    frame: pd.DataFrame  # columns "group" (text) and "y"


def _number_after(line: str, label: str) -> float:
    """The first number after ``label``, e.g. the certified value in ``Sample Mean  ybar:  -177.4``."""
    return float(re.findall(_NUMBER, line.split(label, 1)[1])[0])


def load_univariate(name: str) -> Univariate:
    lines = _lines(name)
    mean = std = auto = n = None
    for line in lines:
        if line.startswith("Sample Mean"):
            mean = _number_after(line, ":")
        elif line.startswith("Sample Standard Deviation"):
            std = _number_after(line, ":")
        elif line.startswith("Sample Autocorrelation"):
            auto = _number_after(line, "r(1):")
        elif line.startswith("Number of Observations"):
            n = int(_number_after(line, ":"))
    start = next(i for i, line in enumerate(lines) if re.fullmatch(r"Data:\s*Y\s*", line))
    values = [float(line) for line in lines[start + 2:] if line.strip()]  # skip "Data: Y" and its rule
    assert None not in (mean, std, auto, n), f"{name}: certified values missing"
    assert len(values) == n, f"{name}: {len(values)} observations, header says {n}"
    return Univariate(name, difficulty(name), mean, std, auto, n, np.array(values, dtype=float))


def load_anova(name: str) -> Anova:
    lines = _lines(name)
    between = next(line for line in lines if line.startswith("Between"))
    within = next(line for line in lines if line.startswith("Within"))
    b = re.findall(_NUMBER, between.split(None, 2)[2])  # drop the words "Between Treatment"
    w = re.findall(_NUMBER, within.split(None, 2)[2])
    r2 = next(_number_after(line, "Certified R-Squared") for line in lines if "Certified R-Squared" in line)
    sd_line = next(line for line in lines if "Standard Deviation" in line and "Certified" not in line)
    resid_sd = _number_after(sd_line, "Deviation")
    start = max(i for i, line in enumerate(lines) if line.startswith("Data:"))  # the second one heads the data
    rows = [line.split() for line in lines[start + 1:] if line.strip()]
    frame = pd.DataFrame({"group": [r[0] for r in rows], "y": [float(r[1]) for r in rows]})
    count = int(re.search(r"(\d+) Observations", "\n".join(lines)).group(1))
    assert len(frame) == count, f"{name}: {len(frame)} observations, header says {count}"
    return Anova(name, difficulty(name), float(b[0]), float(b[1]), float(b[2]), float(b[3]),
                 float(w[0]), float(w[1]), float(w[2]), r2, resid_sd, frame)


@dataclass(frozen=True)
class Measurement:
    dataset: str
    difficulty: str
    quantity: str
    certified: float
    ours: float
    baseline: float
    lre_ours: float
    lre_baseline: float

    @property
    def key(self) -> str:
        return f"{self.dataset}::{self.quantity}"

    @property
    def passed(self) -> bool:
        # At NOISE_FLOOR digits both values agree to what a double holds; a gap there is rounding
        # noise that differs between machines (BLAS), not a difference in method.
        return self.lre_ours >= NOISE_FLOOR or self.lre_ours >= self.lre_baseline - 0.5


def _measure(dataset: str, level: str, quantity: str, certified: float, ours: float, baseline: float):
    return Measurement(dataset, level, quantity, certified, float(ours), float(baseline),
                       lre(float(ours), certified), lre(float(baseline), certified))


@lru_cache(maxsize=None)
def measure_univariate(name: str) -> list[Measurement]:
    """Mean and sample standard deviation: the Descriptive tab's code against numpy."""
    from api.schemas.descriptive import DescriptiveRequest
    from core.estimation.descriptive import compute_descriptive_statistics
    from services.descriptive import calculate_descriptive

    ref = load_univariate(name)
    table = compute_descriptive_statistics(pd.Series(ref.data))
    value = lambda measure: float(table.loc[table["Measure"] == measure, "Value"].iloc[0])  # noqa: E731
    summary = calculate_descriptive(
        pd.DataFrame({"y": ref.data}), DescriptiveRequest(session_id="nist", column="y")).summary
    base_mean, base_std = np.mean(ref.data), np.std(ref.data, ddof=1)
    return [
        _measure(name, ref.difficulty, "mean (core table)", ref.mean, value("Mean"), base_mean),
        _measure(name, ref.difficulty, "std ddof=1 (core table)", ref.std, value("Std (ddof=1)"), base_std),
        _measure(name, ref.difficulty, "mean (summary)", ref.mean, summary.mean, base_mean),
        _measure(name, ref.difficulty, "std ddof=1 (summary)", ref.std, summary.std, base_std),
    ]


@lru_cache(maxsize=None)
def measure_anova(name: str) -> list[Measurement]:
    """One-way ANOVA table of ``core`` (pingouin) against scipy and a two-pass numpy computation."""
    from core.hypothesis_testing.tables import anova_table

    ref = load_anova(name)
    table = anova_table(ref.frame, numeric_col="y", cat_col="group").set_index("Source")
    row_b, row_w = table.loc["group"], table.loc["Within"]
    ss_b, ss_w = float(row_b["SS"]), float(row_w["SS"])
    ours_r2 = ss_b / (ss_b + ss_w)
    ours_sd = math.sqrt(float(row_w["MS"]))

    groups = [g["y"].to_numpy() for _, g in ref.frame.groupby("group", sort=False)]
    grand = np.mean(ref.frame["y"].to_numpy())
    base_ssb = sum(len(g) * (np.mean(g) - grand) ** 2 for g in groups)
    base_ssw = sum(np.sum((g - np.mean(g)) ** 2) for g in groups)
    base_dfb, base_dfw = len(groups) - 1, len(ref.frame) - len(groups)
    base_f = stats.f_oneway(*groups).statistic
    lvl = ref.difficulty
    return [
        _measure(name, lvl, "between df", ref.df_between, row_b["DF"], base_dfb),
        _measure(name, lvl, "within df", ref.df_within, row_w["DF"], base_dfw),
        _measure(name, lvl, "between SS", ref.ss_between, ss_b, base_ssb),
        _measure(name, lvl, "within SS", ref.ss_within, ss_w, base_ssw),
        _measure(name, lvl, "between MS", ref.ms_between, row_b["MS"], base_ssb / base_dfb),
        _measure(name, lvl, "within MS", ref.ms_within, row_w["MS"], base_ssw / base_dfw),
        _measure(name, lvl, "F", ref.f, row_b["F"], base_f),
        _measure(name, lvl, "R-squared", ref.r_squared, ours_r2, base_ssb / (base_ssb + base_ssw)),
        _measure(name, lvl, "residual SD", ref.resid_sd, ours_sd, math.sqrt(base_ssw / base_dfw)),
    ]


UNIVARIATE_QUANTITIES = ["mean (core table)", "std ddof=1 (core table)", "mean (summary)",
                         "std ddof=1 (summary)"]
ANOVA_QUANTITIES = ["between df", "within df", "between SS", "within SS", "between MS", "within MS", "F",
                    "R-squared", "residual SD"]
