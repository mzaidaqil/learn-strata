# Learn-Strata

A local study app for the **Strata Management Act 2013 (Act 757)** and the
**Strata Management (Maintenance and Management) Regulations 2015**.
See [PLAN.md](PLAN.md) for the full plan and build phases.

## Status
- [x] Phase 1: Ingest + Reader (browse every section, regulation, by-law, schedule and form; search; cross-reference links; link to the original PDF page)
- [x] Phase 2: Ask the Tutor (streaming chat grounded in both documents, clickable citations, saved history, "Ask about this section" from the Reader)
- [x] Phase 3: Explain simply (per-section plain-English explanation, who/what/when box, real-life example, connected provisions and memory hook; saved so each one is generated only once; a dot in the sidebar marks explained sections)
- [x] Phase 4: Process maps (9 step-by-step flows with branches, deadlines, penalties, key numbers and a test-yourself mode; `backend/gen_maps.py` regenerates them)
- [x] Phase 5: Flashcards (AI-written per section, or free from process-map numbers), multiple-choice quiz cards, SM-2 spaced repetition, and a progress dashboard per Part
- [ ] Phase 6: Scenario practice

## Two modes

**Read-only (default, and what is deployed to Vercel).** Read, search, process maps and the original PDFs.
The Next.js app reads `frontend/data/corpus.json` and `frontend/data/maps.json` directly, so no backend,
database or API key is needed. All 293 law pages and 9 maps are pre-rendered at build time.

**With Claude features** (Tutor, Explain simply, flashcards, Review). Create `frontend/.env.local` containing
`NEXT_PUBLIC_AI_ENABLED=true`, run the Python backend below, and add your key to `backend/.env`.

If you re-run `backend/ingest.py` or `backend/gen_maps.py`, copy the new data into the frontend with
`cd frontend && npm run sync-data`.

## Deploy (Vercel)
```bash
cd ~/Downloads/Learn-Strata/frontend
npx vercel login          # once
npx vercel deploy --prod  # builds and publishes the read-only site
```

## Run it

Two terminals.

**Backend** (Python, port 8000)
```bash
cd ~/Downloads/Learn-Strata/backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # first time only
cp .env.example .env    # first time only, then put your ANTHROPIC_API_KEY in .env
.venv/bin/python ingest.py                                            # first time only (rebuilds data/corpus.json)
.venv/bin/uvicorn app.main:app --reload --port 8000
```

**Frontend** (Next.js, port 3000)
```bash
cd ~/Downloads/Learn-Strata/frontend
npm install     # first time only
npm run dev
```

Open http://localhost:3000

## How the source text is prepared
`backend/ingest.py` reads the two PDFs in `backend/sources/` and writes `backend/data/corpus.json`,
which has one record per section, regulation, by-law, schedule and form. It checks the result against
each PDF's table of contents and fails if anything is missing. The PDF text has spacing glitches
("c harges", "Commis sioner"), and the script repairs them using word frequencies from the documents
themselves. Every Reader page links to its page in the original PDF so you can check the wording.

## Tutor cost (Claude API)
Every question sends the full text of both documents (~154k tokens) as a prompt cached for 1 hour.
- **First question in a study session:** about $1.25 to write the cache (Opus 5.5).
- **Each question after that, within the hour:** about $0.03 for the cached law text, plus the answer (about $0.02–0.03 for a typical 1,000–1,500-token answer).

An "Explain simply" explanation costs about the same as a tutor question, and it is saved, so you only pay once per section.

To make answers cheaper, set `MODEL=claude-sonnet-5-5` in `backend/.env`. That roughly halves the cache-write and answer costs. `EFFORT` (low, medium or high) controls how carefully the model reasons before answering.
