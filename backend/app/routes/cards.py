import json
import re

import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import cards, corpus, db, llm, prompts
from app.routes.maps import _maps

router = APIRouter(prefix="/cards", tags=["cards"])


def _valid(card: dict) -> bool:
    if card.get("kind") not in ("recall", "mcq") or not card.get("front") or not card.get("back"):
        return False
    if card["kind"] == "mcq":
        opts = card.get("options")
        if not isinstance(opts, list) or len(opts) < 3 or not isinstance(card.get("answer"), int):
            return False
        if not 0 <= card["answer"] < len(opts):
            return False
    return corpus.cite_exists(card.get("cite", ""))


@router.get("/provision/{doc}/{rid}")
def provision_cards(doc: str, rid: str):
    return cards.for_provision(doc, rid)


@router.post("/generate/{doc}/{rid}")
async def generate(doc: str, rid: str):
    r = corpus.get(doc, rid)
    if r is None:
        raise HTTPException(404)
    prompt = prompts.CARDS.format(cite=corpus.label(r), title=r["title"], kind_hint=prompts.KIND_HINTS[r["kind"]])
    for _ in range(2):
        text = ""
        try:
            async for item in llm.stream_text([{"role": "user", "content": prompt}], max_tokens=8000):
                if isinstance(item, str):
                    text += item
        except anthropic.APIStatusError as e:
            raise HTTPException(502, llm.error_message(e)) from e
        except anthropic.APIConnectionError as e:
            raise HTTPException(502, "Couldn't reach the Claude API.") from e
        m = re.search(r"```json\s*(\[.*\])\s*```", text, re.S)
        try:
            raw = json.loads(m.group(1) if m else text)
        except (json.JSONDecodeError, AttributeError):
            continue
        good = [k for k in raw if isinstance(k, dict) and _valid(k)]
        if good:
            # File each card under the provision it is being made for, so progress counts it there.
            cards.add_cards([{**k, "source": "ai", "doc": doc, "rid": rid} for k in good])
            return cards.for_provision(doc, rid)
    raise HTTPException(502, "Claude didn't return usable flashcards — try again")


@router.post("/from-map/{slug}")
def from_map(slug: str):
    """Turn a process map's key numbers into recall cards (no API call)."""
    m = next((m for m in _maps() if m["slug"] == slug), None)
    if m is None:
        raise HTTPException(404)
    new = []
    for k in m["key_numbers"]:
        target = corpus.resolve_cite(k["cite"])
        new.append({
            "source": f"map:{slug}", "kind": "recall",
            "front": f"{m['title']}: {k['label']}?",
            "back": k["value"], "cite": k["cite"],
            "doc": target[0] if target else None, "rid": target[1] if target else None,
        })
    return {"added": cards.add_cards(new), "total": len(new)}


@router.get("/due")
def due(limit: int = 50):
    return cards.due(limit)


class Review(BaseModel):
    grade: int


@router.post("/{card_id}/review")
def review(card_id: int, body: Review):
    if not 0 <= body.grade <= 5:
        raise HTTPException(400, "grade must be 0-5")
    r = cards.review(card_id, body.grade)
    if r is None:
        raise HTTPException(404)
    return r


@router.get("/progress")
def progress():
    """Overall card stats plus per-Part coverage: provisions, explained, with cards, mastered cards."""
    per = cards.per_provision()
    explained = {(e["doc"], e["rid"]) for e in db.explained_ids()}
    parts = []
    for t in corpus.toc():
        for g in t["groups"]:
            items = [i for c in g["chapters"] for i in c["items"]]
            keys = [(t["doc"], i["id"]) for i in items]
            stats = [per.get(k, {}) for k in keys]
            parts.append({
                "doc": t["doc"], "part": g["part"], "part_title": g["part_title"],
                "first_id": items[0]["id"],
                "provisions": len(items),
                "explained": sum(k in explained for k in keys),
                "with_cards": sum(1 for s in stats if s),
                "cards": sum(s.get("cards", 0) for s in stats),
                "mastered": sum(s.get("mastered", 0) or 0 for s in stats),
                "due": sum(s.get("due", 0) or 0 for s in stats),
                # sections/by-laws with no cards yet, for "Make cards for this Part"
                "missing": [i["id"] for i in items if i["kind"] in ("section", "bylaw") and (t["doc"], i["id"]) not in per],
            })
    return {"stats": cards.stats(), "parts": parts}
