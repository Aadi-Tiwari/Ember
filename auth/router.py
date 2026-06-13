import hashlib
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from auth.utils import create_token, decode_token, hash_password, verify_password
from db.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)


# ---------- request models ----------

class RegisterBody(BaseModel):
    email: str
    display_name: str
    password: str
    role: str = "student"   # "student" or "counselor"


class LoginBody(BaseModel):
    email: str
    password: str


# ---------- helpers ----------

def _anon_id(user_id: str) -> str:
    """Short anonymized display ID shown in counselor view."""
    return hashlib.sha256(user_id.encode()).hexdigest()[:8]


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    if not credentials:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = decode_token(credentials.credentials)
        return {"id": payload["sub"], "email": payload["email"], "role": payload.get("role", "student")}
    except Exception:
        raise HTTPException(401, "Invalid or expired token")


async def optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Returns user dict if authenticated, None otherwise."""
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        return {"id": payload["sub"], "email": payload["email"], "role": payload.get("role", "student")}
    except Exception:
        return None


# ---------- endpoints ----------

@router.post("/register")
async def register(body: RegisterBody):
    async with get_db() as db:
        async with db.execute("SELECT id FROM users WHERE email = ?", (body.email,)) as cur:
            if await cur.fetchone():
                raise HTTPException(400, "Email already registered")

        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        pw_hash = hash_password(body.password)

        await db.execute(
            "INSERT INTO users (id, email, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, body.email, body.display_name, pw_hash, body.role, now),
        )
        await db.commit()

    token = create_token(user_id, body.email, body.role)
    return {
        "token": token,
        "user": {"id": user_id, "email": body.email, "display_name": body.display_name, "role": body.role},
    }


@router.post("/login")
async def login(body: LoginBody):
    async with get_db() as db:
        async with db.execute(
            "SELECT id, email, display_name, password_hash, role FROM users WHERE email = ?",
            (body.email,),
        ) as cur:
            row = await cur.fetchone()

    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    token = create_token(row["id"], row["email"], row["role"])
    return {
        "token": token,
        "user": {
            "id": row["id"],
            "email": row["email"],
            "display_name": row["display_name"],
            "role": row["role"],
        },
    }


@router.get("/me")
async def me(user=Depends(get_current_user)):
    async with get_db() as db:
        async with db.execute(
            "SELECT id, email, display_name, role, created_at FROM users WHERE id = ?",
            (user["id"],),
        ) as cur:
            row = await cur.fetchone()

    if not row:
        raise HTTPException(404, "User not found")

    return {
        "id": row["id"],
        "email": row["email"],
        "display_name": row["display_name"],
        "role": row["role"],
        "created_at": row["created_at"],
        "anon_id": _anon_id(row["id"]),
    }
