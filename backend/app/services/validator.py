"""
Pure Python validation & unit conversion service (no FastAPI deps).
Validates a list of raw rows and returns a ValidationReport.
"""
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional
import pandas as pd


# ── Unit conversion tables ─────────────────────────────────────────────────

LEVEL_CONVERTERS = {
    "percent": lambda v, h: v,
    "pct": lambda v, h: v,
    "%": lambda v, h: v,
    "cm": lambda v, h: (v / h * 100) if h else None,
    "m": lambda v, h: (v * 100 / h * 100) if h else None,
    "inch": lambda v, h: (v * 2.54 / h * 100) if h else None,
    "ullage_cm": lambda v, h: ((h - v) / h * 100) if h else None,
    "ullage_m": lambda v, h: ((h - v * 100) / h * 100) if h else None,
}

VOLUME_TO_LITRES = {
    "litres": 1.0,
    "litre": 1.0,
    "l": 1.0,
    "m3": 1000.0,
    "m³": 1000.0,
    "cubic_metre": 1000.0,
    "us_gallon": 3.78541,
    "usgal": 3.78541,
    "gallon": 3.78541,
}


def convert_level_to_pct(value: float, unit: str, tank_height_cm: float = 0.0) -> Optional[float]:
    """Convert raw level value+unit to percentage 0–100."""
    unit_key = unit.lower().replace(" ", "_").replace("-", "_")
    converter = LEVEL_CONVERTERS.get(unit_key)
    if converter is None:
        return None
    result = converter(value, tank_height_cm)
    if result is None:
        return None
    return round(float(result), 4)


def convert_volume_to_litres(value: float, unit: str) -> Optional[float]:
    factor = VOLUME_TO_LITRES.get(unit.lower().strip().replace(" ", "_"))
    if factor is None:
        return None
    return round(value * factor, 4)


# ── Issue codes ────────────────────────────────────────────────────────────

SEVERITY = {
    "MISSING_TANK_ID": "error",
    "MISSING_TIMESTAMP": "error",
    "UNPARSEABLE_TIMESTAMP": "error",
    "MISSING_LEVEL": "warning",
    "INVALID_LEVEL_VALUE": "error",
    "LEVEL_OUT_OF_RANGE": "error",
    "DUPLICATE_TIMESTAMP": "warning",
    "TIME_ORDER_VIOLATION": "warning",
    "UNKNOWN_UNIT": "error",
    "UNIT_CONVERSION_FAILED": "error",
    "MISSING_VALUE_INTERPOLATED": "info",
}


@dataclass
class RowIssue:
    code: str
    severity: str
    message: str
    row: int


@dataclass
class ValidatedRow:
    row: int
    tank_id: str
    timestamp: Optional[datetime]
    level_pct: Optional[float]
    raw_value: Optional[float]
    raw_unit: Optional[str]
    status: str  # "valid" | "flagged" | "rejected"
    issues: list = field(default_factory=list)


@dataclass
class ValidationReport:
    rows_total: int
    rows_valid: int
    rows_flagged: int
    rows_rejected: int
    issues: list = field(default_factory=list)
    validated_rows: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "rows_total": self.rows_total,
            "rows_valid": self.rows_valid,
            "rows_flagged": self.rows_flagged,
            "rows_rejected": self.rows_rejected,
            "issues": [
                {"code": i.code, "severity": i.severity, "message": i.message, "row": i.row}
                for i in self.issues
            ],
        }


# ── Main validator ─────────────────────────────────────────────────────────

