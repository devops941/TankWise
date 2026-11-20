"""
Anomaly Detection Service — pure Python, no FastAPI deps.

Detectors:
1. Statistical: z-score (|z| > threshold) and IQR fences
2. Rule-based: night-drop, overflow, abnormal draw, flatline
3. ML: IsolationForest on engineered features
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


SEVERITY_MAP = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}


@dataclass
class Anomaly:
    tank_id: str
    timestamp: datetime
    end_timestamp: Optional[datetime]
    type: str
    severity: str
    method: str
    score: Optional[float]
    observed: Optional[float]
    expected: Optional[float]
    message: str
    status: str = "open"


def _build_df(readings: list[dict]) -> pd.DataFrame:
    if not readings:
        return pd.DataFrame()
    df = pd.DataFrame(readings)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values("timestamp").reset_index(drop=True)
    df["volume_litres"] = pd.to_numeric(df.get("volume_litres", pd.Series()), errors="coerce")
    df["level_pct"] = pd.to_numeric(df.get("level_pct", pd.Series()), errors="coerce")
    return df


# ── Statistical detectors ──────────────────────────────────────────────────

def detect_statistical(df: pd.DataFrame, tank_id: str, z_threshold: float = 3.0) -> list[Anomaly]:
    if df.empty or "volume_litres" not in df.columns:
        return []
    anomalies = []
    # Compute rate of change (litres/hour)
    df = df.copy()
    df["dt_h"] = df["timestamp"].diff().dt.total_seconds() / 3600
    df["dv"] = df["volume_litres"].diff()
    df["rate"] = df["dv"] / df["dt_h"]  # negative = consumption

    rates = df["rate"].dropna()
    if len(rates) < 10:
        return []
    mean_r, std_r = rates.mean(), rates.std()
    q1, q3 = rates.quantile(0.25), rates.quantile(0.75)
    iqr = q3 - q1
    lower_fence = q1 - 1.5 * iqr
    upper_fence = q3 + 1.5 * iqr

    for idx in df.index[1:]:
        rate = df.loc[idx, "rate"]
        if pd.isna(rate):
            continue
        z = (rate - mean_r) / std_r if std_r > 0 else 0
        is_z = abs(z) > z_threshold
        is_iqr = rate < lower_fence or rate > upper_fence
        if is_z or is_iqr:
            severity = "high" if abs(z) > 4.5 else "medium"
            anomalies.append(Anomaly(
                tank_id=tank_id,
                timestamp=df.loc[idx, "timestamp"].to_pydatetime(),
                end_timestamp=None,
                type="statistical_outlier",
                severity=severity,
                method="z_score" if is_z else "iqr",
                score=round(float(z), 4),
                observed=round(float(rate), 4),
                expected=round(float(mean_r), 4),
                message=f"Rate {rate:.2f} L/h is a statistical outlier (z={z:.2f})",
            ))
    return anomalies


# ── Rule-based detectors ───────────────────────────────────────────────────

def detect_rules(df: pd.DataFrame, tank_id: str, capacity_litres: float) -> list[Anomaly]:
    if df.empty:
        return []
    anomalies = []
    df = df.copy()
    df["dt_h"] = df["timestamp"].diff().dt.total_seconds() / 3600
    df["dv"] = df["volume_litres"].diff()
    df["rate"] = df["dv"] / df["dt_h"]

    normal_rate_abs = abs(df["rate"].median()) if len(df) > 5 else 10.0

    for idx in df.index[1:]:
        ts = df.loc[idx, "timestamp"].to_pydatetime()
        rate = df.loc[idx, "rate"]
        level = df.loc[idx, "level_pct"]
        if pd.isna(rate):
            continue

        # Night drop: 22:00–05:00 UTC, abnormal consumption during dormant hours
        hour = ts.hour
        if 22 <= hour or hour < 5:
            # Water tank night flow: normal night consumption is near 0 (< 3 L/h).
            # A sustained drop > 8 L/h indicates a running float valve or pipe leak.
            leak_threshold = max(8.0, capacity_litres * 0.005)
            if rate < -leak_threshold:
                anomalies.append(Anomaly(
                    tank_id=tank_id, timestamp=ts, end_timestamp=None,
                    type="night_leak", severity="high", method="rule_night_drop",
                    score=round(float(abs(rate)), 4), observed=round(float(abs(rate)), 4),
                    expected=1.0, message=f"Night leak detected: continuous loss of {abs(rate):.1f} L/h between 22:00-05:00",
                ))

        # Overflow: level > 98%
        if not pd.isna(level) and level > 98.0:
            anomalies.append(Anomaly(
                tank_id=tank_id, timestamp=ts, end_timestamp=None,
                type="overflow", severity="critical", method="rule_overflow",
                score=round(float(level), 4), observed=round(float(level), 4),
                expected=95.0, message=f"Tank level {level:.1f}% exceeds safe overflow capacity",
            ))

        # Abnormal draw: >2.5× median rate and >40 L/h
        if rate < -max(40.0, normal_rate_abs * 2.5):
            anomalies.append(Anomaly(
                tank_id=tank_id, timestamp=ts, end_timestamp=None,
                type="rapid_draw", severity="medium", method="rule_rapid_draw",
                score=round(float(abs(rate)), 4), observed=round(float(abs(rate)), 4),
                expected=round(float(-normal_rate_abs), 4),
                message=f"Rapid draw burst: {abs(rate):.1f} L/h exceeds normal draw rate",
            ))

    # Flatline: same level for ≥6 consecutive readings
    if "level_pct" in df.columns:
        for start_i in range(len(df) - 5):
            window = df.iloc[start_i:start_i + 6]
            if window["level_pct"].nunique() == 1 and not window["level_pct"].isna().all():
                ts_start = window.iloc[0]["timestamp"].to_pydatetime()
                ts_end = window.iloc[-1]["timestamp"].to_pydatetime()
                anomalies.append(Anomaly(
                    tank_id=tank_id, timestamp=ts_start, end_timestamp=ts_end,
                    type="sensor_fault", severity="medium", method="rule_flatline",
                    score=None, observed=float(window["level_pct"].iloc[0]),
                    expected=None, message="Sensor flatline: 6+ consecutive identical readings",
                ))
                break

    return anomalies


# ── ML detector ────────────────────────────────────────────────────────────

def detect_isolation_forest(df: pd.DataFrame, tank_id: str, contamination: float = 0.05) -> list[Anomaly]:
    if df.empty or len(df) < 20:
        return []
    try:
        from sklearn.ensemble import IsolationForest
    except ImportError:
        return []

    df = df.copy()
    df["dt_h"] = df["timestamp"].diff().dt.total_seconds() / 3600
    df["dv"] = df["volume_litres"].diff()
    df["rate"] = df["dv"] / df["dt_h"]
    df["hour"] = df["timestamp"].dt.hour
    features = df[["rate", "volume_litres", "hour"]].dropna()
    if len(features) < 20:
        return []

    clf = IsolationForest(contamination=contamination, random_state=42)
    preds = clf.fit_predict(features)
    scores = clf.score_samples(features)

    anomalies = []
    for i, (pred, score) in enumerate(zip(preds, scores)):
        if pred == -1:
            orig_idx = features.index[i]
            ts = df.loc[orig_idx, "timestamp"].to_pydatetime()
            anomalies.append(Anomaly(
                tank_id=tank_id, timestamp=ts, end_timestamp=None,
                type="statistical_outlier", severity="medium", method="isolation_forest",
                score=round(float(score), 6), observed=float(df.loc[orig_idx, "rate"]),
                expected=None, message=f"IsolationForest anomaly (score={score:.4f})",
            ))
    return anomalies


# ── Main entry point ───────────────────────────────────────────────────────

def detect_anomalies(
    tank_id: str,
    readings: list[dict],
    capacity_litres: float,
    sensitivity: str = "medium",
) -> list[Anomaly]:
    df = _build_df(readings)
    if df.empty:
        return []

    z_thresh = {"low": 4.0, "medium": 3.0, "high": 2.5}.get(sensitivity, 3.0)
    contamination = {"low": 0.03, "medium": 0.05, "high": 0.08}.get(sensitivity, 0.05)

    all_anomalies: list[Anomaly] = []
    all_anomalies.extend(detect_statistical(df, tank_id, z_thresh))
    all_anomalies.extend(detect_rules(df, tank_id, capacity_litres))
    all_anomalies.extend(detect_isolation_forest(df, tank_id, contamination))

    # Deduplicate by (timestamp, type) keeping highest severity
    seen: dict[tuple, Anomaly] = {}
    for a in all_anomalies:
        key = (a.timestamp, a.type)
        if key not in seen or SEVERITY_MAP.get(a.severity, 0) > SEVERITY_MAP.get(seen[key].severity, 0):
            seen[key] = a
    return list(seen.values())
