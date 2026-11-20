"""
Calculation endpoint — triggers full calculation for a tank and caches results.
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId
from ..database import get_db
from ..services.calculator import calculate, RefillEvent
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/calc", tags=["calc"])


def _serialize_refill(e: RefillEvent) -> dict:
    return {
        "start_ts": e.start_ts.isoformat(),
        "end_ts": e.end_ts.isoformat(),
        "volume_before_litres": e.volume_before_litres,
        "volume_after_litres": e.volume_after_litres,
        "volume_added_litres": e.volume_added_litres,
        "duration_minutes": e.duration_minutes,
        "interval_since_prev_hours": e.interval_since_prev_hours,
    }


@router.get("/{tank_id}")
async def get_calc(
    tank_id: str,
    from_date: str = None,
    to_date: str = None,
    force_refresh: bool = False,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    tank = await db.tanks.find_one({
        "_id": ObjectId(tank_id),
        "owner_id": ObjectId(str(current_user["_id"]))
    })
    if not tank:
        raise HTTPException(404, "Tank not found")

    # Build query filter
    q: dict = {"tank_id": ObjectId(tank_id)}
    if from_date:
        q["timestamp"] = {"$gte": datetime.fromisoformat(from_date)}
    if to_date:
        q.setdefault("timestamp", {})["$lte"] = datetime.fromisoformat(to_date)

    cursor = db.readings.find(q).sort("timestamp", 1)
    readings = []
    async for doc in cursor:
        readings.append({
            "timestamp": doc["timestamp"],
            "level_pct": doc.get("level_pct"),
            "volume_litres": doc.get("volume_litres"),
        })

    capacity = tank.get("capacity_litres", 0.0)
    household_size = tank.get("household_size", 1)
    result = calculate(tank_id, readings, capacity, household_size)

    # Persist refill events (upsert by tank_id + start_ts)
    for ev in result.refill_events:
        await db.refill_events.update_one(
            {"tank_id": ObjectId(tank_id), "start_ts": ev.start_ts},
            {"$set": {
                "tank_id": ObjectId(tank_id),
                "start_ts": ev.start_ts,
                "end_ts": ev.end_ts,
                "volume_before_litres": ev.volume_before_litres,
                "volume_after_litres": ev.volume_after_litres,
                "volume_added_litres": ev.volume_added_litres,
                "duration_minutes": ev.duration_minutes,
                "interval_since_prev_hours": ev.interval_since_prev_hours,
                "detected_by": "auto",
                "created_at": datetime.utcnow(),
            }},
            upsert=True,
        )

    # Cache in analysis_results
    cache_doc = {
        "tank_id": ObjectId(tank_id),
        "period_from": result.period_from,
        "period_to": result.period_to,
        "kpis": {
            "avg_daily_litres": result.avg_daily_litres,
            "avg_rate_lph": result.avg_rate_lph,
            "refills": result.refill_count,
            "avg_interval_h": result.avg_refill_interval_hours,
            "days_to_empty": result.days_to_empty,
        },
        "computed_at": datetime.utcnow(),
    }
    await db.analysis_results.update_one(
        {"tank_id": ObjectId(tank_id)},
        {"$set": cache_doc},
        upsert=True,
    )

    return {
        "tank_id": tank_id,
        "tank_name": tank.get("name"),
        "period_from": result.period_from.isoformat() if result.period_from else None,
        "period_to": result.period_to.isoformat() if result.period_to else None,
        "kpis": {
            "avg_daily_litres": result.avg_daily_litres,
            "avg_rate_lph": result.avg_rate_lph,
            "refill_count": result.refill_count,
            "avg_refill_interval_hours": result.avg_refill_interval_hours,
            "days_to_empty": result.days_to_empty,
            "current_volume_litres": result.current_volume_litres,
            "current_level_pct": result.current_level_pct,
            "per_capita_daily_litres": result.per_capita_daily_litres,
        },
        "refill_events": [_serialize_refill(e) for e in result.refill_events],
        "daily_totals": result.daily_totals,
        "weekly_totals": result.weekly_totals,
    }
