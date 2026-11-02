"""Flashcard storage and SM-2 spaced repetition."""

import json
import time

from app.db import conn

DAY = 86400
MASTERED_DAYS = 21  # a card whose next review is 3+ weeks away counts as mastered


def add_cards(cards: list[dict]) -> int:
    """Insert cards, skipping any whose (source, front) already exists. Returns how many were added."""
    now = time.time()
    added = 0
    with conn() as c:
        for k in cards:
            cur = c.execute(
                "INSERT OR IGNORE INTO cards (doc, rid, source, kind, front, back, options, answer, cite, due, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (k.get("doc"), k.get("rid"), k["source"], k["kind"], k["front"], k["back"],
                 json.dumps(k["options"]) if k.get("options") else None, k.get("answer"), k.get("cite"), now, now),
            )
            added += cur.rowcount
    return added


def _row(r) -> dict:
    d = dict(r)
    d["options"] = json.loads(d["options"]) if d["options"] else None
    return d


def for_provision(doc: str, rid: str) -> list[dict]:
    with conn() as c:
        return [_row(r) for r in c.execute("SELECT * FROM cards WHERE doc = ? AND rid = ? ORDER BY id", (doc, rid))]


def due(limit: int = 50) -> list[dict]:
    with conn() as c:
        rows = c.execute("SELECT * FROM cards WHERE due <= ? ORDER BY due LIMIT ?", (time.time(), limit))
        return [_row(r) for r in rows]


def review(card_id: int, grade: int) -> dict | None:
    """SM-2. grade: 0-5 (UI sends 1 Again, 3 Hard, 4 Good, 5 Easy)."""
    now = time.time()
    with conn() as c:
        r = c.execute("SELECT ease, interval, reps FROM cards WHERE id = ?", (card_id,)).fetchone()
        if not r:
            return None
        ease, interval, reps = r["ease"], r["interval"], r["reps"]
        if grade < 3:
            reps, interval = 0, 0
            due_at = now + 10 * 60  # see it again in this session
        else:
            reps += 1
            interval = 1 if reps == 1 else 6 if reps == 2 else round(interval * ease)
            if grade == 3:
                interval = max(1, round(interval * 0.6))
            due_at = now + interval * DAY
        ease = max(1.3, ease + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
        c.execute("UPDATE cards SET ease = ?, interval = ?, reps = ?, due = ? WHERE id = ?",
                  (ease, interval, reps, due_at, card_id))
        c.execute("INSERT INTO reviews (card_id, grade, at) VALUES (?, ?, ?)", (card_id, grade, now))
    return {"interval_days": interval, "due": due_at}


def stats() -> dict:
    now = time.time()
    start_of_day = now - (now % DAY)  # UTC day; good enough for a local study counter
    with conn() as c:
        q = lambda sql, *a: c.execute(sql, a).fetchone()[0]  # noqa: E731
        return {
            "total": q("SELECT COUNT(*) FROM cards"),
            "due": q("SELECT COUNT(*) FROM cards WHERE due <= ?", now),
            "new": q("SELECT COUNT(*) FROM cards WHERE reps = 0"),
            "mastered": q("SELECT COUNT(*) FROM cards WHERE interval >= ?", MASTERED_DAYS),
            "reviewed_today": q("SELECT COUNT(*) FROM reviews WHERE at >= ?", start_of_day),
        }


def per_provision() -> dict[tuple[str, str], dict]:
    """(doc, rid) -> {cards, mastered, due} for the progress dashboard."""
    now = time.time()
    with conn() as c:
        rows = c.execute(
            "SELECT doc, rid, COUNT(*) AS cards, SUM(interval >= ?) AS mastered, SUM(due <= ?) AS due"
            " FROM cards WHERE doc IS NOT NULL GROUP BY doc, rid",
            (MASTERED_DAYS, now),
        )
        return {(r["doc"], r["rid"]): dict(r) for r in rows}
