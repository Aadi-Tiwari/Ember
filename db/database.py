import aiosqlite
from pathlib import Path

DB_PATH = Path("pulsecheck.db")


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id          TEXT PRIMARY KEY,
                email       TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role        TEXT NOT NULL DEFAULT 'student',
                created_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS scans (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id             TEXT NOT NULL,
                timestamp           TEXT NOT NULL,
                risk_score          REAL NOT NULL,
                days_to_threshold   INTEGER,
                readings            TEXT NOT NULL,
                source              TEXT NOT NULL DEFAULT 'upload',
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS events (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT NOT NULL,
                type        TEXT NOT NULL,
                timestamp   TEXT NOT NULL,
                data        TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
        """)
        await db.commit()
