from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field

class TankInDB(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    owner_id: str
    name: str
    location: str = ""
    shape: Literal["cylindrical", "rectangular"] = "cylindrical"
    dimensions: dict = Field(default_factory=dict)
    capacity_litres: float = 0.0
    sensor_mode: Literal["depth", "ullage"] = "depth"
    sensor_height_cm: float = 0.0
    low_threshold_pct: float = 20.0
    high_threshold_pct: float = 90.0
    household_size: int = 1
    roof_catchment_sqft: float = 800.0
    latitude: float = 13.0827
    longitude: float = 80.2707
    rainwater_harvesting_enabled: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