def validate_rows(
    rows: list[dict],
    tank_id: str,
    tank_height_cm: float = 0.0,
    default_unit: str = "percent",
    interpolate_gaps: bool = True,
) -> ValidationReport:
    """
    Validates a list of raw row dicts. Expected keys per row:
      timestamp, level (raw value), unit (optional), note (optional)
    Returns a ValidationReport with per-row verdicts.
    """
    report = ValidationReport(rows_total=len(rows), rows_valid=0, rows_flagged=0, rows_rejected=0)
    seen_timestamps: set[datetime] = set()
    last_ts: Optional[datetime] = None
    validated: list[ValidatedRow] = []

    for idx, raw in enumerate(rows):
        row_num = idx + 1
        vrow = ValidatedRow(row=row_num, tank_id=tank_id, timestamp=None, level_pct=None,
                            raw_value=None, raw_unit=None, status="valid")

        # 1. Timestamp
        ts_raw = raw.get("timestamp")
        if ts_raw is None or (isinstance(ts_raw, float) and math.isnan(ts_raw)) or str(ts_raw).strip() == "":
            vrow.issues.append(RowIssue("MISSING_TIMESTAMP", "error", f"Row {row_num}: timestamp is empty", row_num))
        else:
            try:
                ts = pd.to_datetime(ts_raw, utc=True).to_pydatetime()
                if ts in seen_timestamps:
                    vrow.issues.append(RowIssue("DUPLICATE_TIMESTAMP", "warning",
                                                f"Row {row_num}: duplicate timestamp {ts}", row_num))
                else:
                    seen_timestamps.add(ts)
                if last_ts and ts < last_ts:
                    vrow.issues.append(RowIssue("TIME_ORDER_VIOLATION", "warning",
                                                f"Row {row_num}: out-of-order ({ts} < {last_ts})", row_num))
                vrow.timestamp = ts
                last_ts = ts
            except Exception as e:
                vrow.issues.append(RowIssue("UNPARSEABLE_TIMESTAMP", "error",
                                            f"Row {row_num}: cannot parse timestamp '{ts_raw}'", row_num))

        # 2. Level value
        level_raw = raw.get("level")
        unit = str(raw.get("unit", default_unit)).strip() if raw.get("unit") else default_unit
        vrow.raw_unit = unit

        if level_raw is None or (isinstance(level_raw, float) and math.isnan(level_raw)) or str(level_raw).strip() == "":
            vrow.issues.append(RowIssue("MISSING_LEVEL", "warning", f"Row {row_num}: level value missing", row_num))
        else:
            try:
                lv = float(level_raw)
                vrow.raw_value = lv
                pct = convert_level_to_pct(lv, unit, tank_height_cm)
                if pct is None:
                    vrow.issues.append(RowIssue("UNKNOWN_UNIT", "error", f"Row {row_num}: unknown unit '{unit}'", row_num))
                elif pct < 0 or pct > 100:
                    vrow.issues.append(RowIssue("LEVEL_OUT_OF_RANGE", "error",
                                                f"Row {row_num}: level {pct:.2f}% out of [0,100]", row_num))
                else:
                    vrow.level_pct = pct
            except (ValueError, TypeError):
                vrow.issues.append(RowIssue("INVALID_LEVEL_VALUE", "error",
                                            f"Row {row_num}: cannot parse level '{level_raw}'", row_num))

        # Determine status
        has_error = any(i.severity == "error" for i in vrow.issues)
        has_warning = any(i.severity == "warning" for i in vrow.issues)
        if has_error:
            vrow.status = "rejected"
            report.rows_rejected += 1
        elif has_warning:
            vrow.status = "flagged"
            report.rows_flagged += 1
        else:
            vrow.status = "valid"
            report.rows_valid += 1

        report.issues.extend(vrow.issues)
        validated.append(vrow)

    # 3. Short-gap interpolation for missing level values (flagged rows only)
    if interpolate_gaps:
        for i, vrow in enumerate(validated):
            if vrow.status == "flagged" and vrow.level_pct is None:
                # Find nearest valid neighbours within 2 rows
                prev_pct = next((validated[j].level_pct for j in range(i - 1, max(-1, i - 3), -1) if validated[j].level_pct is not None), None)
                next_pct = next((validated[j].level_pct for j in range(i + 1, min(len(validated), i + 3)) if validated[j].level_pct is not None), None)
                if prev_pct is not None and next_pct is not None:
                    vrow.level_pct = round((prev_pct + next_pct) / 2, 4)
                    vrow.issues.append(RowIssue("MISSING_VALUE_INTERPOLATED", "info",
                                                f"Row {vrow.row}: level interpolated as {vrow.level_pct}%", vrow.row))

    report.validated_rows = validated
    return report
