from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from typing import Optional

from ..database import get_db
from ..dependencies import get_current_user
from ..services.email_service import send_refill_order_email
from ..schemas.refill import (
    VendorCreate, VendorOut,
    RefillOrderCreate, RefillOrderStatusUpdate, RefillOrderOut, RefillExpenseSummary
)

router = APIRouter(prefix="/api/refills", tags=["refills"])

def _serialize_id(doc: dict) -> dict:
    if not doc:
        return {}
    res = dict(doc)
    res.pop("doc_type", None)
    if "_id" in res:
        res["id"] = str(res.pop("_id"))
    if "owner_id" in res:
        res["owner_id"] = str(res["owner_id"])
    if "tank_id" in res and res["tank_id"]:
        res["tank_id"] = str(res["tank_id"])
    if "vendor_id" in res and res["vendor_id"]:
        res["vendor_id"] = str(res["vendor_id"])
    return res

DEFAULT_VENDORS = [
    {
        "name": "Cauvery Express Water Tankers",
        "phone": "+91 98401 23456",
        "email": "gokulnath2k24@gmail.com",
        "vendor_type": "tanker",
        "capacity_liters": 6000.0,
        "price_per_trip": 850.0,
        "avg_delivery_hours": 2.5,
        "rating": 4.9,
        "is_active": True,
    },
    {
        "name": "Metro Smart Aqua Supply",
        "phone": "+91 94440 98765",
        "email": "gokulnath2k24@gmail.com",
        "vendor_type": "tanker",
        "capacity_liters": 4000.0,
        "price_per_trip": 600.0,
        "avg_delivery_hours": 3.0,
        "rating": 4.7,
        "is_active": True,
    },
    {
        "name": "City Municipal Bulk Supply",
        "phone": "1916 (Toll-Free)",
        "email": "gokulnath2k24@gmail.com",
        "vendor_type": "municipal",
        "capacity_liters": 9000.0,
        "price_per_trip": 450.0,
        "avg_delivery_hours": 12.0,
        "rating": 4.2,
        "is_active": True,
    },
]

@router.get("/vendors", response_model=list[VendorOut])
async def list_vendors(current_user: dict = Depends(get_current_user)):
    db = get_db()
    owner_id = ObjectId(str(current_user["_id"]))
    
    # Store vendors in existing refill_events collection to avoid Atlas 500-collection limit
    count = await db.refill_events.count_documents({"owner_id": owner_id, "doc_type": "vendor"})
    if count == 0:
        for v in DEFAULT_VENDORS:
            await db.refill_events.insert_one({
                **v,
                "doc_type": "vendor",
                "owner_id": owner_id,
                "created_at": datetime.now(timezone.utc)
            })

    cursor = db.refill_events.find({"owner_id": owner_id, "doc_type": "vendor"}).sort("rating", -1)
    vendors = []
    async for doc in cursor:
        vendors.append(_serialize_id(doc))
    return vendors

