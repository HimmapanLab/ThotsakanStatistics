"""Accuracy of the Descriptive and ANOVA computations on the NIST Statistical Reference Datasets.

Each value must be as accurate as an independent computation (numpy for the univariate statistics;
scipy.stats.f_oneway and a two-pass numpy sum of squares for ANOVA), to within half a digit:
``LRE(ours) >= LRE(baseline) - 0.5``. The certified values and the data come from ``data/*.dat``.

The xfail cases below are real findings, not hidden failures: pingouin's F is less accurate than
scipy's ``f_oneway``. The cause is the between sum of squares. pingouin's matches a naive two-pass
computation (the baseline here, so SS, MS and R-squared pass), but both lose digits on data with a
large constant offset; ``f_oneway`` subtracts the grand mean first and keeps about 1.7 digits more
(centring the data before the same two-pass code reproduces scipy's F digit for digit). A centred
sum-of-squares baseline would therefore turn between SS, between MS and R-squared into xfails on the
same files. The xfails are strict, so the suite goes red the day a library upgrade fixes (or worsens)
them, and ``core/`` is not touched. A value with at least ``strd.NOISE_FLOOR`` (14) correct digits
always passes: gaps that close to double precision are rounding noise that differs between machines.
"""
import pytest

import strd

# F = MS_between / MS_within from pingouin's table, against scipy.stats.f_oneway, which centres
# the data before summing. Measured with the locked versions (pingouin 0.7.0, scipy 1.18.1).
XFAIL_F = {
    "SmLs04": (8.74, 10.43), "SmLs05": (9.29, 10.21),
    "SmLs06": (9.19, 10.19), "SmLs07": (2.72, 4.41), "SmLs08": (3.27, 4.19),
    "SmLs09": (3.17, 4.17), "AtmWtAg": (8.49, 10.15),
}
XFAIL = {
    f"{name}::F": f"pingouin F has {ours} correct digits, scipy f_oneway {base} (LRE, locked versions)"
    for name, (ours, base) in XFAIL_F.items()
}


def _cases(datasets, quantities):
    return list(_iter_cases(datasets, quantities))


def _iter_cases(datasets, quantities):
    for name in datasets:
        for quantity in quantities:
            key = f"{name}::{quantity}"
            marks = [pytest.mark.xfail(strict=True, reason=XFAIL[key])] if key in XFAIL else []
            yield pytest.param(name, quantity, marks=marks, id=key)


def _check(m: strd.Measurement) -> None:
    assert m.passed, (
        f"{m.key}: ours {m.ours!r} has LRE {m.lre_ours:.2f}, baseline {m.baseline!r} has "
        f"LRE {m.lre_baseline:.2f} (certified {m.certified!r}, difficulty {m.difficulty})")


@pytest.mark.parametrize("name, quantity", _cases(strd.UNIVARIATE, strd.UNIVARIATE_QUANTITIES))
def test_univariate_summary_statistics(name, quantity):
    _check({m.quantity: m for m in strd.measure_univariate(name)}[quantity])


@pytest.mark.parametrize("name, quantity", _cases(strd.ANOVA, strd.ANOVA_QUANTITIES))
def test_one_way_anova_table(name, quantity):
    _check({m.quantity: m for m in strd.measure_anova(name)}[quantity])


def test_every_xfail_names_an_existing_case():
    cases = {f"{n}::{q}" for n in strd.ANOVA for q in strd.ANOVA_QUANTITIES}
    assert set(XFAIL) <= cases


def test_lre_is_the_number_of_correct_digits():
    assert strd.lre(1.0, 1.0) == 15.0
    assert strd.lre(1.001, 1.0) == pytest.approx(3.0, abs=1e-9)
    assert strd.lre(1e-5, 0.0) == pytest.approx(5.0)
    assert strd.lre(float("nan"), 1.0) == 0.0
    assert strd.lre(100.0, 1.0) == 0.0  # never negative


def test_the_files_parse_completely():
    for name in strd.UNIVARIATE:
        ref = strd.load_univariate(name)  # asserts the observation count against the header
        assert ref.std > 0 and -1 <= ref.autocorr1 <= 1
    for name in strd.ANOVA:
        ref = strd.load_anova(name)
        assert ref.df_between + ref.df_within == len(ref.frame) - 1
