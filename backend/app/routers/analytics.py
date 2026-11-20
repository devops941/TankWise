"""
Analytics & Anomaly endpoints.
GET /api/analytics/{tank_id}  → trend, STL, weekday/weekend
GET /api/anomalies/{tank_id}  → detected anomalies
PATCH /api/anomalies/{anomaly_id} → update status (acknowledge/resolve)
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId
from ..database import get_db
from ..services.analytics import analyze, compare_periods
from ..services.anomaly_detector import detect_anomalies
from ..services.calculator import calculate
from ..dependencies import get_current_user

router = APIRouter(tags=["analytics"])


async def _get_readings(db, tank_id: str) -> list[dict]:
    cursor = db.readings.find({"tank_id": ObjectId(tank_id)}).sort("timestamp", 1)
    readings = []
    async for doc in cursor:
        readings.append({
            "timestamp": doc["timestamp"],
            "level_pct": doc.get("level_pct"),
            "volume_litres": doc.get("volume_litres"),
        })
    return readings


@router.get("/api/analytics/{tank_id}")
async def get_analytics(tank_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    tank = await db.tanks.find_one({"_id": ObjectId(tank_id), "owner_id": ObjectId(str(current_user["_id"]))})
    if not tank:
        raise HTTPException(404, "Tank not found")

    readings = await _get_readings(db, tank_id)
    capacity = tank.get("capacity_litres", 0.0)
    household = tank.get("household_size", 1)

    calc_result = calculate(tank_id, readings, capacity, household)
    analytics = analyze(tank_id, calc_result.daily_totals)

    return {
        "tank_id": tank_id,
        "trend": {
            "slope_litres_per_day": analytics.trend.slope_litres_per_day,
            "r_squared": analytics.trend.r_squared,
            "p_value": analytics.trend.p_value,
            "direction": analytics.trend.direction,
            "rolling_7d": analytics.trend.rolling_7d,
            "rolling_14d": analytics.trend.rolling_14d,
        } if analytics.trend else None,
        "weekday_weekend": {
            "weekday_mean": analytics.weekday_weekend.weekday_mean,
            "weekend_mean": analytics.weekday_weekend.weekend_mean,
            "p_value": analytics.weekday_weekend.p_value,
            "significant": analytics.weekday_weekend.significant,
        } if analytics.weekday_weekend else None,
        "stl": {
            "trend": analytics.stl.trend,
            "seasonal": analytics.stl.seasonal,
            "residual": analytics.stl.residual,
            "seasonal_strength": analytics.stl.seasonal_strength,
        } if analytics.stl else None,
    }


@router.get("/api/anomalies/{tank_id}")
async def get_anomalies(tank_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    tank = await db.tanks.find_one({"_id": ObjectId(tank_id), "owner_id": ObjectId(str(current_user["_id"]))})
    if not tank:
        raise HTTPException(404, "Tank not found")

    readings = await _get_readings(db, tank_id)
    capacity = tank.get("capacity_litres", 0.0)
    sensitivity = tank.get("prefs", {}).get("sensitivity", "medium") if isinstance(tank.get("prefs"), dict) else "medium"

    anomalies = detect_anomalies(tank_id, readings, capacity, sensitivity)

    # Persist newly detected anomalies to MongoDB Atlas
    for a in anomalies:
        ts_naive = a.timestamp.replace(tzinfo=None) if hasattr(a.timestamp, "tzinfo") and a.timestamp.tzinfo else a.timestamp
        end_ts_naive = a.end_timestamp.replace(tzinfo=None) if a.end_timestamp and hasattr(a.end_timestamp, "tzinfo") and a.end_timestamp.tzinfo else a.end_timestamp
        doc = {
            "tank_id": ObjectId(tank_id),
            "timestamp": ts_naive,
            "end_timestamp": end_ts_naive,
            "type": a.type,
            "severity": a.severity,
            "method": a.method,
            "score": a.score,
            "observed": a.observed,
            "expected": a.expected,
            "message": a.message,
            "status": "open",
        }
        await db.anomalies.update_one(
            {"tank_id": ObjectId(tank_id), "timestamp": ts_naive, "type": a.type},
            {"$setOnInsert": doc},
            upsert=True,
        )

    # Fetch all anomalies directly from database to reflect persisted statuses (acknowledged / resolved)
    cursor = db.anomalies.find({"tank_id": ObjectId(tank_id)}).sort("timestamp", -1)
    persisted = []
    async for doc in cursor:
        persisted.append({
            "id": str(doc["_id"]),
            "timestamp": doc["timestamp"].isoformat() if hasattr(doc["timestamp"], "isoformat") else str(doc["timestamp"]),
            "type": doc.get("type", "statistical_outlier"),
            "severity": doc.get("severity", "medium"),
            "method": doc.get("method", "detection"),
            "score": doc.get("score"),
            "observed": doc.get("observed"),
            "expected": doc.get("expected"),
            "message": doc.get("message", ""),
            "status": doc.get("status", "open"),
        })

    return {"tank_id": tank_id, "count": len(persisted), "anomalies": persisted}


@router.patch("/api/anomalies/status/{tank_id}")
async def update_anomaly_status(
    tank_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    tank = await db.tanks.find_one({"_id": ObjectId(tank_id), "owner_id": ObjectId(str(current_user["_id"]))})
    if not tank:
        raise HTTPException(404, "Tank not found")
    new_status = body.get("status")
    if new_status not in ("open", "acknowledged", "resolved"):
        raise HTTPException(400, "Invalid status")

    anom_id = body.get("id")
    if anom_id:
        try:
            res = await db.anomalies.update_one(
                {"_id": ObjectId(anom_id), "tank_id": ObjectId(tank_id)},
                {"$set": {"status": new_status}}
            )
            return {"updated": bool(res.modified_count or res.matched_count)}
        except Exception as e:
            pass

    ts = body.get("timestamp")
    atype = body.get("type")
    if not ts or not atype:
        raise HTTPException(400, "id or (timestamp and type) required")

    try:
        dt = datetime.fromisoformat(ts)
        dt_naive = dt.replace(tzinfo=None)
        q_time = {"$in": [dt, dt_naive]}
    except Exception:
        q_time = ts

    res = await db.anomalies.update_many(
        {"tank_id": ObjectId(tank_id), "type": atype, "timestamp": q_time},
        {"$set": {"status": new_status}}
    )
    return {"updated": bool(res.modified_count or res.matched_count)}
