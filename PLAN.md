# Learn-Strata — Plan

## Context
Zayed wants to **understand and memorise** Malaysia's Strata Management Act 2013 (Act 757) and the Strata Management (Maintenance and Management) Regulations 2015, including real-life situations and how the processes work. The tool is a plain local web app with a built-in **AI tutor chat**: you can ask it anything and it answers only from the two PDFs, citing the section or regulation. Nothing fancy. It runs locally and uses Zayed's own Claude API key.

**Sources of truth (the only ones):**
- `~/Downloads/Strata/Strata-Management-Act-757-English.pdf`: 153 pages, 153 sections, 11 Parts, 4 Schedules (~68k tokens of text)
- `~/Downloads/Strata/Strata-Management-Maintenance-Management-Regulation-2015-eng-version.pdf`: 125 pages, 72 regulations, 19 Parts, 3 Schedules incl. forms and by-laws (~53k tokens)

`pypdf` (already installed, v6.6.2) extracts both cleanly. Toolchain: Python 3.12.7 and Node 25.9.0.

**What happens when this plan is approved:** create `~/Downloads/Learn-Strata/` and save this plan there as `PLAN.md`. Building the app is a separate step, done phase by phase on request.

---

## Key design decision: no vector DB, the whole law goes in the prompt
Both documents together come to about 121k tokens, which fits easily in Claude's context window. Every chat and tutor call sends the **full parsed text of both documents** as a system prompt with **prompt caching**. Repeat questions then read the text from cache at a fraction of the cost and latency. This is more accurate than retrieval chunking because Claude always sees every cross-reference (e.g. s.21 ↔ s.25 ↔ reg 13). It is also simpler: no embeddings and no vector store.

The system prompt forces Claude to:
- answer **only** from the provided text and say "the Act/Regulations don't cover this" when that's the case
- cite every claim as `[Act s.X(y)]` or `[Reg r.X]`; the UI turns these into clickable links
- explain in plain English first, then give the legal detail, then a short worked example

Default model: `claude-sonnet-5-5`, configurable in `.env` (switch to `claude-opus-5-5` for harder questions). Before writing the API code, check the `claude-api` skill for the current caching and streaming syntax.

---

## Learning features (kept simple)
| # | Feature | What it does | Why it helps memorise |
|---|---|---|---|
| 1 | **Reader** | Browse Act and Regs by Part → Chapter → Section. Each section has an "Explain simply" button that returns a plain-English summary, a "who / what / when / deadline" box and a real-life example. Explanations are cached in SQLite so each is generated only once. | You understand a section before you memorise it |
| 2 | **Process Maps** | Step-by-step flows of the big lifecycles, each step linked to its section. Rendered as simple numbered steps and a Mermaid diagram. | Shows how the process works end to end |
| 3 | **Ask the Tutor (chat)** | Streaming chat grounded in both documents, with clickable citations. Chat history is saved. A "Quiz me on this" button turns any answer into practice questions. | Covers "if I have any question I can ask directly" |
| 4 | **Scenario Practice** | The AI writes a realistic situation (e.g. "Water is leaking from the unit above into your ceiling. What happens now?"). You type your answer and the AI grades it against the law, showing what you missed and the sections involved. | Builds the ability to apply the law to situations |
| 5 | **Flashcards + Quiz** | Cards and MCQs generated per section, then saved. Reviews are scheduled with simple spaced repetition (SM-2). The dashboard shows mastery per Part. | Covers the memorisation goal |

**Process Maps to build first** (each verified against the text during build):
1. Developer's management period → JMB established → first JMB AGM → handover (Act ss.7–28, Regs 11–15)
2. Management Corporation lifecycle: preliminary management period → first MC AGM → handover (ss.46–62, Regs 22–24)
3. Subsidiary MC and limited common property (ss.63–71, Regs 25–27)
4. Recovering unpaid charges: notice → debt recovery → attachment of movable property → auction (ss.33–35, 77–79, Regs 20, 31, 35–42)
5. Inter-floor leakage and party-wall damage (Regs 55–67)
6. Developer deposit to rectify common-property defects (s.92, Regs 46–54)
7. Strata Management Tribunal claim → hearing → award → enforcement (ss.101–124)
8. Maintenance account vs sinking fund: who opens it, who pays, what it may be used for (ss.10–14, 23–26, 50–54, 60–62)
9. Managing agent appointment, bond and termination (ss.86–91, Regs 43–45)

---

