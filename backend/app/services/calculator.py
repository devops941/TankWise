"""
Domain Calculation Engine — pure Python, no FastAPI deps.

Computes:
- Consumption rate (litres/hour) excluding refill events and large gaps
- Refill event detection (volume jumps ≥ threshold)
- Refill intervals (hours between consecutive refill starts)
- Daily & weekly consumption totals
- Days-to-empty forecast (current_volume / avg_daily_use last 7 days)
- Per-capita usage (optional)
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional
import numpy as np
import pandas as pd
from scipy.interpolate import interp1d


# ── Data structures ────────────────────────────────────────────────────────

@dataclass
class RefillEvent:
    start_ts: datetime
    end_ts: datetime
    volume_before_litres: float
    volume_after_litres: float
    volume_added_litres: float
    duration_minutes: float
    interval_since_prev_hours: Optional[float]

@dataclass
class CalcResult:
    tank_id: str
    period_from: Optional[datetime]
    period_to: Optional[datetime]
    # KPIs
    avg_daily_litres: float
    avg_rate_lph: float          # average consumption rate litres/hour
    refill_count: int
    avg_refill_interval_hours: Optional[float]
    days_to_empty: Optional[float]
    current_volume_litres: Optional[float]
    current_level_pct: Optional[float]
    per_capita_daily_litres: Optional[float]
    # Detail
    refill_events: list[RefillEvent] = field(default_factory=list)
    daily_totals: dict = field(default_factory=dict)   # date_str → litres
    weekly_totals: dict = field(default_factory=dict)  # iso_week → litres


# ── Helpers ────────────────────────────────────────────────────────────────

def _gap_hours(ts1: datetime, ts2: datetime) -> float:
    return abs((ts2 - ts1).total_seconds()) / 3600


def _build_df(readings: list[dict]) -> pd.DataFrame:
    """Convert list of reading dicts to a sorted DataFrame."""
    if not readings:
        return pd.DataFrame(columns=["timestamp", "level_pct", "volume_litres"])
    df = pd.DataFrame(readings)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values("timestamp").reset_index(drop=True)
    df["volume_litres"] = pd.to_numeric(df["volume_litres"], errors="coerce")
    df["level_pct"] = pd.to_numeric(df["level_pct"], errors="coerce")
    return df


def _interpolate_missing(df: pd.DataFrame, max_gap_hours: float = 4.0) -> pd.DataFrame:
    """Linear interpolation for short gaps only (≤ max_gap_hours)."""
    if df.empty:
        return df
    df = df.copy()
    ts_numeric = df["timestamp"].astype(np.int64)
    null_mask = df["volume_litres"].isna()
    if null_mask.sum() == 0:
        return df
    valid = df[~null_mask]
    if len(valid) < 2:
        return df
    f = interp1d(valid["timestamp"].astype(np.int64), valid["volume_litres"], bounds_error=False, fill_value=np.nan)
    for idx in df[null_mask].index:
        # Check if neighbours are within gap limit
        prev_idx = df[~null_mask & (df.index < idx)].index
        next_idx = df[~null_mask & (df.index > idx)].index
        if len(prev_idx) and len(next_idx):
            gap = _gap_hours(df.loc[prev_idx[-1], "timestamp"], df.loc[next_idx[0], "timestamp"])
            if gap <= max_gap_hours:
                df.loc[idx, "volume_litres"] = float(f(ts_numeric[idx]))
    return df


# ── Refill detection ───────────────────────────────────────────────────────

def detect_refills(df: pd.DataFrame, capacity_litres: float) -> list[RefillEvent]:
    """
    A refill is a volume INCREASE ≥ max(5% capacity, 50 L) between consecutive readings.
    """
    if df.empty or len(df) < 2:
        return []
    threshold = max(0.05 * capacity_litres, 50.0)
    events: list[RefillEvent] = []
    prev_refill_ts: Optional[datetime] = None

    for i in range(1, len(df)):
        v_before = df.loc[i - 1, "volume_litres"]
        v_after = df.loc[i, "volume_litres"]
        if pd.isna(v_before) or pd.isna(v_after):
            continue
        delta = v_after - v_before
        if delta >= threshold:
            start_ts = df.loc[i - 1, "timestamp"].to_pydatetime()
            end_ts = df.loc[i, "timestamp"].to_pydatetime()
            duration = (end_ts - start_ts).total_seconds() / 60
            interval = _gap_hours(prev_refill_ts, start_ts) if prev_refill_ts else None
            events.append(RefillEvent(
                start_ts=start_ts,
                end_ts=end_ts,
                volume_before_litres=round(float(v_before), 2),
                volume_after_litres=round(float(v_after), 2),
                volume_added_litres=round(float(delta), 2),
                duration_minutes=round(duration, 2),
                interval_since_prev_hours=round(interval, 2) if interval is not None else None,
            ))
            prev_refill_ts = start_ts

    return events


# ── Consumption rate ───────────────────────────────────────────────────────

def compute_consumption_rate(df: pd.DataFrame, refill_events: list[RefillEvent], max_gap_hours: float = 6.0) -> float:
    """
    Average consumption rate in litres/hour.
    Excludes refill periods and gaps > max_gap_hours.
    Uses only consecutive reading pairs where volume decreases (consumption).
    """
    if df.empty or len(df) < 2:
        return 0.0

    refill_windows = {(e.start_ts, e.end_ts) for e in refill_events}

    total_litres = 0.0
    total_hours = 0.0

    for i in range(1, len(df)):
        t1 = df.loc[i - 1, "timestamp"].to_pydatetime()
        t2 = df.loc[i, "timestamp"].to_pydatetime()
        v1 = df.loc[i - 1, "volume_litres"]
        v2 = df.loc[i, "volume_litres"]

        if pd.isna(v1) or pd.isna(v2):
            continue

        gap_h = _gap_hours(t1, t2)
        if gap_h > max_gap_hours:
            continue

        # Skip if this interval overlaps a refill
        is_refill = any(s <= t1 <= e or s <= t2 <= e for s, e in refill_windows)
        if is_refill:
            continue

        delta = v1 - v2  # positive = consumption
        if delta > 0:
            total_litres += delta
            total_hours += gap_h

    if total_hours == 0:
        return 0.0
    return round(total_litres / total_hours, 4)


# ── Daily & weekly totals ──────────────────────────────────────────────────

def compute_daily_totals(df: pd.DataFrame, refill_events: list[RefillEvent]) -> dict:
    """Sum of consumption (positive drops) per UTC calendar day."""
    if df.empty or len(df) < 2:
        return {}

    refill_windows = {(e.start_ts, e.end_ts) for e in refill_events}
    totals: dict[str, float] = {}

    for i in range(1, len(df)):
        t1 = df.loc[i - 1, "timestamp"].to_pydatetime()
        t2 = df.loc[i, "timestamp"].to_pydatetime()
        v1 = df.loc[i - 1, "volume_litres"]
        v2 = df.loc[i, "volume_litres"]

        if pd.isna(v1) or pd.isna(v2):
            continue
        is_refill = any(s <= t1 <= e or s <= t2 <= e for s, e in refill_windows)
        if is_refill:
            continue

        delta = v1 - v2
        if delta > 0:
            day_key = t1.strftime("%Y-%m-%d")
            totals[day_key] = round(totals.get(day_key, 0.0) + delta, 2)

    return totals


def compute_weekly_totals(daily_totals: dict) -> dict:
    """Aggregate daily totals into ISO week strings (YYYY-Www)."""
    weekly: dict[str, float] = {}
    for day_str, litres in daily_totals.items():
        dt = datetime.strptime(day_str, "%Y-%m-%d")
        week_key = dt.strftime("%G-W%V")
        weekly[week_key] = round(weekly.get(week_key, 0.0) + litres, 2)
    return weekly


# ── Forecast ───────────────────────────────────────────────────────────────

def compute_days_to_empty(current_volume: float, daily_totals: dict, lookback_days: int = 7) -> Optional[float]:
    """
    Forecast: current_volume / avg_daily_use over last `lookback_days` days.
    Returns None if no data or zero avg.
    """
    if not daily_totals:
        return None
    sorted_days = sorted(daily_totals.keys(), reverse=True)
    recent = sorted_days[:lookback_days]
    if not recent:
        return None
    avg = sum(daily_totals[d] for d in recent) / len(recent)
    if avg <= 0:
        return None
    return round(current_volume / avg, 2)


# ── Main entry point ───────────────────────────────────────────────────────

def calculate(
    tank_id: str,
    readings: list[dict],
    capacity_litres: float,
    household_size: int = 1,
) -> CalcResult:
    """
    Full calculation pipeline for one tank.
    `readings` is a list of dicts with keys: timestamp, level_pct, volume_litres.
    """
    df = _build_df(readings)
    df = _interpolate_missing(df)

    if df.empty:
        return CalcResult(
            tank_id=tank_id, period_from=None, period_to=None,
            avg_daily_litres=0.0, avg_rate_lph=0.0, refill_count=0,
            avg_refill_interval_hours=None, days_to_empty=None,
            current_volume_litres=None, current_level_pct=None,
            per_capita_daily_litres=None,
        )

    period_from = df["timestamp"].min().to_pydatetime()
    period_to = df["timestamp"].max().to_pydatetime()
    current_row = df.iloc[-1]
    current_volume = float(current_row["volume_litres"]) if not pd.isna(current_row["volume_litres"]) else None
    current_level = float(current_row["level_pct"]) if not pd.isna(current_row["level_pct"]) else None

    refill_events = detect_refills(df, capacity_litres)
    avg_rate_lph = compute_consumption_rate(df, refill_events)
    daily_totals = compute_daily_totals(df, refill_events)
    weekly_totals = compute_weekly_totals(daily_totals)

    days = len(daily_totals)
    avg_daily = round(sum(daily_totals.values()) / days, 2) if days else 0.0
    avg_interval = None
    if len(refill_events) >= 2:
        intervals = [e.interval_since_prev_hours for e in refill_events if e.interval_since_prev_hours is not None]
        avg_interval = round(sum(intervals) / len(intervals), 2) if intervals else None

    days_to_empty = compute_days_to_empty(current_volume or 0, daily_totals) if current_volume else None
    per_capita = round(avg_daily / household_size, 2) if household_size > 0 and avg_daily > 0 else None

    return CalcResult(
        tank_id=tank_id,
        period_from=period_from,
        period_to=period_to,
        avg_daily_litres=avg_daily,
        avg_rate_lph=avg_rate_lph,
        refill_count=len(refill_events),
        avg_refill_interval_hours=avg_interval,
        days_to_empty=days_to_empty,
        current_volume_litres=current_volume,
        current_level_pct=current_level,
        per_capita_daily_litres=per_capita,
        refill_events=refill_events,
        daily_totals=daily_totals,
        weekly_totals=weekly_totals,
    )
