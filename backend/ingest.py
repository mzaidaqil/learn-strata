"""Parse the two source PDFs into data/corpus.json.

Each record is one section of the Act, one regulation, one by-law, one schedule
or one form:
    {doc, kind, id, title, part, chapter, text, pages}

The arrangement (table of contents) at the front of each PDF is the checklist:
the script exits with an error if any listed section/regulation is not found.

Usage: python ingest.py
"""

import json
import re
import sys
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).parent
SOURCES = {"act": ROOT / "sources" / "act.pdf", "reg": ROOT / "sources" / "reg.pdf"}
OUT = ROOT / "data" / "corpus.json"

ROMAN = re.compile(r"^part([ivxl]+)$")
ROMAN_LEVEL = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"}


def norm(s: str) -> str:
    """Lowercase and drop everything but letters/digits, so PDF spacing glitches don't matter."""
    return re.sub(r"[^a-z0-9]", "", s.lower())


# ---------------------------------------------------------------------------
# Text extraction and cleanup
# ---------------------------------------------------------------------------

def read_lines(doc: str) -> list[tuple[int, str]]:
    """Return (page_number, line) for every line, with running page headers removed."""
    out = []
    for i, page in enumerate(PdfReader(SOURCES[doc]).pages, start=1):
        lines = (page.extract_text() or "").split("\n")
        if doc == "act":
            if lines and re.match(r"^(Strata Management \d+|Laws of Malaysia\s*\d+ Ac t\s+757)\s*$", lines[0]):
                lines = lines[1:]
        else:
            if lines and lines[0].startswith("P.U. (A)"):
                lines = lines[1:]
            if lines and re.fullmatch(r"\s*\d+\s*", lines[0]):
                lines = lines[1:]
        out.extend((i, ln) for ln in lines)
    return out


class Fixer:
    """Re-joins words the PDF split apart ("c harges", "Commis sioner", "by -laws").

    "x y" is joined only when "xy" appears in the documents at least as often as
    the split pair does, so real phrases like "be paid" or "a trial" are left alone.
    """

    def __init__(self, raw_text: str):
        tokens = re.findall(r"[a-z]+", raw_text.lower())
        self.counts = Counter(tokens)
        self.pairs = Counter(zip(tokens, tokens[1:]))
        self.joins: Counter = Counter()

    def is_word(self, w: str) -> bool:
        return w == "a" or (len(w) > 1 and self.counts[w] >= 10)

    def should_join(self, a: str, b: str, nxt: str = "") -> bool:
        a, b, nxt = a.lower(), b.lower(), nxt.lower()
        if self.is_word(a) and self.is_word(b):  # "are as", "with in"
            return False
        if len(a) == 1 and a != "a" and self.counts[a + b] and not self.is_word(b):  # "c ommissioners"
            return True
        if nxt and self.counts[b + nxt] > self.counts[a + b]:  # "the n otice" -> "the notice"
            return False
        return self.counts[a + b] >= max(2, self.pairs[(a, b)])

    def fix(self, s: str) -> str:
        s = re.sub(r"(\w) -(\w)", r"\1-\2", s)  # "by -laws" -> "by-laws"
        tokens = s.split(" ")
        out: list[str] = []
        for i, tok in enumerate(tokens):
            if out:
                prev = out[-1]
                m = re.fullmatch(r"([A-Za-z]+)([^A-Za-z]*)", tok)
                if re.fullmatch(r"[A-Za-z]+", prev) and m:
                    word, tail = m.groups()
                    joined = prev + word
                    nxt = ""
                    if not tail and i + 1 < len(tokens):
                        nxt = re.match(r"[A-Za-z]*", tokens[i + 1]).group(0)
                    if self.should_join(prev, word, nxt):
                        self.joins[f"{prev} {word}"] += 1
                        out[-1] = joined + tail
                        continue
            out.append(tok)
        s = " ".join(out)
        for pat, rep in TERMS:
            s = re.sub(pat, rep, s)
        return re.sub(r"[ \t]+", " ", s).strip()


