"""
Validation endpoint: POST /api/validate/preview
Accepts raw rows as JSON and returns a full ValidationReport.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Any
from ..services.validator import validate_rows
from ..dependencies import get_current_user
from ..database import get_db
from bson import ObjectId

router = APIRouter(prefix="/api/validate", tags=["validate"])


class RawRow(BaseModel):
    timestamp: Optional[Any] = None
    level: Optional[Any] = None
    unit: Optional[str] = "percent"
    note: Optional[str] = None


class ValidateRequest(BaseModel):
    tank_id: str
    rows: list[RawRow]
    default_unit: str = "percent"
    interpolate_gaps: bool = True


@router.post("/preview")
async def validate_preview(body: ValidateRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    tank = await db.tanks.find_one({
        "_id": ObjectId(body.tank_id),
        "owner_id": ObjectId(str(current_user["_id"]))
    })
    if not tank:
        raise HTTPException(404, "Tank not found")

    height_cm = tank.get("dimensions", {}).get("height_cm", 0)
    raw_rows = [r.model_dump() for r in body.rows]
    report = validate_rows(raw_rows, body.tank_id, height_cm, body.default_unit, body.interpolate_gaps)
    return report.to_dict()
