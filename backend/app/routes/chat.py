import json

import anthropic
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app import corpus, db, llm

router = APIRouter(tags=["chat"])


class Context(BaseModel):
    doc: str
    id: str


class ChatRequest(BaseModel):
    message: str
    chat_id: int | None = None
    context: Context | None = None


def _with_context(content: str, meta: dict | None) -> str:
    """Prefix the question with the section the student was reading, if any."""
    ctx = (meta or {}).get("context")
    if not ctx:
        return content
    return f"(I'm currently reading {ctx['label']}: {ctx['title']}.)\n\n{content}"


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


@router.post("/chat")
async def chat(req: ChatRequest):
    message = req.message.strip()
    if not message:
        raise HTTPException(400, "Empty message")

    meta = None
    if req.context:
        r = corpus.get(req.context.doc, req.context.id)
        if r:
            meta = {"context": {"doc": r["doc"], "id": r["id"], "label": corpus.label(r), "title": r["title"]}}

    if req.chat_id is None:
        chat_id = db.create_chat(message[:80])
        history = []
    else:
        existing = db.get_chat(req.chat_id)
        if not existing:
            raise HTTPException(404, "Chat not found")
        chat_id = req.chat_id
        history = existing["messages"]

    db.add_message(chat_id, "user", message, meta)
    messages = [
        {"role": m["role"], "content": _with_context(m["content"], m["meta"]) if m["role"] == "user" else m["content"]}
        for m in history
    ] + [{"role": "user", "content": _with_context(message, meta)}]

    async def events():
        yield _sse({"type": "meta", "chat_id": chat_id})
        answer = ""
        try:
            async for item in llm.stream_text(messages):
                if isinstance(item, str):
                    answer += item
                    yield _sse({"type": "delta", "text": item})
                else:
                    if item["stop_reason"] == "refusal" and not answer:
                        answer = "_The model declined to answer this one. Try rephrasing the question._"
                        yield _sse({"type": "delta", "text": answer})
                    db.add_message(chat_id, "assistant", answer, item)
                    yield _sse({"type": "done", **item})
        except anthropic.APIStatusError as e:
            yield _sse({"type": "error", "message": llm.error_message(e)})
        except anthropic.APIConnectionError:
            yield _sse({"type": "error", "message": "Couldn't reach the Claude API. Check your internet connection."})
        except RuntimeError as e:
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@router.get("/chats")
def chats():
    return db.list_chats()


@router.get("/chats/{chat_id}")
def get_chat(chat_id: int):
    c = db.get_chat(chat_id)
    if not c:
        raise HTTPException(404)
    return c


@router.delete("/chats/{chat_id}")
def delete_chat(chat_id: int):
    db.delete_chat(chat_id)
    return {"ok": True}