@router.post("/vendors", response_model=VendorOut, status_code=201)
async def create_vendor(body: VendorCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    owner_id = ObjectId(str(current_user["_id"]))
    doc = {
        **body.model_dump(),
        "doc_type": "vendor",
        "owner_id": owner_id,
        "created_at": datetime.now(timezone.utc)
    }
    res = await db.refill_events.insert_one(doc)
    created = await db.refill_events.find_one({"_id": res.inserted_id})
    return _serialize_id(created)

@router.delete("/vendors/{vendor_id}", status_code=204)
async def delete_vendor(vendor_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    owner_id = ObjectId(str(current_user["_id"]))
    res = await db.refill_events.delete_one({"_id": ObjectId(vendor_id), "owner_id": owner_id, "doc_type": "vendor"})
    if res.deleted_count == 0:
        raise HTTPException(404, "Vendor not found")

@router.get("/orders", response_model=list[RefillOrderOut])
async def list_refill_orders(
    tank_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    owner_id = ObjectId(str(current_user["_id"]))
    query = {"owner_id": owner_id, "doc_type": "refill_order"}
    if tank_id:
        query["tank_id"] = ObjectId(tank_id)

    count = await db.refill_events.count_documents(query)
    if count == 0 and tank_id:
        # Seed a realistic historical delivered & verified refill order for demo
        tank = await db.tanks.find_one({"_id": ObjectId(tank_id)})
        tank_name = tank.get("name", "Water Tank") if tank else "Terrace-01"
        sample_order = {
            "doc_type": "refill_order",
            "tank_id": ObjectId(tank_id),
            "tank_name": tank_name,
            "owner_id": owner_id,
            "vendor_id": None,
            "vendor_name": "Cauvery Express Water Tankers",
            "vendor_phone": "+91 98401 23456",
            "vendor_email": "gokulnath2k24@gmail.com",
            "liters_ordered": 4000.0,
            "cost": 850.0,
            "order_status": "VERIFIED",
            "pre_refill_level_pct": 18.5,
            "post_refill_level_pct": 95.0,
            "verified_by_sensor": True,
            "volume_verified_liters": 4000.0,
            "notes": "Automated delivery when tank reached 18% reserve",
            "requested_at": datetime.now(timezone.utc) - timedelta(days=5),
            "completed_at": datetime.now(timezone.utc) - timedelta(days=5, hours=-2),
        }
        await db.refill_events.insert_one(sample_order)

    cursor = db.refill_events.find(query).sort("requested_at", -1)
    orders = []
    async for doc in cursor:
        orders.append(_serialize_id(doc))
    return orders

@router.post("/orders", response_model=RefillOrderOut, status_code=201)
async def create_refill_order(
    body: RefillOrderCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    owner_id = ObjectId(str(current_user["_id"]))
    tank = await db.tanks.find_one({"_id": ObjectId(body.tank_id), "owner_id": owner_id})
    if not tank:
        raise HTTPException(404, "Tank not found")

    vendor_name = "Self/Borewell Refill"
    vendor_phone = ""
    vendor_email = "gokulnath2k24@gmail.com"
    cost = body.cost
    if body.vendor_id:
        vendor = await db.refill_events.find_one({"_id": ObjectId(body.vendor_id), "owner_id": owner_id, "doc_type": "vendor"})
        if vendor:
            vendor_name = vendor.get("name", "Unknown Vendor")
            vendor_phone = vendor.get("phone", "")
            vendor_email = vendor.get("email") or "gokulnath2k24@gmail.com"
            if cost <= 0:
                cost = vendor.get("price_per_trip", 0.0)

    # Fetch latest reading to record pre-refill level
    latest_reading = await db.readings.find_one({"tank_id": tank["_id"]}, sort=[("timestamp", -1)])
    pre_level = latest_reading.get("level_pct", 0.0) if latest_reading else 0.0

    order_doc = {
        "doc_type": "refill_order",
        "tank_id": tank["_id"],
        "tank_name": tank.get("name", "Water Tank"),
        "owner_id": owner_id,
        "vendor_id": ObjectId(body.vendor_id) if body.vendor_id else None,
        "vendor_name": vendor_name,
        "vendor_phone": vendor_phone,
        "vendor_email": vendor_email,
        "liters_ordered": body.liters_ordered,
        "cost": float(cost),
        "order_status": "REQUESTED",
        "pre_refill_level_pct": pre_level,
        "post_refill_level_pct": None,
        "verified_by_sensor": False,
        "volume_verified_liters": None,
        "notes": body.notes,
        "requested_at": datetime.now(timezone.utc),
        "completed_at": None,
    }
    res = await db.refill_events.insert_one(order_doc)
    created = await db.refill_events.find_one({"_id": res.inserted_id})

    # Dispatch automated email alert in background
    customer_name = current_user.get("full_name") or current_user.get("email", "TankWise Resident")
    background_tasks.add_task(
        send_refill_order_email,
        to_email=vendor_email,
        vendor_name=vendor_name,
        tank_name=tank.get("name", "Water Tank"),
        tank_location=tank.get("location", ""),
        liters_ordered=body.liters_ordered,
        cost=float(cost),
        current_level_pct=pre_level,
        customer_name=customer_name,
        notes=body.notes or "",
        order_id=str(res.inserted_id),
    )

    return _serialize_id(created)

@router.patch("/orders/{order_id}/status", response_model=RefillOrderOut)
async def update_order_status(
    order_id: str,
    body: RefillOrderStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    owner_id = ObjectId(str(current_user["_id"]))
    order = await db.refill_events.find_one({"_id": ObjectId(order_id), "owner_id": owner_id, "doc_type": "refill_order"})
    if not order:
        raise HTTPException(404, "Order not found")

    update_fields = {"order_status": body.status}
    if body.notes is not None:
        update_fields["notes"] = body.notes

    if body.status in ["DELIVERED", "VERIFIED"] and not order.get("completed_at"):
        update_fields["completed_at"] = datetime.now(timezone.utc)

    updated = await db.refill_events.find_one_and_update(
        {"_id": ObjectId(order_id)},
        {"$set": update_fields},
        return_document=True
    )
    return _serialize_id(updated)

@router.post("/orders/{order_id}/verify", response_model=RefillOrderOut)
async def verify_order_with_sensor(order_id: str, current_user: dict = Depends(get_current_user)):
    """
    Checks if latest tank level jumped significantly compared to pre_refill_level_pct.
    If yes, marks order as VERIFIED and records post_level & added volume!
    """
    db = get_db()
    owner_id = ObjectId(str(current_user["_id"]))
    order = await db.refill_events.find_one({"_id": ObjectId(order_id), "owner_id": owner_id, "doc_type": "refill_order"})
    if not order:
        raise HTTPException(404, "Order not found")

    tank = await db.tanks.find_one({"_id": order["tank_id"]})
    if not tank:
        raise HTTPException(404, "Tank not found")

    capacity = tank.get("capacity_litres", 1000.0)
    pre_level = order.get("pre_refill_level_pct") or 0.0

    # Get latest reading
    latest_reading = await db.readings.find_one({"tank_id": order["tank_id"]}, sort=[("timestamp", -1)])
    curr_level = latest_reading.get("level_pct", 0.0) if latest_reading else 0.0

    level_increase = curr_level - pre_level
    volume_added = max(0.0, round((level_increase / 100.0) * capacity, 2))

    # If level increased by at least 15% or volume added > 200L, confirm verification
    is_verified = level_increase >= 15.0 or volume_added >= 200.0 or curr_level >= 75.0

    update_fields = {
        "post_refill_level_pct": curr_level,
        "volume_verified_liters": volume_added if volume_added > 0 else order["liters_ordered"],
        "verified_by_sensor": True if is_verified else False,
        "order_status": "VERIFIED" if is_verified else "DELIVERED",
        "completed_at": datetime.now(timezone.utc)
    }

    updated = await db.refill_events.find_one_and_update(
        {"_id": ObjectId(order_id)},
        {"$set": update_fields},
        return_document=True
    )
    return _serialize_id(updated)

@router.get("/expenses/{tank_id}", response_model=RefillExpenseSummary)
async def get_refill_expenses(tank_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    owner_id = ObjectId(str(current_user["_id"]))
    cursor = db.refill_events.find({
        "tank_id": ObjectId(tank_id),
        "owner_id": owner_id,
        "doc_type": "refill_order",
        "order_status": {"$in": ["DELIVERED", "VERIFIED", "REQUESTED", "IN_TRANSIT"]}
    }).sort("requested_at", 1)

    total_spent = 0.0
    total_liters = 0.0
    total_orders = 0
    verified_orders = 0
    monthly_map = {}

    async for o in cursor:
        cost = float(o.get("cost", 0.0))
        liters = float(o.get("liters_ordered", 0.0))
        total_spent += cost
        total_liters += liters
        total_orders += 1
        if o.get("verified_by_sensor"):
            verified_orders += 1

        dt = o.get("requested_at") or datetime.now(timezone.utc)
        month_key = dt.strftime("%b %Y")
        if month_key not in monthly_map:
            monthly_map[month_key] = {"month": month_key, "spent": 0.0, "liters": 0.0, "orders": 0}
        monthly_map[month_key]["spent"] += cost
        monthly_map[month_key]["liters"] += liters
        monthly_map[month_key]["orders"] += 1

    avg_cost_per_kL = (total_spent / (total_liters / 1000.0)) if total_liters > 0 else 0.0

    return RefillExpenseSummary(
        tank_id=tank_id,
        total_spent=round(total_spent, 2),
        total_liters_ordered=round(total_liters, 2),
        total_orders_count=total_orders,
        verified_orders_count=verified_orders,
        avg_cost_per_thousand_liters=round(avg_cost_per_kL, 2),
        monthly_spending=list(monthly_map.values())
    )
