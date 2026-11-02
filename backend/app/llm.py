"""Claude client. Every request carries the full law text as a cached system prompt."""

import os
from collections.abc import AsyncIterator
from functools import lru_cache

import anthropic

from app import corpus, prompts

MODEL = os.environ.get("MODEL", "claude-opus-5-5")
EFFORT = os.environ.get("EFFORT", "medium")


@lru_cache
def client() -> anthropic.AsyncAnthropic:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError("ANTHROPIC_API_KEY is not set — add it to backend/.env")
    return anthropic.AsyncAnthropic()


@lru_cache
def system_blocks() -> tuple[dict, ...]:
    """Instructions + the whole corpus, cached for an hour so a study session keeps hitting the cache."""
    law = prompts.law_block(corpus.records(), corpus.label)
    return (
        {"type": "text", "text": prompts.TUTOR},
        {"type": "text", "text": law, "cache_control": {"type": "ephemeral", "ttl": "1h"}},
    )


def _request(messages: list[dict], max_tokens: int) -> dict:
    req = dict(
        model=MODEL,
        max_tokens=max_tokens,
        system=list(system_blocks()),
        messages=messages,
        output_config={"effort": EFFORT},
    )
    # Server-side fallback re-runs a safety-classifier decline on another model (Claude API, Opus/Sonnet 5.5).
    if MODEL in ("claude-opus-5-5", "claude-sonnet-5-5"):
        req.update(betas=["server-side-fallback-2026-07-01"], fallbacks="default")
    return req


async def stream_text(messages: list[dict], max_tokens: int = 16000) -> AsyncIterator[str | dict]:
    """Yield text deltas, then a final dict: {stop_reason, usage}."""
    async with client().beta.messages.stream(**_request(messages, max_tokens)) as stream:
        async for text in stream.text_stream:
            yield text
        final = await stream.get_final_message()
    u = final.usage
    yield {
        "stop_reason": final.stop_reason,
        "model": final.model,
        "usage": {
            "input": u.input_tokens,
            "output": u.output_tokens,
            "cache_read": u.cache_read_input_tokens or 0,
            "cache_write": u.cache_creation_input_tokens or 0,
        },
    }


def error_message(e: anthropic.APIStatusError) -> str:
    """The API's own human-readable message, e.g. 'Your credit balance is too low ...'."""
    body = e.body if isinstance(e.body, dict) else {}
    msg = (body.get("error") or {}).get("message") or e.message
    return f"Claude API error {e.status_code}: {msg}"
