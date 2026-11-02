from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app import corpus

router = APIRouter(prefix="/corpus", tags=["corpus"])

SOURCES = Path(__file__).resolve().parents[2] / "sources"


@router.get("/toc")
def get_toc():
    return corpus.toc()


@router.get("/search")
def search(q: str):
    return corpus.search(q)


@router.get("/pdf/{doc}")
def pdf(doc: str):
    """The original PDF, so any section can be checked against the source page."""
    if doc not in corpus.DOC_NAMES:
        raise HTTPException(404)
    return FileResponse(SOURCES / f"{doc}.pdf", media_type="application/pdf")


@router.get("/{doc}/{rid}")
def get_record(doc: str, rid: str):
    r = corpus.get(doc, rid)
    if r is None:
        raise HTTPException(404, f"{doc} {rid} not found")
    return {**r, "label": corpus.label(r), "doc_name": corpus.DOC_NAMES[doc]}
