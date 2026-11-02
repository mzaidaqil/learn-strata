import json
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/maps", tags=["maps"])

DATA = Path(__file__).resolve().parents[2] / "data" / "maps.json"


@lru_cache
def _maps() -> list[dict]:
    if not DATA.exists():
        raise HTTPException(503, "data/maps.json not found — run `python gen_maps.py` first")
    return json.loads(DATA.read_text())


@router.get("")
def list_maps():
    return [{"slug": m["slug"], "title": m["title"], "summary": m["summary"], "steps": len(m["steps"])} for m in _maps()]


@router.get("/{slug}")
def get_map(slug: str):
    m = next((m for m in _maps() if m["slug"] == slug), None)
    if m is None:
        raise HTTPException(404)
    return m
