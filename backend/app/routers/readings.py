from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Response
from datetime import datetime
from bson import ObjectId
import io, math
import pandas as pd
from ..database import get_db
from ..schemas.reading import ReadingCreate, ReadingOut, UploadPreviewResponse, UploadPreviewRow, BatchOut
from ..dependencies import get_current_user
from ..services.validator import validate_rows
from ..services.calculator import calculate
from ..services.anomaly_detector import detect_anomalies

router = APIRouter(prefix="/api/readings", tags=["readings"])

def _level_to_volume(level_pct: float, tank: dict) -> float:
    dims = tank.get("dimensions", {})
    shape = tank.get("shape", "cylindrical")
    if shape == "cylindrical":
        r = dims.get("diameter_cm", 0) / 2
        h = dims.get("height_cm", 0)
        cap = math.pi * r ** 2 * h / 1000
    else:
        l = dims.get("length_cm", 0)
        w = dims.get("width_cm", 0)
        h = dims.get("height_cm", 0)
        cap = l * w * h / 1000
    return round(cap * level_pct / 100, 2)

def _serialize_reading(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    doc["tank_id"] = str(doc["tank_id"])
    if doc.get("batch_id"):
        doc["batch_id"] = str(doc["batch_id"])
    return doc

@router.get("/{tank_id}", response_model=list[ReadingOut])
async def list_readings(tank_id: str, limit: int = 500, current_user: dict = Depends(get_current_user)):
    db = get_db()
    tank = await db.tanks.find_one({"_id": ObjectId(tank_id), "owner_id": ObjectId(str(current_user["_id"]))})
    if not tank:
        raise HTTPException(404, "Tank not found")
    cursor = db.readings.find({"tank_id": ObjectId(tank_id)}).sort("timestamp", -1).limit(limit)
    readings = []
    async for doc in cursor:
        readings.append(_serialize_reading(doc))
    return readings

@router.post("", response_model=ReadingOut, status_code=201)
async def create_reading(body: ReadingCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    tank = await db.tanks.find_one({"_id": ObjectId(body.tank_id), "owner_id": ObjectId(str(current_user["_id"]))})
    if not tank:
        raise HTTPException(404, "Tank not found")
    volume = _level_to_volume(body.level_pct, tank)
    doc = {
        "tank_id": ObjectId(body.tank_id),
        "timestamp": body.timestamp,
        "level_pct": body.level_pct,
        "volume_litres": volume,
        "raw_value": body.raw_value,
        "raw_unit": body.raw_unit,
        "flags": [],
        "source": body.source,
        "note": body.note,
        "batch_id": None,
    }
    result = await db.readings.insert_one(doc)
    created = await db.readings.find_one({"_id": result.inserted_id})
    return _serialize_reading(created)

@router.delete("/{reading_id}", status_code=204)
async def delete_reading(reading_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    reading = await db.readings.find_one({"_id": ObjectId(reading_id)})
    if not reading:
        raise HTTPException(404, "Reading not found")
    tank = await db.tanks.find_one({"_id": reading["tank_id"], "owner_id": ObjectId(str(current_user["_id"]))})
    if not tank:
        raise HTTPException(403, "Not authorized")
    await db.readings.delete_one({"_id": ObjectId(reading_id)})

@router.post("/upload/preview", response_model=UploadPreviewResponse)
async def upload_preview(
    tank_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    tank = await db.tanks.find_one({"_id": ObjectId(tank_id), "owner_id": ObjectId(str(current_user["_id"]))})
    if not tank:
        raise HTTPException(404, "Tank not found")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10 MB)")

    fmt = "csv"
    try:
        if file.filename.endswith(".xlsx") or file.filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(content))
            fmt = "xlsx"
        else:
            df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")

    # Auto-detect column mapping
    col_map = {}
    for col in df.columns:
        cl = col.lower().strip()
        if any(k in cl for k in ["time", "date", "ts"]):
            col_map["timestamp"] = col
        elif any(k in cl for k in ["level", "pct", "percent", "depth"]):
            col_map["level"] = col
        elif "unit" in cl:
            col_map["unit"] = col
        elif "note" in cl:
            col_map["note"] = col

    # Build rows for validator
    raw_rows = []
    for _, row in df.iterrows():
        raw_rows.append({
            "timestamp": row.get(col_map.get("timestamp", ""), None),
            "level": row.get(col_map.get("level", ""), None),
            "unit": str(row.get(col_map.get("unit", ""), "percent")) if col_map.get("unit") else "percent",
            "note": str(row.get(col_map.get("note", ""), "")) if col_map.get("note") else None,
        })

    from ..services.validator import validate_rows
    height_cm = tank.get("dimensions", {}).get("height_cm", 0)
    report = validate_rows(raw_rows, tank_id, height_cm)

    preview_rows = []
    for vrow in report.validated_rows[:50]:
        preview_rows.append(UploadPreviewRow(
            row=vrow.row,
            timestamp=str(vrow.timestamp) if vrow.timestamp else None,
            level_raw=str(vrow.raw_value) if vrow.raw_value is not None else None,
            level_pct=vrow.level_pct,
            status=vrow.status,
            issues=[i.code for i in vrow.issues],
        ))

    valid = report.rows_valid
    flagged = report.rows_flagged
    rejected = report.rows_rejected

    batch_doc = {
        "owner_id": ObjectId(str(current_user["_id"])),
        "tank_id": ObjectId(tank_id),
        "filename": file.filename,
        "format": fmt,
        "status": "previewed",
        "rows_total": len(df),
        "rows_valid": valid,
        "rows_flagged": flagged,
        "rows_rejected": rejected,
        "column_mapping": col_map,
        "issues_sample": [r.dict() for r in preview_rows[:5]],
        "created_at": datetime.utcnow(),
        "committed_at": None,
        "_raw_data": content.decode("latin-1") if fmt == "csv" else None,
    }
    result = await db.upload_batches.insert_one(batch_doc)

    return UploadPreviewResponse(
        batch_id=str(result.inserted_id),
        filename=file.filename,
        rows_total=len(df),
        rows_valid=valid,
        rows_flagged=flagged,
        rows_rejected=rejected,
        column_mapping=col_map,
        preview_rows=preview_rows,
    )

@router.get("/template/sample-csv")
async def get_csv_template():
    """Download a standardized CSV template for tank readings."""
    csv_content = (
        "timestamp,level_pct,note\n"
        "2026-11-01 06:00:00,95.0,morning baseline\n"
        "2026-11-01 12:00:00,82.0,midday draw\n"
        "2026-11-01 18:00:00,68.5,evening consumption\n"
        "2026-11-02 06:00:00,54.0,next morning reading\n"
        "2026-11-02 12:00:00,24.0,pre-refill low\n"
        "2026-11-02 13:00:00,98.0,refill pump cycle\n"
        "2026-11-03 06:00:00,85.0,morning normal\n"
        "2026-11-03 12:00:00,72.0,normal usage\n"
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="tankwise_sample_template.csv"'}
    )

@router.get("/samples/list")
async def list_sample_datasets():
    """List 3 ready-to-use benchmark datasets."""
    return [
        {
            "id": "domestic",
            "name": "Sample 1: Standard Domestic (30 Days)",
            "filename": "sample_1_standard_domestic_30days.csv",
            "description": "Realistic 30-day domestic consumption with 4-hourly readings, morning/evening peaks, and 8 automated pump refills.",
            "download_url": "/api/readings/samples/domestic"
        },
        {
            "id": "leak",
            "name": "Sample 2: Night Leak & Rapid Draw Anomaly",
            "filename": "sample_2_night_leak_anomaly.csv",
            "description": "Domestic tank telemetry featuring sustained night leaks (18-25 L/h between 22:00-05:00) and burst draw events for Module M5.",
            "download_url": "/api/readings/samples/leak"
        },
        {
            "id": "commercial",
            "name": "Sample 3: Commercial / Hostel High Draw",
            "filename": "sample_3_commercial_high_draw_30days.csv",
            "description": "High-throughput commercial cafeteria/hostel facility with rapid daytime consumption and daily refill cycles.",
            "download_url": "/api/readings/samples/commercial"
        }
    ]

@router.get("/samples/{sample_key}")
async def get_sample_dataset(sample_key: str):
    """Download one of the 3 scenario CSV datasets."""
    import os
    mapping = {
        "domestic": "sample_1_standard_domestic_30days.csv",
        "leak": "sample_2_night_leak_anomaly.csv",
        "commercial": "sample_3_commercial_high_draw_30days.csv",
        "sample-1": "sample_1_standard_domestic_30days.csv",
        "sample-2": "sample_2_night_leak_anomaly.csv",
        "sample-3": "sample_3_commercial_high_draw_30days.csv",
    }
    fname = mapping.get(sample_key.lower()) or mapping.get(sample_key.lower().replace("_", "-"))
    if not fname:
        if sample_key in mapping.values():
            fname = sample_key
        else:
            raise HTTPException(404, "Sample dataset not found")

    cur_dir = os.path.dirname(os.path.abspath(__file__)) # backend/app/routers
    backend_dir = os.path.dirname(os.path.dirname(cur_dir)) # backend
    root_dir = os.path.dirname(backend_dir) # project root

    candidates = [
        os.path.join(backend_dir, "static", "samples", fname),
        os.path.join(root_dir, "sample_datasets", fname),
        os.path.join(backend_dir, "sample_datasets", fname),
        os.path.join("static", "samples", fname),
        os.path.join("sample_datasets", fname),
    ]

    path = None
    for c in candidates:
        if os.path.exists(c):
            path = c
            break

    if not path:
        raise HTTPException(404, f"File {fname} not found on server")

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'}
    )

@router.post("/upload/commit/{batch_id}")
async def upload_commit(batch_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    batch = await db.upload_batches.find_one({"_id": ObjectId(batch_id), "owner_id": ObjectId(str(current_user["_id"]))})
    if not batch:
        raise HTTPException(404, "Batch not found")
    if batch["status"] != "previewed":
        raise HTTPException(400, "Batch already committed or discarded")

    tank_id = batch["tank_id"]
    tank = await db.tanks.find_one({"_id": tank_id})
    if not tank:
        raise HTTPException(404, "Associated tank not found")

    col_map = batch["column_mapping"]
    raw = batch.get("_raw_data")
    if not raw:
        raise HTTPException(400, "Raw data not available, re-upload")

    df = pd.read_csv(io.StringIO(raw))
    height_cm = tank.get("dimensions", {}).get("height_cm", 0.0)

    raw_rows = []
    for _, row in df.iterrows():
        raw_rows.append({
            "timestamp": row.get(col_map.get("timestamp", ""), None),
            "level": row.get(col_map.get("level", ""), None),
            "unit": str(row.get(col_map.get("unit", ""), "percent")) if col_map.get("unit") else "percent",
            "note": str(row.get(col_map.get("note", ""), "")) if col_map.get("note") else None,
        })

    report = validate_rows(raw_rows, str(tank_id), height_cm)

    inserted = 0
    readings_to_insert = []
    for vrow in report.validated_rows:
        if vrow.status in ("valid", "flagged") and vrow.timestamp and vrow.level_pct is not None:
            vol = _level_to_volume(vrow.level_pct, tank)
            flags = [i.code.lower() for i in vrow.issues if i.severity == "warning"]
            readings_to_insert.append({
                "tank_id": tank_id,
                "timestamp": vrow.timestamp,
                "level_pct": vrow.level_pct,
                "volume_litres": vol,
                "raw_value": vrow.raw_value if vrow.raw_value is not None else vrow.level_pct,
                "raw_unit": vrow.raw_unit or "percent",
                "flags": flags,
                "source": "upload",
                "note": vrow.issues[0].message if vrow.issues else None,
                "batch_id": ObjectId(batch_id),
                "created_at": datetime.utcnow(),
            })

    # Upsert each validated reading to safely handle duplicate timestamps
    for r in readings_to_insert:
        try:
            await db.readings.update_one(
                {"tank_id": tank_id, "timestamp": r["timestamp"]},
                {"$set": r},
                upsert=True
            )
            inserted += 1
        except Exception:
            pass

    # Mark batch committed
    await db.upload_batches.update_one(
        {"_id": ObjectId(batch_id)},
        {"$set": {"status": "committed", "committed_at": datetime.utcnow()}}
    )

    # Automatically Trigger Domain Calculations & Anomaly Detection
    cursor = db.readings.find({"tank_id": tank_id}).sort("timestamp", 1)
    all_readings = []
    async for doc in cursor:
        all_readings.append({
            "timestamp": doc["timestamp"],
            "level_pct": doc.get("level_pct", 0),
            "volume_litres": doc.get("volume_litres", 0),
        })

    capacity = tank.get("capacity_litres", 0.0)
    household = tank.get("household_size", 1)
    calc_res = calculate(str(tank_id), all_readings, capacity, household)
    anomalies = detect_anomalies(str(tank_id), all_readings, capacity, "medium")

    # Persist refill events
    for ev in calc_res.refill_events:
        await db.refill_events.update_one(
            {"tank_id": tank_id, "start_ts": ev.start_ts},
            {"$set": {
                "tank_id": tank_id,
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
            upsert=True
        )

    # Persist anomalies
    for a in anomalies:
        doc = {
            "tank_id": tank_id,
            "timestamp": a.timestamp,
            "end_timestamp": a.end_timestamp,
            "type": a.type,
            "severity": a.severity,
            "method": a.method,
            "score": a.score,
            "observed": a.observed,
            "expected": a.expected,
            "message": a.message,
            "status": a.status,
        }
        await db.anomalies.update_one(
            {"tank_id": tank_id, "timestamp": a.timestamp, "type": a.type},
            {"$setOnInsert": doc},
            upsert=True
        )

    # Cache analysis results
    await db.analysis_results.update_one(
        {"tank_id": tank_id},
        {"$set": {
            "tank_id": tank_id,
            "period_from": calc_res.period_from,
            "period_to": calc_res.period_to,
            "kpis": {
                "avg_daily_litres": calc_res.avg_daily_litres,
                "avg_rate_lph": calc_res.avg_rate_lph,
                "refills": calc_res.refill_count,
                "avg_interval_h": calc_res.avg_refill_interval_hours,
                "days_to_empty": calc_res.days_to_empty,
                "current_level_pct": calc_res.current_level_pct,
                "current_volume_litres": calc_res.current_volume_litres,
            },
            "computed_at": datetime.utcnow(),
        }},
        upsert=True
    )

    return {
        "committed": inserted,
        "batch_id": batch_id,
        "tank_name": tank.get("name"),
        "refills_detected": len(calc_res.refill_events),
        "anomalies_detected": len(anomalies),
        "avg_daily_litres": round(calc_res.avg_daily_litres, 1),
        "current_level_pct": round(calc_res.current_level_pct, 1) if calc_res.current_level_pct else None,
        "days_to_empty": round(calc_res.days_to_empty, 1) if calc_res.days_to_empty else None,
    }

@router.post("/upload/rollback/{batch_id}", status_code=204)
async def rollback_batch(batch_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    batch = await db.upload_batches.find_one({"_id": ObjectId(batch_id), "owner_id": ObjectId(str(current_user["_id"]))})
    if not batch:
        raise HTTPException(404, "Batch not found")
    await db.readings.delete_many({"batch_id": ObjectId(batch_id)})
    await db.upload_batches.update_one(
        {"_id": ObjectId(batch_id)},
        {"$set": {"status": "rolled_back"}}
    )

@router.get("/batches/{tank_id}", response_model=list[BatchOut])
async def list_batches(tank_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.upload_batches.find(
        {"tank_id": ObjectId(tank_id), "owner_id": ObjectId(str(current_user["_id"]))},
        {"_raw_data": 0}
    ).sort("created_at", -1)
    batches = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        doc["tank_id"] = str(doc["tank_id"])
        batches.append(doc)
    return batches
