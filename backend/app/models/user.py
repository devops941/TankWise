from datetime import datetime
from typing import Optional
from bson import ObjectId
from pydantic import BaseModel, Field, EmailStr

class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)

class UserInDB(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    email: str
    full_name: str
    password_hash: str
    role: str = "user"
    is_active: bool = True
    prefs: dict = Field(default_factory=lambda: {
        "default_units": "litres",
        "timezone": "UTC",
        "sensitivity": "medium"
    })
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