# Defined terms the PDF's small-caps text loses the capitals on, plus stray spacing.
TERMS = [
    (r"(?i)\bex is tenc e\b", "existence"),
    (r"\bc ?ommissioner(s?)\b", r"Commissioner\1"),
    (r"\bstate Authority", "State Authority"),
    (r"\bstrata Titles Act", "Strata Titles Act"),
    (r"(?i)\bstrata management tribunal\b", "Strata Management Tribunal"),
    (r"\bcentral Bank", "Central Bank"),
    (r"\bislamic Banking", "Islamic Banking"),
    (r"\bHigh court\b", "High Court"),
    (r"\bMagistrate’s c ourt", "Magistrate’s Court"),
    (r"(\w) +([,.;:])(?=\s|$)", r"\1\2"),
]


def reflow(lines: list[str], fx: Fixer) -> str:
    """Join hard-wrapped PDF lines into paragraphs. A new paragraph starts at a
    subsection/paragraph marker like (1), (a), (i), a definition quote, a numbered
    paragraph, or a blank line. Headings (inside schedules and forms) become "## ..." lines."""
    stripped = [ln.strip() for ln in lines]
    paras: list[str] = []
    cur = ""
    cur_heading = False

    def close():
        nonlocal cur, cur_heading
        if cur:
            paras.append(("## " if cur_heading else "") + cur)
        cur, cur_heading = "", False

    for i, ln in enumerate(stripped):
        if not ln:
            close()
            continue
        nxt = next((s for s in stripped[i + 1:] if s), "")
        upper = ln.upper() == ln and len(re.findall(r"[A-Z]", ln)) >= 3
        heading = upper or (
            len(ln) < 70 and not re.search(r"[.,;:—–-]$", ln) and re.match(r"^\d+[A-Z]?\.\s", nxt)
            and not re.match(r"^(\(\w+\)|\d+[A-Z]?\.\s)", ln)
        )
        if heading:
            if not (cur_heading and upper):
                close()
                cur_heading = True
            cur = f"{cur} {ln}".strip()
            continue
        if cur_heading:
            close()
        starts_new = bool(re.match(r"^(\(\d+[A-Z]?\)|\([a-z]{1,4}\)|“|\"|\[|\d+[A-Z]?\.\s)", ln))
        if starts_new and cur:
            close()
            cur = ln
        elif not cur:
            cur = ln
        elif cur.endswith(("-", "—", "–")):
            cur += ln
        else:
            cur += " " + ln
    close()
    paras = [fx.fix(p) for p in paras]
    return "\n".join(p for p in paras if p)


