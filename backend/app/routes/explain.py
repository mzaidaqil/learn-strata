import json

import anthropic
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app import corpus, db, llm, prompts

router = APIRouter(prefix="/explain", tags=["explain"])


def _record(doc: str, rid: str) -> dict:
    r = corpus.get(doc, rid)
    if r is None:
        raise HTTPException(404, f"{doc} {rid} not found")
    return r


@router.get("")
def explained():
    """[{doc, rid}] of every provision that has a saved explanation."""
    return db.explained_ids()


@router.get("/{doc}/{rid}")
def get_explanation(doc: str, rid: str):
    _record(doc, rid)
    return {"content": db.get_explanation(doc, rid)}


@router.post("/{doc}/{rid}")
async def explain(doc: str, rid: str):
    """Stream a fresh explanation (SSE) and save it, replacing any earlier one."""
    r = _record(doc, rid)
    prompt = prompts.EXPLAIN.format(cite=corpus.label(r), title=r["title"], kind_hint=prompts.KIND_HINTS[r["kind"]])

    async def events():
        text = ""
        try:
            async for item in llm.stream_text([{"role": "user", "content": prompt}], max_tokens=8000):
                if isinstance(item, str):
                    text += item
                    yield f"data: {json.dumps({'type': 'delta', 'text': item})}\n\n"
                else:
                    if item["stop_reason"] == "end_turn" and text:
                        db.save_explanation(doc, rid, text, item["model"])
                    yield f"data: {json.dumps({'type': 'done', **item})}\n\n"
        except anthropic.APIStatusError as e:
            yield f"data: {json.dumps({'type': 'error', 'message': llm.error_message(e)})}\n\n"
        except anthropic.APIConnectionError:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Could not reach the Claude API.'})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
