from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId
from ..database import get_db
from ..schemas.tank import TankCreate, TankUpdate, TankOut
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/tanks", tags=["tanks"])

def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    doc["owner_id"] = str(doc["owner_id"])
    return doc

@router.get("", response_model=list[TankOut])
async def list_tanks(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.tanks.find({"owner_id": ObjectId(str(current_user["_id"]))})
    tanks = []
    async for doc in cursor:
        tanks.append(_serialize(doc))
    return tanks

@router.post("", response_model=TankOut, status_code=201)
async def create_tank(body: TankCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    owner_id = ObjectId(str(current_user["_id"]))
    existing = await db.tanks.find_one({"owner_id": owner_id, "name": body.name})
    if existing:
        raise HTTPException(status_code=409, detail="Tank name already exists")
    capacity = body.compute_capacity()
    doc = {
        **body.model_dump(),
        "owner_id": owner_id,
        "capacity_litres": capacity,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await db.tanks.insert_one(doc)
    created = await db.tanks.find_one({"_id": result.inserted_id})
    return _serialize(created)

@router.get("/{tank_id}", response_model=TankOut)
async def get_tank(tank_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.tanks.find_one({
        "_id": ObjectId(tank_id),
        "owner_id": ObjectId(str(current_user["_id"]))
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Tank not found")
    return _serialize(doc)

@router.put("/{tank_id}", response_model=TankOut)
async def update_tank(tank_id: str, body: TankUpdate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "dimensions" in updates or "shape" in updates:
        tank = await db.tanks.find_one({"_id": ObjectId(tank_id)})
        if tank:
            shape = updates.get("shape", tank.get("shape", "cylindrical"))
            dims = updates.get("dimensions", tank.get("dimensions", {}))
            import math
            if shape == "cylindrical":
                r = dims.get("diameter_cm", 0) / 2
                h = dims.get("height_cm", 0)
                updates["capacity_litres"] = round(math.pi * r ** 2 * h / 1000, 2)
            elif shape == "rectangular":
                l = dims.get("length_cm", 0)
                w = dims.get("width_cm", 0)
                h = dims.get("height_cm", 0)
                updates["capacity_litres"] = round(l * w * h / 1000, 2)
    updates["updated_at"] = datetime.utcnow()
    result = await db.tanks.find_one_and_update(
        {"_id": ObjectId(tank_id), "owner_id": ObjectId(str(current_user["_id"]))},
        {"$set": updates},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Tank not found")
    return _serialize(result)

@router.delete("/{tank_id}", status_code=204)
async def delete_tank(tank_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    owner_id = ObjectId(str(current_user["_id"]))
    result = await db.tanks.delete_one({"_id": ObjectId(tank_id), "owner_id": owner_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tank not found")
    # Cascading delete
    await db.readings.delete_many({"tank_id": ObjectId(tank_id)})
    await db.refill_events.delete_many({"tank_id": ObjectId(tank_id)})
    await db.anomalies.delete_many({"tank_id": ObjectId(tank_id)})
    await db.analysis_results.delete_many({"tank_id": ObjectId(tank_id)})
