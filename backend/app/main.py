from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app import db  # noqa: E402
from app.routes import cards, chat, corpus, explain, maps  # noqa: E402

db.init()

app = FastAPI(title="Learn-Strata API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(corpus.router)
app.include_router(chat.router)
app.include_router(explain.router)
app.include_router(maps.router)
app.include_router(cards.router)


@app.get("/health")
def health():
    return {"ok": True}