## Architecture
```
Learn-Strata/
├── PLAN.md
├── README.md                 # how to run
├── backend/                  # Python (FastAPI)
│   ├── .env.example          # ANTHROPIC_API_KEY=, MODEL=claude-sonnet-5-5
│   ├── requirements.txt      # fastapi, uvicorn, anthropic, pypdf, python-dotenv, pydantic
│   ├── ingest.py             # PDF → data/corpus.json (parsed into sections)
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS for localhost:3000
│   │   ├── corpus.py         # load corpus.json, lookup by id, build the cached system prompt
│   │   ├── llm.py            # Anthropic client, prompt caching, streaming helper
│   │   ├── prompts.py        # tutor / explain / scenario / grader / flashcard prompts
│   │   ├── db.py             # SQLite (sqlite3 stdlib): chats, explanations, cards, reviews
│   │   └── routes/           # corpus.py, chat.py, explain.py, scenario.py, cards.py, progress.py
│   └── data/                 # corpus.json, learn.db (gitignored)
└── frontend/                 # Next.js (App Router, TypeScript, Tailwind)
    ├── app/
    │   ├── page.tsx              # Dashboard: progress per Part, cards due today
    │   ├── read/[doc]/[id]/      # Reader + "Explain simply"
    │   ├── maps/[slug]/          # Process Maps
    │   ├── chat/                 # Tutor chat (streaming)
    │   ├── scenarios/            # Scenario Practice
    │   └── review/               # Flashcards / Quiz
    ├── components/               # SectionView, CitationLink, ChatPanel, Flashcard, MermaidDiagram
    └── lib/api.ts                # backend client (BACKEND_URL=http://localhost:8000)
```

**Ingestion (`ingest.py`).** Pages are extracted with pypdf, page headers and footers are stripped (e.g. "Laws of Malaysia … Act 757", "P.U. (A) 107"), and the text is split on Part/Chapter headings and section-number patterns. Each section becomes a record: `{doc: "act"|"reg", id: "21", title, part, chapter, text, pages}`. The arrangement-of-sections lists on pp.3–10 (Act) and pp.1–5 (Regs) are the checklist for confirming every section was captured; the script fails loudly if any are missing. Schedules and forms are kept as their own records.

**API endpoints**
- `GET /corpus/toc`, `GET /corpus/{doc}/{id}`
- `POST /chat` (SSE stream), `GET /chats`, `GET /chats/{id}`
- `POST /explain/{doc}/{id}` (cached in DB)
- `POST /scenario/new` (optional topic/Part), `POST /scenario/grade`
- `POST /cards/generate/{doc}/{id}`, `GET /cards/due`, `POST /cards/{id}/review` (SM-2 grade 0–5)
- `GET /progress`

**API key** lives only in `backend/.env`, is never sent to the frontend and is gitignored.

---

## Build phases
1. **Ingest and Reader:** project scaffold, `ingest.py`, corpus endpoints, Reader UI. *Done when every section in both ToCs is browsable.*
2. **Tutor chat:** cached full-corpus system prompt, streaming chat, citation links into the Reader, saved history.
3. **Explain simply:** per-section explanations, cached in SQLite.
4. **Process Maps:** draft the 9 maps above with Claude from the source text, check each step's citation by hand, save them as static JSON/MDX in the frontend.
5. **Flashcards, Quiz and spaced repetition:** card generation, review page, progress dashboard.
6. **Scenario Practice:** generator and grader.

## Run locally
```bash
cd ~/Downloads/Learn-Strata/backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && cp .env.example .env   # put the API key in .env
python ingest.py && uvicorn app.main:app --reload --port 8000
cd ../frontend && npm install && npm run dev               # http://localhost:3000
```

## Verification
- `ingest.py` reports 153/153 Act sections and 72/72 regulations, and spot checks of s.21, s.92 and reg 55 match the PDF text.
- Chat test questions, each needing a correct and cited answer:
  - "Who must convene the first JMB AGM and by when?"
  - "What happens if I don't pay maintenance charges?"
  - "My ceiling leaks from the unit above. What's the process?"
  - an out-of-scope question, e.g. Sabah strata law, where the tutor must say the documents don't cover it
- Clicking a citation opens the correct section in the Reader.
- A second chat call shows cache reads in the API usage (`cache_read_input_tokens > 0`).
- Flashcard review updates the due dates, and the dashboard progress changes.

---