def sentence_case(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return s
    s = s.lower()
    s = re.sub(r"\bact\b", "Act", s)
    s = re.sub(r"\btribunal\b", "Tribunal", s)
    for pat, rep in TERMS:
        s = re.sub(pat, rep, s)
    return s[0].upper() + s[1:]


def cap_first(s: str) -> str:
    return s[:1].upper() + s[1:] if s else s


# ---------------------------------------------------------------------------
# Table of contents
# ---------------------------------------------------------------------------

def parse_toc(lines: list[str], fx: Fixer) -> list[dict]:
    """Return [{id, title, part, chapter}] in order, from the 'Arrangement of ...' pages."""
    entries: list[dict] = []
    part_label = part_title = chapter_label = chapter_title = ""
    mode = None  # "part" | "chapter" | "entry"
    for raw in lines:
        ln = raw.strip()
        n = norm(ln)
        if not n or n in ("section", "regulation"):
            continue
        if ROMAN.match(n):
            part_label = "Part " + ROMAN.match(n).group(1).upper()
            part_title, chapter_label, chapter_title, mode = "", "", "", "part"
            continue
        m = re.match(r"^chapter(\d+)$", n)
        if m:
            chapter_label, chapter_title, mode = f"Chapter {m.group(1)}", "", "chapter"
            continue
        m = re.match(r"^(\d+[A-Z]?)\.\s+(.*)$", ln)
        if m:
            entries.append({
                "id": m.group(1),
                "title": m.group(2),
                "part": part_label,
                "part_title": part_title,
                "chapter": chapter_label,
                "chapter_title": chapter_title,
            })
            mode = "entry"
            continue
        if mode == "part":
            part_title += " " + ln
        elif mode == "chapter":
            chapter_title += " " + ln
        elif mode == "entry":
            entries[-1]["title"] += " " + ln
    for e in entries:
        e["title"] = cap_first(fx.fix(re.sub(r"\s+", " ", e["title"])))
        e["part_title"] = sentence_case(fx.fix(e["part_title"]))
        e["chapter_title"] = cap_first(fx.fix(re.sub(r"\s+", " ", e["chapter_title"]).strip()))
    return entries


def heading_block(entry: dict, prev: dict | None) -> str:
    """Normalised text of every heading line printed just above a section in the body."""
    s = ""
    if prev is None or entry["part"] != prev["part"]:
        s += norm(entry["part"]) + norm(entry["part_title"])
    if entry["chapter"] and (prev is None or entry["chapter"] != prev["chapter"] or entry["part"] != prev["part"]):
        s += norm(entry["chapter"]) + norm(entry["chapter_title"])
    return s + norm(entry["title"])


def similar(a: str, b: str) -> bool:
    return SequenceMatcher(None, a, b).ratio() > 0.85


def heading_lines_above(body: list[tuple[int, str]], idx: int, expected: str, title: str) -> int:
    """How many lines directly above body[idx] are the heading block (Part/Chapter/marginal title)."""
    acc = ""
    j = idx - 1
    taken = 0
    while j >= 0:
        n = norm(body[j][1])
        if n:
            if not expected.endswith(n + acc):
                break
            acc = n + acc
            taken = idx - j
        j -= 1
    if taken:
        return taken
    # The body heading can differ slightly from the ToC (e.g. "Released"/"Release of things seized").
    acc = ""
    for j in range(idx - 1, max(idx - 6, -1), -1):
        acc = norm(body[j][1]) + acc
        if similar(acc, title):
            return idx - j
    return 0


def find_sections(body: list[tuple[int, str]], toc: list[dict], begin: int, end: int) -> list[dict]:
    """Locate each ToC entry in the body (sequentially) and slice its text."""
    starts = []
    pos = begin
    for k, e in enumerate(toc):
        prev = toc[k - 1] if k else None
        expected_title = norm(e["title"])
        pat = re.compile(rf"^\s*{re.escape(e['id'])}\.\s")
        candidates = [i for i in range(pos, end) if pat.match(body[i][1])]
        if not candidates:
            sys.exit(f"ERROR: could not find {e['id']}. {e['title']}")
        chosen = None
        for i in candidates:
            # Confirm by checking that the marginal heading above matches the ToC title.
            acc = ""
            j = i - 1
            while j >= 0 and len(acc) < len(expected_title):
                n = norm(body[j][1])
                if n:
                    acc = n + acc
                j -= 1
            if acc.endswith(expected_title) or similar(acc[-len(expected_title):], expected_title):
                chosen = i
                break
        if chosen is None:
            print(f"  warn: heading not confirmed for {e['id']}. {e['title']} — using first match")
            chosen = candidates[0]
        starts.append(chosen)
        pos = chosen + 1

    records = []
    for k, e in enumerate(toc):
        start = starts[k]
        stop = starts[k + 1] if k + 1 < len(toc) else end
        if k + 1 < len(toc):
            stop -= heading_lines_above(body, stop, heading_block(toc[k + 1], e), norm(toc[k + 1]["title"]))
        chunk = body[start:stop]
        first = re.sub(rf"^\s*{re.escape(e['id'])}\.\s*", "", chunk[0][1])
        records.append({
            "lines": [first] + [ln for _, ln in chunk[1:]],
            "pages": [chunk[0][0], chunk[-1][0]],
            **e,
        })
    return records


# ---------------------------------------------------------------------------
# Per-document parsing
# ---------------------------------------------------------------------------

def index_of(body: list[tuple[int, str]], predicate, start: int = 0) -> int:
    for i in range(start, len(body)):
        if predicate(body[i][1]):
            return i
    raise ValueError("marker not found")


def split_blocks(body, starts: list[tuple[int, str, str]], end: int) -> list[tuple[str, str, list]]:
    """starts = [(line_index, id, title)] -> [(id, title, slice)]"""
    out = []
    for k, (i, bid, title) in enumerate(starts):
        stop = starts[k + 1][0] if k + 1 < len(starts) else end
        out.append((bid, title, body[i:stop]))
    return out


def parse_act(fx: Fixer) -> list[dict]:
    body = read_lines("act")
    toc_start = index_of(body, lambda s: norm(s) == "arrangementofsections")
    body_start = index_of(body, lambda s: s.strip().startswith("An Act to provid"), toc_start)
    sched_start = index_of(body, lambda s: is_act_schedule(s, "first"), body_start)
    toc_end = index_of(body, lambda s: is_act_schedule(s, "first"), toc_start)
    toc = parse_toc([ln for _, ln in body[toc_start + 1:toc_end]], fx)

    records = []
    for r in find_sections(body, toc, body_start, sched_start):
        records.append(make_record("act", "section", r["id"], r["title"], r, r["lines"], r["pages"], fx))

    names = ["first", "second", "third", "fourth"]
    starts = []
    for k, name in enumerate(names):
        i = index_of(body, lambda s, name=name: is_act_schedule(s, name), sched_start)
        starts.append((i, f"sch-{k + 1}", f"{name.capitalize()} Schedule"))
    for bid, title, chunk in split_blocks(body, starts, len(body)):
        lines = [ln for _, ln in chunk[1:]]
        subtitle = schedule_subtitle(lines)
        records.append(make_record(
            "act", "schedule", bid, f"{title} — {subtitle}" if subtitle else title,
            {"part": "Schedules", "part_title": "", "chapter": "", "chapter_title": ""},
            lines, [chunk[0][0], chunk[-1][0]], fx,
        ))
    return records


def is_act_schedule(line: str, name: str) -> bool:
    """Schedule headings in the Act are letter-spaced ("se c o n d s c h e d u l e"),
    which tells them apart from in-text mentions like "the Second Schedule".
    """
    return norm(line) == f"{name}schedule" and "s c h e d u l e" in line.lower()


def schedule_subtitle(lines: list[str]) -> str:
    """The uppercase heading right after the '[Section X]' line of a schedule."""
    words = []
    for ln in lines:
        s = ln.strip()
        if not s or s.startswith("[") or s.startswith("("):
            if words:
                break
            continue
        if s.upper() == s and re.search(r"[A-Z]", s):
            if "STRATA MANAGEMENT" in s:
                continue
            words.append(s)
        elif words:
            break
        else:
            continue
    return sentence_case(" ".join(words))[:120]


def parse_reg(fx: Fixer) -> list[dict]:
    body = read_lines("reg")
    toc_start = index_of(body, lambda s: norm(s) == "arrangementofregulations")
    body_start = index_of(body, lambda s: s.strip().startswith("IN exercise of the powers"), toc_start)
    toc_end = index_of(body, lambda s: s.strip() == "FIRST SCHEDULE", toc_start)
    sched1 = index_of(body, lambda s: s.strip() == "FIRST SCHEDULE", body_start)
    sched2 = index_of(body, lambda s: s.strip() == "SECOND SCHEDULE", sched1)
    sched3 = index_of(body, lambda s: s.strip() == "THIRD SCHEDULE", sched2)
    toc = parse_toc([ln for _, ln in body[toc_start + 1:toc_end]], fx)

    records = []
    for r in find_sections(body, toc, body_start, sched1):
        records.append(make_record("reg", "section", r["id"], r["title"], r, r["lines"], r["pages"], fx))

    sched_meta = {"part": "Schedules", "part_title": "", "chapter": "", "chapter_title": ""}
    chunk = body[sched1:sched2]
    records.append(make_record("reg", "schedule", "sch-1", "First Schedule — Fees", sched_meta,
                               [ln for _, ln in chunk[1:]], [chunk[0][0], chunk[-1][0]], fx))

    # Second Schedule: one record per form.
    form_starts = []
    for i in range(sched2, sched3):
        m = re.fullmatch(r"\s*FORM (\d+[A-Z]?)\s*", body[i][1])
        if m:
            form_starts.append((i, f"form-{m.group(1)}", f"Form {m.group(1)}"))
    for bid, title, ch in split_blocks(body, form_starts, sched3):
        lines = [ln for _, ln in ch[1:]]
        sub = next((ln.strip() for ln in lines if ln.strip() and not ln.strip().startswith("[")), "")
        records.append(make_record(
            "reg", "form", bid, f"{title} — {sentence_case(sub)}" if sub else title,
            {"part": "Second Schedule — Forms", "part_title": "", "chapter": "", "chapter_title": ""},
            lines, [ch[0][0], ch[-1][0]], fx,
        ))

    records.extend(parse_bylaws(body, sched3, fx))
    return records


def parse_bylaws(body, start: int, fx: Fixer) -> list[dict]:
    """Third Schedule of the Regulations: the by-laws, numbered 1..N, grouped in Parts."""
    end = index_of(body, lambda s: s.strip().startswith("Made "), start)
    starts = []
    part = ""
    parts_at: dict[int, str] = {}
    expected = 1
    i = start
    while i < end:
        ln = body[i][1].strip()
        m = re.fullmatch(r"PART (\d+)", ln)
        if m:
            title = body[i + 1][1].strip()
            part = f"Part {m.group(1)} — {sentence_case(title)}"
        m = re.match(rf"^{expected}\.\s+(\S.*)$", ln)
        if m and not ln.startswith(f"{expected}. (") and len(ln) < 100:
            title = m.group(1)
            # Titles can wrap onto the next non-blank line(s).
            j = i + 1
            while j < end and body[j][1].strip() and not body[j][1].strip().startswith("("):
                nxt = body[j][1].strip()
                if len(nxt) > 60 or nxt.endswith((".", ":", "–", "—", ";")):
                    break
                title += " " + nxt
                j += 1
            starts.append((i, j, f"bl-{expected}", title.strip()))
            parts_at[expected] = part
            expected += 1
            i = j
            continue
        i += 1
    records = []
    for k, (i, j, bid, title) in enumerate(starts):
        stop = starts[k + 1][0] if k + 1 < len(starts) else end
        lines = [ln for _, ln in body[j:stop]]
        # Drop a "PART n / TITLE" heading that belongs to the next by-law.
        tail = [ln.strip() for ln in lines]
        while tail and (not tail[-1] or tail[-1].upper() == tail[-1]):
            last = tail.pop()
            lines.pop()
            if re.fullmatch(r"PART \d+", last):
                break
        n = int(bid.split("-")[1])
        records.append(make_record(
            "reg", "bylaw", bid, fx.fix(title),
            {"part": "Third Schedule — By-laws", "part_title": "", "chapter": parts_at[n], "chapter_title": ""},
            lines, [body[i][0], body[stop - 1][0]], fx,
        ))
    return records


def make_record(doc, kind, rid, title, meta, lines, pages, fx) -> dict:
    text = reflow(lines, fx)
    text = "\n".join(re.sub(r"^((?:\(\w+\)\s*)?)([a-z])", lambda m: m.group(1) + m.group(2).upper(), p)
                     for p in text.split("\n"))
    return {
        "doc": doc,
        "kind": kind,
        "id": rid,
        "title": title,
        "part": meta["part"],
        "part_title": meta["part_title"],
        "chapter": meta["chapter"],
        "chapter_title": meta["chapter_title"],
        "pages": pages,
        "text": text,
    }


def main():
    raw = "\n".join(
        (p.extract_text() or "") for doc in SOURCES for p in PdfReader(SOURCES[doc]).pages
    )
    fx = Fixer(raw)
    act = parse_act(fx)
    reg = parse_reg(fx)
    records = act + reg

    def count(doc, kind):
        return sum(1 for r in records if r["doc"] == doc and r["kind"] == kind)

    print(f"Act: {count('act', 'section')} sections, {count('act', 'schedule')} schedules")
    print(f"Regulations: {count('reg', 'section')} regulations, {count('reg', 'schedule')} schedule, "
          f"{count('reg', 'form')} forms, {count('reg', 'bylaw')} by-laws")
    empty = [f"{r['doc']} {r['id']}" for r in records if len(r["text"]) < 20]
    if empty:
        print("  warn: near-empty records:", ", ".join(empty))
    if "-v" in sys.argv:
        for pair, c in fx.joins.most_common():
            print(f"  joined {pair!r} x{c}")

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(records, ensure_ascii=False, indent=1))
    print(f"Wrote {OUT} ({len(records)} records)")


if __name__ == "__main__":
    main()
