import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt

SECRET = "pulsecheck-mh3-secret-2026-do-not-ship"
ALGORITHM = "HS256"
TOKEN_DAYS = 7


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"{salt}:{key.hex()}"


def verify_password(plain: str, stored: str) -> bool:
    try:
        salt, key_hex = stored.split(":")
        key = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), 260_000)
        return secrets.compare_digest(key.hex(), key_hex)
    except Exception:
        return False


def create_token(user_id: str, email: str, role: str = "student") -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)
    return jwt.encode(
        {"sub": user_id, "email": email, "role": role, "exp": exp},
        SECRET,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET, algorithms=[ALGORITHM])
