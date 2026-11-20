from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class VendorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(default="")
    email: str = Field(default="")
    vendor_type: Literal["tanker", "municipal", "borewell", "other"] = "tanker"
    capacity_liters: float = Field(default=6000.0, ge=100.0)
    price_per_trip: float = Field(default=800.0, ge=0.0)
    avg_delivery_hours: float = Field(default=3.0, ge=0.5)
    rating: float = Field(default=4.8, ge=1.0, le=5.0)
    is_active: bool = True

class VendorOut(BaseModel):
    id: str
    owner_id: str
    name: str
    phone: str
    email: str = ""
    vendor_type: str
    capacity_liters: float
    price_per_trip: float
    avg_delivery_hours: float
    rating: float
    is_active: bool
    created_at: datetime

class RefillOrderCreate(BaseModel):
    tank_id: str
    vendor_id: Optional[str] = None
    liters_ordered: float = Field(ge=100.0)
    cost: float = Field(default=0.0, ge=0.0)
    notes: Optional[str] = ""

class RefillOrderStatusUpdate(BaseModel):
    status: Literal["REQUESTED", "IN_TRANSIT", "DELIVERED", "VERIFIED", "CANCELLED"]
    notes: Optional[str] = None

class RefillOrderOut(BaseModel):
    id: str
    tank_id: str
    tank_name: Optional[str] = ""
    owner_id: str
    vendor_id: Optional[str] = None
    vendor_name: str
    vendor_phone: Optional[str] = ""
    vendor_email: Optional[str] = ""
    liters_ordered: float
    cost: float
    order_status: str
    pre_refill_level_pct: Optional[float] = None
    post_refill_level_pct: Optional[float] = None
    verified_by_sensor: bool = False
    volume_verified_liters: Optional[float] = None
    notes: Optional[str] = ""
    requested_at: datetime
    completed_at: Optional[datetime] = None

class RefillExpenseSummary(BaseModel):
    tank_id: str
    total_spent: float
    total_liters_ordered: float
    total_orders_count: int
    verified_orders_count: int
    avg_cost_per_thousand_liters: float
    monthly_spending: list[dict]
