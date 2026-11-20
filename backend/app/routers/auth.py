from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timedelta
import bcrypt, random
from jose import jwt
from ..database import get_db
from ..schemas.auth import (
    RegisterRequest, LoginRequest, GoogleAuthRequest, TokenResponse,
    ForgotPasswordRequest, ResetPasswordRequest
)
from ..config import get_settings
from ..dependencies import get_current_user
from ..services.email_service import send_password_reset_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

def hash_password(password: str) -> str:
    pw_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pw_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(pw_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: dict) -> str:
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest):
    db = get_db()
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    
    user_doc = {
        "email": body.email.lower(),
        "full_name": body.full_name,
        "password_hash": hash_password(body.password),
        "role": "user",
        "is_active": True,
        "prefs": {"default_units": "litres", "timezone": "UTC", "sensitivity": "medium"},
        "created_at": datetime.utcnow(),
        "last_login_at": None,
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    token = create_access_token({"sub": user_id, "role": "user"})
    return TokenResponse(
        access_token=token,
        user_id=user_id,
        email=body.email.lower(),
        full_name=body.full_name,
        role="user"
    )

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    db = get_db()
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login_at": datetime.utcnow()}}
    )
    user_id = str(user["_id"])
    token = create_access_token({"sub": user_id, "role": user.get("role", "user")})
    return TokenResponse(
        access_token=token,
        user_id=user_id,
        email=user["email"],
        full_name=user["full_name"],
        role=user.get("role", "user")
    )

@router.post("/google", response_model=TokenResponse)
async def google_auth(body: GoogleAuthRequest):
    db = get_db()
    email = body.email
    full_name = body.full_name or "Google User"
    google_id = body.google_id
    avatar_url = body.avatar_url

    if body.credential:
        try:
            claims = jwt.get_unverified_claims(body.credential)
            email = claims.get("email") or email
            full_name = claims.get("name") or full_name
            google_id = claims.get("sub") or google_id
            avatar_url = claims.get("picture") or avatar_url
        except Exception:
            pass

    if not email:
        raise HTTPException(status_code=400, detail="Email is required for Google Sign-in")

    email = email.lower()
    user = await db.users.find_one({"email": email})

    if not user:
        user_doc = {
            "email": email,
            "full_name": full_name,
            "password_hash": None,
            "auth_provider": "google",
            "google_id": google_id,
            "avatar_url": avatar_url,
            "role": "user",
            "is_active": True,
            "prefs": {"default_units": "litres", "timezone": "UTC", "sensitivity": "medium"},
            "created_at": datetime.utcnow(),
            "last_login_at": datetime.utcnow(),
        }
        res = await db.users.insert_one(user_doc)
        user_id = str(res.inserted_id)
        role = "user"
    else:
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="Account disabled")
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "last_login_at": datetime.utcnow(),
                    "google_id": google_id or user.get("google_id"),
                    "avatar_url": avatar_url or user.get("avatar_url"),
                }
            }
        )
        user_id = str(user["_id"])
        role = user.get("role", "user")

    token = create_access_token({"sub": user_id, "role": role})
    return TokenResponse(
        access_token=token,
        user_id=user_id,
        email=email,
        full_name=user.get("full_name", full_name) if user else full_name,
        role=role,
    )

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "role": current_user.get("role", "user"),
        "is_active": current_user.get("is_active", True),
        "created_at": current_user.get("created_at"),
        "last_login_at": current_user.get("last_login_at"),
    }

@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    db = get_db()
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    
    # Generate 6-digit OTP
    otp = f"{random.randint(100000, 999999)}"
    exp_time = datetime.utcnow() + timedelta(minutes=15)
    
    if user:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"reset_otp": otp, "reset_otp_exp": exp_time}}
        )
        background_tasks.add_task(
            send_password_reset_email,
            to_email=user["email"],
            otp_code=otp,
            user_name=user.get("full_name", "User")
        )

    return {"message": "A 6-digit verification code has been dispatched to your email address."}

@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    db = get_db()
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=400, detail="Account not found with this email.")

    stored_otp = user.get("reset_otp")
    otp_exp = user.get("reset_otp_exp")

    if not stored_otp or stored_otp != body.otp.strip():
        raise HTTPException(status_code=400, detail="Invalid verification code. Please check your email.")

    if not otp_exp or datetime.utcnow() > otp_exp:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    new_hash = hash_password(body.new_password)
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": new_hash},
            "$unset": {"reset_otp": "", "reset_otp_exp": ""}
        }
    )

    return {"message": "Password successfully reset! You can now log in with your new password."}
