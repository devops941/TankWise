from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime

class ReadingCreate(BaseModel):
    tank_id: str
    timestamp: datetime
    level_pct: float = Field(ge=0, le=100)
    raw_value: Optional[float] = None
    raw_unit: Optional[str] = None
    source: Literal["manual", "upload", "api"] = "manual"
    note: Optional[str] = None

class ReadingOut(BaseModel):
    id: str
    tank_id: str
    timestamp: datetime
    level_pct: float
    volume_litres: float
    raw_value: Optional[float] = None
    raw_unit: Optional[str] = None
    flags: List[str] = Field(default_factory=list)
    source: str = "manual"
    note: Optional[str] = None
    batch_id: Optional[str] = None

class UploadPreviewRow(BaseModel):
    row: int
    timestamp: Optional[str]
    level_raw: Optional[str]
    level_pct: Optional[float]
    status: Literal["valid", "flagged", "rejected"]
    issues: List[str]

class UploadPreviewResponse(BaseModel):
    batch_id: str
    filename: str
    rows_total: int
    rows_valid: int
    rows_flagged: int
    rows_rejected: int
    column_mapping: dict
    preview_rows: List[UploadPreviewRow]

class BatchOut(BaseModel):
    id: str
    tank_id: str
    filename: str
    format: str
    status: str
    rows_total: int
    rows_valid: int
    rows_flagged: int
    rows_rejected: int
    created_at: datetime
    committed_at: Optional[datetime]
