"""
Weather-Aware Predictive Demand & Rainwater Harvesting Optimization Engine.
Integrates Open-Meteo Weather Forecast (with offline resilience)
to calculate rainwater yield, weather-adjusted consumption multipliers,
and actionable tanker refill advisories.
"""
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
import logging
import httpx

logger = logging.getLogger(__name__)

# WMO Weather interpretation codes
WEATHER_DESCRIPTIONS = {
    0: {"label": "Clear Sky", "icon": "sun", "is_rainy": False},
    1: {"label": "Mainly Clear", "icon": "sun", "is_rainy": False},
    2: {"label": "Partly Cloudy", "icon": "cloud-sun", "is_rainy": False},
    3: {"label": "Overcast", "icon": "cloud", "is_rainy": False},
    45: {"label": "Foggy", "icon": "cloud-fog", "is_rainy": False},
    51: {"label": "Light Drizzle", "icon": "cloud-drizzle", "is_rainy": True},
    53: {"label": "Moderate Drizzle", "icon": "cloud-drizzle", "is_rainy": True},
    61: {"label": "Slight Rain", "icon": "cloud-rain", "is_rainy": True},
    63: {"label": "Moderate Rain", "icon": "cloud-rain", "is_rainy": True},
    65: {"label": "Heavy Rain", "icon": "cloud-rain", "is_rainy": True},
    80: {"label": "Rain Showers", "icon": "cloud-rain", "is_rainy": True},
    81: {"label": "Heavy Showers", "icon": "cloud-rain", "is_rainy": True},
    95: {"label": "Thunderstorm", "icon": "cloud-lightning", "is_rainy": True},
}

