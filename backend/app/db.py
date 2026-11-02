"""SQLite storage for chats (and, in later phases, explanations and flashcards)."""

import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / "data" / "learn.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    meta TEXT,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS explanations (
    doc TEXT NOT NULL,
    rid TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT,
    created_at REAL NOT NULL,
    PRIMARY KEY (doc, rid)
);
CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY,
    doc TEXT,                -- provision the card tests (from its citation)
    rid TEXT,
    source TEXT NOT NULL,    -- "ai" or "map:<slug>"
    kind TEXT NOT NULL,      -- "recall" or "mcq"
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    options TEXT,            -- JSON list for mcq
    answer INTEGER,          -- index into options for mcq
    cite TEXT,
    ease REAL NOT NULL DEFAULT 2.5,
    interval REAL NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    due REAL NOT NULL,
    created_at REAL NOT NULL,
    UNIQUE (source, front)
);
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    grade INTEGER NOT NULL,
    at REAL NOT NULL
);
"""


@contextmanager
def conn():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init():
    DB.parent.mkdir(exist_ok=True)
    with conn() as c:
        c.executescript(SCHEMA)


def create_chat(title: str) -> int:
    now = time.time()
    with conn() as c:
        return c.execute(
            "INSERT INTO chats (title, created_at, updated_at) VALUES (?, ?, ?)", (title, now, now)
        ).lastrowid


def add_message(chat_id: int, role: str, content: str, meta: dict | None = None):
    now = time.time()
    with conn() as c:
        c.execute(
            "INSERT INTO messages (chat_id, role, content, meta, created_at) VALUES (?, ?, ?, ?, ?)",
            (chat_id, role, content, json.dumps(meta) if meta else None, now),
        )
        c.execute("UPDATE chats SET updated_at = ? WHERE id = ?", (now, chat_id))


def list_chats() -> list[dict]:
    with conn() as c:
        return [dict(r) for r in c.execute("SELECT id, title, updated_at FROM chats ORDER BY updated_at DESC")]


def get_chat(chat_id: int) -> dict | None:
    with conn() as c:
        chat = c.execute("SELECT id, title FROM chats WHERE id = ?", (chat_id,)).fetchone()
        if not chat:
            return None
        msgs = c.execute(
            "SELECT role, content, meta FROM messages WHERE chat_id = ? ORDER BY id", (chat_id,)
        ).fetchall()
    return {
        **dict(chat),
        "messages": [
            {"role": m["role"], "content": m["content"], "meta": json.loads(m["meta"]) if m["meta"] else None}
            for m in msgs
        ],
    }


def delete_chat(chat_id: int):
    with conn() as c:
        c.execute("DELETE FROM chats WHERE id = ?", (chat_id,))


def get_explanation(doc: str, rid: str) -> str | None:
    with conn() as c:
        row = c.execute("SELECT content FROM explanations WHERE doc = ? AND rid = ?", (doc, rid)).fetchone()
    return row["content"] if row else None


def save_explanation(doc: str, rid: str, content: str, model: str):
    with conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO explanations (doc, rid, content, model, created_at) VALUES (?, ?, ?, ?, ?)",
            (doc, rid, content, model, time.time()),
        )


def explained_ids() -> list[dict]:
    with conn() as c:
        return [dict(r) for r in c.execute("SELECT doc, rid FROM explanations")]
