from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional

from ..database import get_db
from ..dependencies import get_current_user
from ..services.weather_optimizer import (
    fetch_weather_forecast,
    compute_weather_impact,
    calculate_rainwater_catchment
)
from ..services.calculator import calculate

router = APIRouter(prefix="/api/weather", tags=["weather"])

@router.get("/forecast")
async def get_raw_weather(
    lat: float = Query(default=13.0827, ge=-90.0, le=90.0),
    lon: float = Query(default=80.2707, ge=-180.0, le=180.0),
    current_user: dict = Depends(get_current_user)
):
    """Returns 7-day raw weather forecast for given latitude and longitude."""
    forecast = await fetch_weather_forecast(lat, lon)
    return forecast

@router.get("/analysis/{tank_id}")
async def get_tank_weather_analysis(
    tank_id: str,
    roof_sqft: Optional[float] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Computes 7-day rainwater harvesting potential, temperature-driven consumption
    shifts, and smart refill advisories for a specific tank.
    """
    db = get_db()
    owner_id = ObjectId(str(current_user["_id"]))
    tank = await db.tanks.find_one({"_id": ObjectId(tank_id), "owner_id": owner_id})
    if not tank:
        raise HTTPException(404, "Tank not found")

    lat = float(tank.get("latitude", 13.0827))
    lon = float(tank.get("longitude", 80.2707))
    capacity = float(tank.get("capacity_litres", 1500.0))
    roof_area = float(roof_sqft or tank.get("roof_catchment_sqft", 800.0))

    # Fetch latest reading to know current level
    latest = await db.readings.find_one({"tank_id": tank["_id"]}, sort=[("timestamp", -1)])
    curr_level_pct = float(latest.get("level_pct", 50.0)) if latest else 50.0

    # Fetch recent average daily consumption
    cursor = db.readings.find({"tank_id": tank["_id"]}).sort("timestamp", 1).limit(300)
    readings = []
    async for r in cursor:
        readings.append(r)
    
    avg_daily_use = 350.0
    if len(readings) >= 2:
        try:
            calc_res = calculate(readings, capacity, tank.get("household_size", 1))
            if calc_res.avg_daily_litres > 0:
                avg_daily_use = calc_res.avg_daily_litres
        except Exception:
            pass

    forecast = await fetch_weather_forecast(lat, lon)
    analysis = compute_weather_impact(
        forecast_data=forecast,
        roof_area_sqft=roof_area,
        tank_capacity_litres=capacity,
        current_level_pct=curr_level_pct,
        avg_daily_consumption=avg_daily_use
    )

    return {
        "tank_id": tank_id,
        "tank_name": tank.get("name", "Tank"),
        "capacity_litres": capacity,
        "current_level_pct": curr_level_pct,
        "location": tank.get("location", ""),
        "coordinates": {"lat": lat, "lon": lon},
        **analysis
    }

@router.post("/simulate-rain/{tank_id}")
async def simulate_rain_harvest(
    tank_id: str,
    rainfall_mm: float = Query(default=25.0, ge=1.0, le=200.0),
    current_user: dict = Depends(get_current_user)
):
    """
    Simulates a heavy downpour and injects a sensor reading showing
    water level rise from rainwater harvesting. Great for viva demonstration!
    """
    db = get_db()
    owner_id = ObjectId(str(current_user["_id"]))
    tank = await db.tanks.find_one({"_id": ObjectId(tank_id), "owner_id": owner_id})
    if not tank:
        raise HTTPException(404, "Tank not found")

    capacity = float(tank.get("capacity_litres", 1500.0))
    roof_sqft = float(tank.get("roof_catchment_sqft", 800.0))

    harvest_liters = calculate_rainwater_catchment(roof_sqft, rainfall_mm)
    added_pct = (harvest_liters / capacity) * 100.0

    latest = await db.readings.find_one({"tank_id": tank["_id"]}, sort=[("timestamp", -1)])
    prev_level = float(latest.get("level_pct", 40.0)) if latest else 40.0
    new_level = min(100.0, round(prev_level + added_pct, 1))
    new_vol = round((new_level / 100.0) * capacity, 2)

    # Insert simulated reading
    doc = {
        "tank_id": tank["_id"],
        "timestamp": datetime.now(timezone.utc),
        "level_pct": new_level,
        "volume_litres": new_vol,
        "raw_value": new_level,
        "raw_unit": "%",
        "flags": ["rainwater_harvest_inflow"],
        "source": "sensor_simulation",
        "note": f"🌧️ Rainwater Harvesting: +{round(harvest_liters, 1)}L ({rainfall_mm}mm rain on {int(roof_sqft)} sq.ft roof)",
        "batch_id": None,
    }
    await db.readings.insert_one(doc)

    return {
        "status": "success",
        "rainfall_mm": rainfall_mm,
        "harvest_liters": round(harvest_liters, 1),
        "previous_level_pct": prev_level,
        "new_level_pct": new_level,
        "message": f"Successfully simulated {rainfall_mm}mm rain inflow! Added {round(harvest_liters, 1)}L to {tank['name']}."
    }