def _get_fallback_forecast(lat: float, lon: float) -> Dict[str, Any]:
    """Generates a realistic 7-day weather dataset when network is unavailable."""
    now = datetime.now(timezone.utc)
    dates = [(now + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    # Mix of summer and a rainy day on day 2 & 3
    return {
        "daily": {
            "time": dates,
            "weather_code": [1, 2, 63, 65, 2, 0, 1],
            "temperature_2m_max": [34.5, 33.0, 28.5, 27.0, 31.0, 33.5, 35.0],
            "temperature_2m_min": [25.0, 24.5, 22.0, 21.5, 23.0, 24.0, 25.5],
            "precipitation_sum": [0.0, 2.5, 18.0, 32.5, 4.0, 0.0, 0.0],
            "precipitation_probability_max": [10, 40, 85, 95, 35, 10, 5],
        }
    }

async def fetch_weather_forecast(lat: float = 13.0827, lon: float = 80.2707) -> Dict[str, Any]:
    """Fetches 7-day weather forecast from Open-Meteo, falling back gracefully if offline."""
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,"
        f"precipitation_sum,precipitation_probability_max&timezone=auto"
    )
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.warning("Open-Meteo API unreachable or sandbox offline: %s. Using simulation fallback.", e)
    
    return _get_fallback_forecast(lat, lon)

def calculate_rainwater_catchment(roof_area_sqft: float, rainfall_mm: float, runoff_efficiency: float = 0.85) -> float:
    """
    Standard Rainwater Harvesting Catchment Equation:
    Harvest (Litres) = Roof Area (sq.m) * Rainfall (mm) * Runoff Coefficient (typically 0.80 - 0.90)
    1 mm of rain on 1 sq.m = 1 Litre
    """
    roof_area_sqm = roof_area_sqft * 0.092903
    harvest_liters = roof_area_sqm * rainfall_mm * runoff_efficiency
    return round(max(0.0, harvest_liters), 2)

def compute_weather_impact(
    forecast_data: Dict[str, Any],
    roof_area_sqft: float,
    tank_capacity_litres: float,
    current_level_pct: float,
    avg_daily_consumption: float = 350.0
) -> Dict[str, Any]:
    """
    Computes 7-day rainwater inflows, temperature-adjusted consumption multipliers,
    and smart actionable refill advisories.
    """
    daily = forecast_data.get("daily", {})
    times = daily.get("time", [])
    weather_codes = daily.get("weather_code", [])
    max_temps = daily.get("temperature_2m_max", [])
    min_temps = daily.get("temperature_2m_min", [])
    rain_sums = daily.get("precipitation_sum", [])
    rain_probs = daily.get("precipitation_probability_max", [])

    forecast_days: List[Dict[str, Any]] = []
    total_expected_rain_mm = 0.0
    total_rainwater_harvest_litres = 0.0

    for i in range(len(times)):
        date_str = times[i]
        code = weather_codes[i] if i < len(weather_codes) else 0
        w_info = WEATHER_DESCRIPTIONS.get(code, {"label": "Partly Cloudy", "icon": "cloud-sun", "is_rainy": False})
        
        t_max = max_temps[i] if i < len(max_temps) else 30.0
        t_min = min_temps[i] if i < len(min_temps) else 24.0
        r_sum = rain_sums[i] if i < len(rain_sums) else 0.0
        r_prob = rain_probs[i] if i < len(rain_probs) else 0

        # Calculate potential harvest for this day
        day_harvest = calculate_rainwater_catchment(roof_area_sqft, r_sum)
        total_expected_rain_mm += r_sum
        total_rainwater_harvest_litres += day_harvest

        # Temperature-adjusted consumption factor
        # Baseline = 30°C. For every +5°C, consumption rises ~10%. Cool/rainy drops ~10%.
        if t_max >= 36.0:
            demand_multiplier = 1.25
        elif t_max >= 33.0:
            demand_multiplier = 1.12
        elif r_sum >= 5.0 or t_max <= 26.0:
            demand_multiplier = 0.90
        else:
            demand_multiplier = 1.0

        forecast_days.append({
            "date": date_str,
            "weather_label": w_info["label"],
            "weather_icon": w_info["icon"],
            "temp_max_c": t_max,
            "temp_min_c": t_min,
            "rainfall_mm": r_sum,
            "rain_probability_pct": r_prob,
            "predicted_harvest_litres": day_harvest,
            "demand_multiplier": demand_multiplier,
            "predicted_consumption_litres": round(avg_daily_consumption * demand_multiplier, 1)
        })

    # Economic & sustainability calculation (₹ 0.15 / L saved vs commercial water)
    cost_per_liter = 0.15
    estimated_money_saved = round(total_rainwater_harvest_litres * cost_per_liter, 2)

    # Next 48h rain sum for quick advisory
    next_48h_rain = sum(d["rainfall_mm"] for d in forecast_days[:2])
    next_48h_harvest = sum(d["predicted_harvest_litres"] for d in forecast_days[:2])

    current_volume = (current_level_pct / 100.0) * tank_capacity_litres
    space_remaining_litres = max(0.0, tank_capacity_litres - current_volume)

    # Intelligent Refill Advisory logic
    advisory_action = "NORMAL"
    advisory_type = "info"
    advisory_title = "Stable Weather & Water Outlook"
    advisory_message = "Water usage is normal. Tanker refill can be scheduled per standard schedule."

    if next_48h_rain >= 15.0 and next_48h_harvest >= 250.0:
        if space_remaining_litres >= 200.0:
            advisory_action = "DELAY_REFILL"
            advisory_type = "success"
            advisory_title = "🌧️ High Rainfall Incoming: Delay Tanker Refill!"
            advisory_message = (
                f"Rainfall of ~{round(next_48h_rain, 1)} mm is forecasted in the next 48 hours. "
                f"Your {int(roof_area_sqft)} sq.ft roof is expected to yield ~{int(next_48h_harvest)} Litres of clean rainwater. "
                f"Hold off ordering a water tanker to save approximately ₹{int(next_48h_harvest * cost_per_liter)}!"
            )
        else:
            advisory_action = "RAIN_OVERFLOW_RISK"
            advisory_type = "warning"
            advisory_title = "⚠️ Tank Almost Full Before Rain"
            advisory_message = (
                f"Heavy rain expected (~{int(next_48h_harvest)}L inflow), but tank has only {int(space_remaining_litres)}L capacity left. "
                f"Excess rainwater will divert to recharge pit or overflow."
            )
    elif current_level_pct <= 20.0:
        advisory_action = "BOOK_TANKER"
        advisory_type = "danger"
        advisory_title = "🚨 Low Water Level & Dry Forecast"
        advisory_message = (
            f"Tank is at {round(current_level_pct, 1)}% with no significant rainfall expected soon. "
            f"Book a refill tanker promptly to prevent running dry."
        )

    return {
        "roof_area_sqft": roof_area_sqft,
        "total_7day_rainfall_mm": round(total_expected_rain_mm, 1),
        "total_7day_harvest_litres": round(total_rainwater_harvest_litres, 1),
        "tank_capacity_fill_pct": round(min(100.0, (total_rainwater_harvest_litres / max(1.0, tank_capacity_litres)) * 100), 1),
        "estimated_money_saved_inr": estimated_money_saved,
        "advisory": {
            "action": advisory_action,
            "type": advisory_type,
            "title": advisory_title,
            "message": advisory_message,
            "next_48h_rain_mm": round(next_48h_rain, 1),
            "next_48h_harvest_litres": round(next_48h_harvest, 1),
        },
        "daily_forecast": forecast_days
    }