## Progress log
- **2026-11-02, Phase 1 done.** `ingest.py` parses 153/153 Act sections, 4 Act schedules, 72/72 regulations, 30 by-laws, 33 forms and the fees schedule (293 records, ~108k tokens). FastAPI serves `/corpus/toc`, `/corpus/{doc}/{id}`, `/corpus/search` and `/corpus/pdf/{doc}`. Next.js 16 Reader at `/read/[doc]/[id]` has a ToC sidebar, clickable cross-references, prev/next and a link to the original PDF page, plus a search page at `/search`. Note: Next 16's `cacheComponents` is turned off because all data is live from the local backend.
- **2026-11-02, Phase 2 done.** `POST /chat` streams SSE from `client.beta.messages.stream`. The system prompt is the tutor instructions plus the whole corpus as `<provision cite=...>` blocks (~154k tokens), cached with a 1h TTL. Verified: the second turn reads all 154,269 tokens from cache. Default model changed to `claude-opus-5-5` (same $0.20/MTok cache-read price as Sonnet 5.5; configurable via `MODEL`). `fallbacks: "default"` is on for safety-classifier declines. Chats are stored in SQLite (`data/learn.db`). The frontend `/tutor` page has a chat list, starter questions, a markdown renderer that turns `[Act s.21]` / `[Reg r.55]` / `[By-law 3]` / `[Form 5]` into Reader links, and "Quiz me on this" / "Explain more simply" buttons. Every Reader page has an "Ask the tutor about this" button. Test answers checked: the first JMB AGM question (s.17/18, RM250k penalty matches the text) and an out-of-scope Sabah question (the tutor correctly says the Act covers only Peninsular Malaysia and Labuan, s.1(2)).
- **2026-11-02, Phase 3 done.** `GET/POST /explain/{doc}/{id}`: POST streams an explanation with a fixed structure (In plain English / Who, what, when / Real-life example / Connected provisions / Remember it), using the same cached corpus prefix (cache read confirmed), and saves it in the SQLite `explanations` table. `GET /explain` lists explained provisions for the sidebar dots. The frontend `ExplainPanel` on every Reader page shows the saved explanation, or streams a new one, with Regenerate/Hide. Checked: the s.92 explanation's figures (RM5,000 fine + RM50/day; deposit ≥0.5% or RM50,000) match s.92(6) and reg 47(1). The browser flow was tested by driving headless Chrome over CDP on s.93.
- **2026-11-02, Phase 4 done.** `backend/gen_maps.py` asked Claude (cached corpus) for each of the 9 maps as JSON: summary, steps with actor/detail/deadline/penalty/branches/cites, key_numbers and memory_hook. Every citation (753 total) is validated against corpus.json, with one retry, and the script fails if any is still unknown; all passed on the first try. The output is saved to `backend/data/maps.json` and served by `GET /maps` and `/maps/{slug}`. Hand-checked against the source: the inter-floor leakage steps (r.56–64), and key numbers in unpaid-charges, tribunal and accounts (s.78(3), s.117(1), s.123, Fourth Schedule 8%, s.25(4) ≥10%, s.10(3), s.36, r.41, s.122). **Change from the plan:** no Mermaid. The frontend renders each map as a vertical timeline with amber "If → then" branch boxes, deadline and penalty pills, citation chips and a "Test yourself" mode (details hidden until tapped), because generated Mermaid syntax breaks easily. Added "Quiz me with the tutor" (prefills the tutor via `?q=`).
- **2026-11-02, Phase 5 done (AI card generation untested: the API account ran out of credit).** The SQLite `cards` and `reviews` tables and `app/cards.py` (SM-2: Again resets to 10 min; Good gives 1, 6, then ×ease days; Hard ×0.6; ease floor 1.3) were unit-tested on a temp DB (1→6→15→38 days, Again resets). Endpoints: `POST /cards/generate/{doc}/{id}` (Claude writes 3–5 recall/MCQ cards as JSON, validated for shape and citation, one retry), `POST /cards/from-map/{slug}` (key numbers become cards, no API call), `GET /cards/due`, `POST /cards/{id}/review`, `GET /cards/progress` (per-Part explained / with-cards / mastered / due). Citation resolving moved to `corpus.resolve_cite`, shared with gen_maps.py. API errors now show the API's own message (`llm.error_message`). Frontend: a "Make flashcards" button on each Reader page, "Add these to my flashcards" on maps, the `/review` session (MCQ cards are graded by your pick; a wrong pick caps the grade at Hard), and a home dashboard with per-Part bars and "Make cards (N)" for a whole Part (3 in parallel, cost confirmation). Tested in headless Chrome: map cards added and a review session updated the schedules correctly; the test reviews were reset afterwards.
