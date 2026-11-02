"""Loads data/corpus.json (built by ingest.py) and answers lookups over it."""

import json
import re
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "corpus.json"
DOC_NAMES = {
    "act": "Strata Management Act 2013 (Act 757)",
    "reg": "Strata Management (Maintenance and Management) Regulations 2015",
}


@lru_cache
def records() -> list[dict]:
    if not DATA.exists():
        raise RuntimeError("data/corpus.json not found — run `python ingest.py` first")
    return json.loads(DATA.read_text())


@lru_cache
def _index() -> dict[tuple[str, str], int]:
    return {(r["doc"], r["id"]): i for i, r in enumerate(records())}


def get(doc: str, rid: str) -> dict | None:
    i = _index().get((doc, rid))
    if i is None:
        return None
    recs = records()
    prev = recs[i - 1] if i > 0 and recs[i - 1]["doc"] == doc else None
    nxt = recs[i + 1] if i + 1 < len(recs) and recs[i + 1]["doc"] == doc else None
    return {
        **recs[i],
        "prev": {"id": prev["id"], "title": prev["title"]} if prev else None,
        "next": {"id": nxt["id"], "title": nxt["title"]} if nxt else None,
    }


def toc() -> list[dict]:
    """[{doc, name, groups: [{part, part_title, chapters: [{chapter, chapter_title, items: [...]}]}]}]"""
    out = []
    for doc, name in DOC_NAMES.items():
        groups: list[dict] = []
        for r in records():
            if r["doc"] != doc:
                continue
            if not groups or groups[-1]["part"] != r["part"]:
                groups.append({"part": r["part"], "part_title": r["part_title"], "chapters": []})
            chapters = groups[-1]["chapters"]
            if not chapters or chapters[-1]["chapter"] != r["chapter"]:
                chapters.append({"chapter": r["chapter"], "chapter_title": r["chapter_title"], "items": []})
            chapters[-1]["items"].append({"id": r["id"], "kind": r["kind"], "title": r["title"]})
        out.append({"doc": doc, "name": name, "groups": groups})
    return out


def label(r: dict) -> str:
    """Short citation label, e.g. 'Act s.21', 'Reg r.55', 'By-law 3', 'Form 5'."""
    if r["kind"] == "section":
        return f"Act s.{r['id']}" if r["doc"] == "act" else f"Reg r.{r['id']}"
    if r["kind"] == "bylaw":
        return f"By-law {r['id'].split('-')[1]}"
    if r["kind"] == "form":
        return f"Form {r['id'].split('-')[1]}"
    return ("Act " if r["doc"] == "act" else "Reg ") + r["title"].split(" — ")[0]


def search(q: str, limit: int = 30) -> list[dict]:
    """Plain keyword search: every word must appear; title hits rank higher."""
    words = [w for w in re.findall(r"[a-z0-9-]+", q.lower()) if len(w) > 1]
    if not words:
        return []
    hits = []
    for r in records():
        title, text = r["title"].lower(), r["text"].lower()
        if not all(w in title or w in text for w in words):
            continue
        score = sum(5 * title.count(w) + text.count(w) for w in words)
        pos = min((text.find(w) for w in words if w in text), default=0)
        start = max(0, pos - 80)
        snippet = ("…" if start else "") + r["text"][start:start + 220].replace("\n", " ") + "…"
        hits.append({"doc": r["doc"], "id": r["id"], "title": r["title"], "label": label(r),
                     "snippet": snippet, "score": score})
    hits.sort(key=lambda h: -h["score"])
    return hits[:limit]


CITE = re.compile(
    r"^(?:(Act) s\.(\d+[A-Z]?)|(Reg) r\.(\d+)|By-law (\d+)|Form (\d+[A-Z]?)|(Act|Reg) (First|Second|Third|Fourth) Schedule)"
)
SCHEDULE_IDS = {
    ("Act", "First"): ("act", "sch-1"), ("Act", "Second"): ("act", "sch-2"),
    ("Act", "Third"): ("act", "sch-3"), ("Act", "Fourth"): ("act", "sch-4"),
    ("Reg", "First"): ("reg", "sch-1"), ("Reg", "Second"): ("reg", "form-1"), ("Reg", "Third"): ("reg", "bl-1"),
}


def resolve_cite(c: str) -> tuple[str, str] | None:
    """'Act s.21(1)(b)' -> ('act', '21'); None if it doesn't point at a known provision."""
    m = CITE.match(c.strip())
    if not m:
        return None
    if m.group(1):
        key = ("act", m.group(2))
    elif m.group(3):
        key = ("reg", m.group(4))
    elif m.group(5):
        key = ("reg", f"bl-{m.group(5)}")
    elif m.group(6):
        key = ("reg", f"form-{m.group(6)}")
    else:
        key = SCHEDULE_IDS.get((m.group(7), m.group(8)))
    return key if key and key in _index() else None


def cite_exists(c: str) -> bool:
    return resolve_cite(c) is not None
