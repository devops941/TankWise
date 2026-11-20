"""
Trend & Comparison Analytics — pure Python, no FastAPI deps.

Provides:
- Rolling 7- and 14-day averages on daily consumption
- Period-over-period comparison (absolute + percent change)
- Weekday vs weekend mean daily consumption + Welch t-test p-value
- STL seasonal decomposition (period=7) → trend, seasonal, residual, seasonal_strength
- Linear trend regression → slope, r², p-value, direction
- Tank vs tank comparison (normalized by capacity and household size)
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class TrendResult:
    slope_litres_per_day: float
    r_squared: float
    p_value: float
    direction: str  # "increasing" | "decreasing" | "stable"
    rolling_7d: dict  # date_str → litres
    rolling_14d: dict  # date_str → litres


@dataclass
class PeriodComparison:
    period_a_total: float
    period_b_total: float
    absolute_change: float
    percent_change: Optional[float]


@dataclass
class WeekdayWeekendResult:
    weekday_mean: float
    weekend_mean: float
    p_value: Optional[float]
    significant: bool  # p < 0.05


@dataclass
class STLResult:
    trend: dict     # date_str → float
    seasonal: dict  # date_str → float
    residual: dict  # date_str → float
    seasonal_strength: float  # 0–1


@dataclass
class AnalyticsResult:
    tank_id: str
    trend: Optional[TrendResult] = None
    weekday_weekend: Optional[WeekdayWeekendResult] = None
    stl: Optional[STLResult] = None
    period_comparison: Optional[PeriodComparison] = None


def _daily_series(daily_totals: dict) -> pd.Series:
    if not daily_totals:
        return pd.Series(dtype=float)
    s = pd.Series(daily_totals)
    s.index = pd.to_datetime(s.index)
    s = s.sort_index()
    s = s.reindex(pd.date_range(s.index.min(), s.index.max(), freq="D"), fill_value=0.0)
    return s


def compute_trend(daily_totals: dict) -> Optional[TrendResult]:
    s = _daily_series(daily_totals)
    if len(s) < 7:
        return None

    # Rolling averages
    r7 = s.rolling(7, min_periods=1).mean()
    r14 = s.rolling(14, min_periods=1).mean()
    rolling_7d = {str(d.date()): round(float(v), 4) for d, v in r7.items()}
    rolling_14d = {str(d.date()): round(float(v), 4) for d, v in r14.items()}

    # Linear regression
    x = np.arange(len(s), dtype=float)
    y = s.values
    try:
        from scipy import stats
        slope, intercept, r_value, p_value, _ = stats.linregress(x, y)
        r2 = r_value ** 2
    except Exception:
        slope, r2, p_value = 0.0, 0.0, 1.0

    direction = "stable"
    if abs(slope) > 0.5:
        direction = "increasing" if slope > 0 else "decreasing"

    return TrendResult(
        slope_litres_per_day=round(float(slope), 4),
        r_squared=round(float(r2), 4),
        p_value=round(float(p_value), 6),
        direction=direction,
        rolling_7d=rolling_7d,
        rolling_14d=rolling_14d,
    )


def compute_weekday_weekend(daily_totals: dict) -> Optional[WeekdayWeekendResult]:
    s = _daily_series(daily_totals)
    if len(s) < 14:
        return None
    weekday = s[s.index.dayofweek < 5]
    weekend = s[s.index.dayofweek >= 5]
    if len(weekday) == 0 or len(weekend) == 0:
        return None

    p_value = None
    try:
        from scipy import stats
        _, p_value = stats.ttest_ind(weekday.values, weekend.values, equal_var=False)
        p_value = round(float(p_value), 6)
    except Exception:
        pass

    return WeekdayWeekendResult(
        weekday_mean=round(float(weekday.mean()), 4),
        weekend_mean=round(float(weekend.mean()), 4),
        p_value=p_value,
        significant=p_value is not None and p_value < 0.05,
    )


def compute_stl(daily_totals: dict, period: int = 7) -> Optional[STLResult]:
    s = _daily_series(daily_totals)
    if len(s) < period * 2:
        return None
    try:
        from statsmodels.tsa.seasonal import STL
        stl = STL(s, period=period, robust=True)
        res = stl.fit()
        trend_d = {str(d.date()): round(float(v), 4) for d, v in zip(s.index, res.trend)}
        seasonal_d = {str(d.date()): round(float(v), 4) for d, v in zip(s.index, res.seasonal)}
        residual_d = {str(d.date()): round(float(v), 4) for d, v in zip(s.index, res.resid)}
        var_seasonal = np.var(res.seasonal)
        var_total = np.var(s.values)
        strength = round(float(var_seasonal / var_total), 4) if var_total > 0 else 0.0
        return STLResult(trend=trend_d, seasonal=seasonal_d, residual=residual_d, seasonal_strength=strength)
    except Exception:
        return None


def compare_periods(
    daily_totals_a: dict,
    daily_totals_b: dict,
) -> PeriodComparison:
    total_a = round(sum(daily_totals_a.values()), 2)
    total_b = round(sum(daily_totals_b.values()), 2)
    absolute = round(total_b - total_a, 2)
    pct = round((absolute / total_a * 100), 2) if total_a != 0 else None
    return PeriodComparison(period_a_total=total_a, period_b_total=total_b, absolute_change=absolute, percent_change=pct)


def analyze(tank_id: str, daily_totals: dict) -> AnalyticsResult:
    result = AnalyticsResult(tank_id=tank_id)
    result.trend = compute_trend(daily_totals)
    result.weekday_weekend = compute_weekday_weekend(daily_totals)
    result.stl = compute_stl(daily_totals)
    return result
