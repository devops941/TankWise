"""
Demo Data Seeding Router for TankWise (Module M8 / Quick Start)
Instantly creates 'Terrace-01' with 30 days of realistic readings, refills, and anomalies.
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import math, random

from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/seed", tags=["seed"])


@router.post("/demo-tank")
async def seed_demo_tank(current_user: dict = Depends(get_current_user)):
    db = get_db()
    owner_id = ObjectId(str(current_user["_id"]))

    # 1. Create or retrieve Terrace-01
    existing = await db.tanks.find_one({"owner_id": owner_id, "name": "Terrace-01"})
    if existing:
        tank_id = existing["_id"]
        # Clear existing readings for fresh demo seed
        await db.readings.delete_many({"tank_id": tank_id})
        await db.refill_events.delete_many({"tank_id": tank_id})
        await db.anomalies.delete_many({"tank_id": tank_id})
        await db.analysis_results.delete_many({"tank_id": tank_id})
    else:
        # Cylindrical tank: diameter 120 cm, height 150 cm -> 1696.46 L
        dims = {"diameter_cm": 120.0, "height_cm": 150.0}
        cap = round(math.pi * (60.0 ** 2) * 150.0 / 1000.0, 2)
        doc = {
            "owner_id": owner_id,
            "name": "Terrace-01",
            "location": "Rooftop Block A",
            "shape": "cylindrical",
            "dimensions": dims,
            "capacity_litres": cap,
            "sensor_mode": "depth",
            "sensor_height_cm": 0.0,
            "low_threshold_pct": 20.0,
            "high_threshold_pct": 95.0,
            "household_size": 4,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        res = await db.tanks.insert_one(doc)
        tank_id = res.inserted_id

    # 2. Generate 30 days of realistic 4-hourly readings
    # Capacity = 1696 L. Daily draw = ~410 L (approx 24% per day)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start_time = now - timedelta(days=30)
    readings = []

    current_level_pct = 95.0
    cap = 1696.46

    t = start_time
    refill_count = 0

    while t <= now:
        hour = t.hour
        weekday = t.weekday()

        # Drawdown depending on time of day
        if 6 <= hour < 10:
            draw_pct = random.uniform(5.5, 7.5) # Morning bath & cooking
        elif 10 <= hour < 17:
            draw_pct = random.uniform(2.0, 3.5) # Daytime
        elif 17 <= hour < 22:
            draw_pct = random.uniform(4.5, 6.0) # Evening cooking & wash
        else:
            # Night time: normally near 0, but introduce leak on days 20-23
            days_ago = (now - t).days
            if 7 <= days_ago <= 10:
                draw_pct = random.uniform(3.0, 4.5) # Anomaly: running float valve / night leak!
            else:
                draw_pct = random.uniform(0.1, 0.6) # Normal minimal night loss

        # Weekend usage +15%
        if weekday in (5, 6):
            draw_pct *= 1.15

        current_level_pct -= draw_pct

        # Refill trigger: if level drops below 25%, pump kicks in
        if current_level_pct < 25.0:
            refill_count += 1
            # Add a reading right before refill
            vol = round(cap * (current_level_pct / 100.0), 2)
            readings.append({
                "tank_id": tank_id,
                "timestamp": t,
                "level_pct": round(current_level_pct, 1),
                "volume_litres": vol,
                "raw_value": round(current_level_pct, 1),
                "raw_unit": "percent",
                "flags": ["low_threshold"] if current_level_pct < 20 else [],
                "source": "sensor",
                "note": "Pre-refill low level",
                "created_at": t,
            })
            # Advance 45 minutes for refill completion
            t_refill = t + timedelta(minutes=45)
            current_level_pct = random.uniform(92.0, 98.0)
            vol_after = round(cap * (current_level_pct / 100.0), 2)
            readings.append({
                "tank_id": tank_id,
                "timestamp": t_refill,
                "level_pct": round(current_level_pct, 1),
                "volume_litres": vol_after,
                "raw_value": round(current_level_pct, 1),
                "raw_unit": "percent",
                "flags": ["refill"],
                "source": "sensor",
                "note": "Pumping completed",
                "created_at": t_refill,
            })
        else:
            vol = round(cap * (current_level_pct / 100.0), 2)
            flags = []
            if current_level_pct < 20:
                flags.append("low_threshold")
            readings.append({
                "tank_id": tank_id,
                "timestamp": t,
                "level_pct": round(current_level_pct, 1),
                "volume_litres": vol,
                "raw_value": round(current_level_pct, 1),
                "raw_unit": "percent",
                "flags": flags,
                "source": "sensor",
                "note": "Normal reading",
                "created_at": t,
            })

        t += timedelta(hours=4)

    if readings:
        await db.readings.insert_many(readings)

    # Seed sample refill orders for the Refill Hub inside existing refill_events
    await db.refill_events.delete_many({"tank_id": tank_id, "doc_type": "refill_order"})
    sample_orders = [
        {
            "doc_type": "refill_order",
            "tank_id": tank_id,
            "tank_name": "Terrace-01",
            "owner_id": owner_id,
            "vendor_id": None,
            "vendor_name": "Cauvery Express Water Tankers",
            "vendor_phone": "+91 98401 23456",
            "vendor_email": "gokulnath2k24@gmail.com",
            "liters_ordered": 4000.0,
            "cost": 850.0,
            "order_status": "VERIFIED",
            "pre_refill_level_pct": 19.0,
            "post_refill_level_pct": 94.5,
            "verified_by_sensor": True,
            "volume_verified_liters": 4000.0,
            "notes": "Delivered on schedule. Sensor level spike confirmed.",
            "requested_at": now - timedelta(days=12),
            "completed_at": now - timedelta(days=12, hours=-3),
        },
        {
            "doc_type": "refill_order",
            "tank_id": tank_id,
            "tank_name": "Terrace-01",
            "owner_id": owner_id,
            "vendor_id": None,
            "vendor_name": "Metro Smart Aqua Supply",
            "vendor_phone": "+91 94440 98765",
            "vendor_email": "gokulnath2k24@gmail.com",
            "liters_ordered": 3000.0,
            "cost": 600.0,
            "order_status": "DELIVERED",
            "pre_refill_level_pct": 21.0,
            "post_refill_level_pct": 88.0,
            "verified_by_sensor": True,
            "volume_verified_liters": 3000.0,
            "notes": "Emergency morning top-up.",
            "requested_at": now - timedelta(days=4),
            "completed_at": now - timedelta(days=4, hours=-2),
        }
    ]
    await db.refill_events.insert_many(sample_orders)

    return {
        "success": True,
        "tank_id": str(tank_id),
        "tank_name": "Terrace-01",
        "readings_seeded": len(readings),
        "refills_simulated": refill_count,
        "period_days": 30
    }
