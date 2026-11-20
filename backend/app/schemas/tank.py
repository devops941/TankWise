from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
import math

class TankCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    location: str = ""
    shape: Literal["cylindrical", "rectangular"] = "cylindrical"
    dimensions: dict = Field(default_factory=dict)
    sensor_mode: Literal["depth", "ullage"] = "depth"
    sensor_height_cm: float = Field(default=0.0, ge=0)
    low_threshold_pct: float = Field(default=20.0, ge=0, le=100)
    high_threshold_pct: float = Field(default=90.0, ge=0, le=100)
    household_size: int = Field(default=1, ge=1)
    roof_catchment_sqft: float = Field(default=800.0, ge=0.0)
    latitude: float = Field(default=13.0827)
    longitude: float = Field(default=80.2707)
    rainwater_harvesting_enabled: bool = Field(default=True)

    def compute_capacity(self) -> float:
        d = self.dimensions
        if self.shape == "cylindrical":
            r = d.get("diameter_cm", 0) / 2
            h = d.get("height_cm", 0)
            return round(math.pi * r ** 2 * h / 1000, 2)  # cm³ → litres
        elif self.shape == "rectangular":
            l = d.get("length_cm", 0)
            w = d.get("width_cm", 0)
            h = d.get("height_cm", 0)
            return round(l * w * h / 1000, 2)
        return 0.0

class TankUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    shape: Optional[Literal["cylindrical", "rectangular"]] = None
    dimensions: Optional[dict] = None
    sensor_mode: Optional[Literal["depth", "ullage"]] = None
    sensor_height_cm: Optional[float] = None
    low_threshold_pct: Optional[float] = None
    high_threshold_pct: Optional[float] = None
    household_size: Optional[int] = None
    roof_catchment_sqft: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rainwater_harvesting_enabled: Optional[bool] = None

class TankOut(BaseModel):
    id: str
    owner_id: str
    name: str
    location: str
    shape: str
    dimensions: dict
    capacity_litres: float
    sensor_mode: str
    sensor_height_cm: float
    low_threshold_pct: float
    high_threshold_pct: float
    household_size: int
    roof_catchment_sqft: float = 800.0
    latitude: float = 13.0827
    longitude: float = 80.2707
    rainwater_harvesting_enabled: bool = True
    created_at: datetime
    updated_at: datetime
