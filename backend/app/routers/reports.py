"""
Reports & Data Export router (Module M7)
Exposes CSV, Excel (openpyxl), and PDF (ReportLab) downloads, plus report history management.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Response
from fastapi.responses import StreamingResponse
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import io

from ..database import get_db
from ..dependencies import get_current_user
from ..services.calculator import calculate
from ..services.anomaly_detector import detect_anomalies
from ..services.exporter import export_csv, export_excel, export_pdf

router = APIRouter(prefix="/api/reports", tags=["reports"])


async def _fetch_tank_data(db, tank_id: str, user_id: str, days: int = 30):
    tank = await db.tanks.find_one({
        "_id": ObjectId(tank_id),
        "owner_id": ObjectId(user_id)
    })
    if not tank:
        raise HTTPException(404, "Tank not found")

    since = datetime.now(timezone.utc) - timedelta(days=days)
    cursor = db.readings.find({
        "tank_id": ObjectId(tank_id),
        "timestamp": {"$gte": since}
    }).sort("timestamp", 1)

    readings = []
    async for doc in cursor:
        readings.append({
            "timestamp": doc["timestamp"],
            "level_pct": doc.get("level_pct", 0),
            "volume_litres": doc.get("volume_litres", 0),
            "source": doc.get("source", "manual"),
            "flags": doc.get("flags", []),
            "note": doc.get("note", ""),
        })

    capacity = tank.get("capacity_litres", 0.0)
    household = tank.get("household_size", 1)
    calc_res = calculate(tank_id, readings, capacity, household)
    anomalies = detect_anomalies(tank_id, readings, capacity, "medium")

    kpis = {
        "avg_daily_litres": round(calc_res.avg_daily_litres, 1),
        "avg_rate_lph": round(calc_res.avg_rate_lph, 2),
        "refills": calc_res.refill_count,
        "avg_interval_h": round(calc_res.avg_refill_interval_hours, 1),
        "days_to_empty": round(calc_res.days_to_empty, 1) if calc_res.days_to_empty else 0,
        "current_volume_litres": round(calc_res.current_volume_litres, 1),
        "current_level_pct": round(calc_res.current_level_pct, 1),
    }

    refill_events = [
        {
            "start_ts": e.start_ts.strftime("%Y-%m-%d %H:%M"),
            "end_ts": e.end_ts.strftime("%Y-%m-%d %H:%M"),
            "volume_before_litres": e.volume_before_litres,
            "volume_after_litres": e.volume_after_litres,
            "volume_added_litres": e.volume_added_litres,
            "duration_minutes": e.duration_minutes,
            "interval_since_prev_hours": e.interval_since_prev_hours,
        }
        for e in calc_res.refill_events
    ]

    anom_list = [
        {
            "timestamp": a.timestamp.strftime("%Y-%m-%d %H:%M"),
            "type": a.type,
            "severity": a.severity,
            "message": a.message,
        }
        for a in anomalies
    ]

    return {
        "tank": tank,
        "readings": readings,
        "refill_events": refill_events,
        "anomalies": anom_list,
        "kpis": kpis,
        "daily_totals": calc_res.daily_totals,
    }


@router.get("/export/{tank_id}")
async def export_report(
    tank_id: str,
    format: str = Query("pdf", pattern="^(pdf|xlsx|csv)$"),
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """Direct stream download of CSV, Excel, or PDF report."""
    db = get_db()
    data = await _fetch_tank_data(db, tank_id, str(current_user["_id"]), days)
    tank_name = data["tank"].get("name", "Tank")
    safe_name = "".join(c for c in tank_name if c.isalnum() or c in ("-", "_")).rstrip()

    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")

    if format == "csv":
        content = export_csv(data["readings"], data["refill_events"], data["kpis"])
        media_type = "text/csv"
        filename = f"{safe_name}_report_{timestamp_str}.csv"
    elif format == "xlsx":
        content = export_excel(data["readings"], data["refill_events"], data["kpis"], data["daily_totals"])
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{safe_name}_report_{timestamp_str}.xlsx"
    else:  # pdf
        content = export_pdf(
            tank_name=tank_name,
            kpis=data["kpis"],
            readings=data["readings"],
            refill_events=data["refill_events"],
            anomalies=data["anomalies"],
            daily_totals=data["daily_totals"],
        )
        media_type = "application/pdf"
        filename = f"{safe_name}_report_{timestamp_str}.pdf"

    # Also log report into db.reports collection for history
    try:
        await db.reports.insert_one({
            "owner_id": ObjectId(str(current_user["_id"])),
            "tank_id": ObjectId(tank_id),
            "tank_name": tank_name,
            "type": format,
            "days": days,
            "filename": filename,
            "size_bytes": len(content),
            "status": "ready",
            "created_at": datetime.now(timezone.utc),
        })
    except Exception:
        pass

    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/history")
async def list_reports(current_user: dict = Depends(get_current_user)):
    """List generated report history for the current user."""
    db = get_db()
    cursor = db.reports.find({"owner_id": ObjectId(str(current_user["_id"]))}).sort("created_at", -1).limit(50)
    reports = []
    async for doc in cursor:
        reports.append({
            "id": str(doc["_id"]),
            "tank_id": str(doc.get("tank_id", "")),
            "tank_name": doc.get("tank_name", "All Tanks"),
            "type": doc.get("type", "pdf"),
            "days": doc.get("days", 30),
            "filename": doc.get("filename", "report.pdf"),
            "size_bytes": doc.get("size_bytes", 0),
            "status": doc.get("status", "ready"),
            "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        })
    return reports


@router.delete("/{report_id}")
async def delete_report(report_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a report record from history."""
    db = get_db()
    result = await db.reports.delete_one({
        "_id": ObjectId(report_id),
        "owner_id": ObjectId(str(current_user["_id"]))
    })
    if result.deleted_count == 0:
        raise HTTPException(404, "Report not found")
    return {"deleted": True}
