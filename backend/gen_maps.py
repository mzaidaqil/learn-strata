"""Generate the process maps (data/maps.json) with Claude, grounded in the corpus.

Every citation in the output is checked against corpus.json; a map with an unknown
citation is regenerated once, and the script fails if it is still wrong.

Usage: .venv/bin/python gen_maps.py            # all maps
       .venv/bin/python gen_maps.py tribunal   # only maps whose slug contains "tribunal"
"""

import asyncio
import json
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from app import corpus, llm  # noqa: E402

OUT = Path(__file__).parent / "data" / "maps.json"

MAPS = [
    ("jmb-lifecycle", "From developer to Joint Management Body (JMB)",
     "Developer's management period, establishing the JMB, the first JMB AGM, running the JMB, and handing over "
     "to the management corporation. Focus: Act ss.7-28, Regs 11-15."),
    ("mc-lifecycle", "Management Corporation (MC): preliminary period to first AGM",
     "How the MC comes into existence, the developer's preliminary management period, the first MC AGM, the "
     "management committee and handover of control. Focus: Act ss.46-62, Regs 22-24."),
    ("subsidiary-mc", "Subsidiary MC and limited common property",
     "Limited common property, how a subsidiary management corporation is run, its accounts and charges, and its "
     "first AGM. Focus: Act ss.63-71, Regs 25-27."),
    ("unpaid-charges", "Recovering unpaid charges",
     "What happens when a purchaser/parcel owner/proprietor doesn't pay charges or sinking fund contributions: "
     "interest, written demand, debt recovery, offences, attachment of movable property and auction. "
     "Cover both the JMB stage and the MC stage. Focus: Act ss.33-35, 77-79, Regs 20, 31, 35-42."),
    ("inter-floor-leakage", "Inter-floor leakage and party-wall damage",
     "Leak from the unit above (and party-wall damage): notice, inspection, determining the cause, certificate, "
     "who must repair and when, access, and appeal to the Commissioner. Focus: Regs 55-67."),
    ("defects-deposit", "Developer's deposit to rectify common property defects",
     "Notice before vacant possession, amount and payment of the deposit, the Common Property Defects Account, "
     "claims, rectification by the developer or by the Commissioner, recovery and refund. Focus: Act s.92, Regs 46-54."),
    ("tribunal-claim", "Strata Management Tribunal claim",
     "Who can file, what claims the Tribunal can hear, filing, hearing, negotiation/settlement, award, "
     "challenging the award, and the penalty for not complying. Focus: Act ss.101-124."),
    ("accounts-funds", "Maintenance account vs sinking fund",
     "Who opens each account at each stage (developer, JMB, MC, subsidiary MC), who pays, how much (share units), "
     "what each fund may be used for, accounts and audit duties, and what happens to balances at handover. "
     "Focus: Act ss.10-14, 23-26, 50-54, 60-62, 66-68."),
    ("managing-agent", "Managing agent appointed by the Commissioner",
     "When the Commissioner appoints a managing agent, independence, bond, powers and duties, charges during "
     "management, and termination. Focus: Act ss.86-91, Regs 43-45."),
]

PROMPT = """\
Build a study "process map" for this topic: **{title}**.
Scope: {scope}
Include related provisions from elsewhere in the Act or Regulations where they matter to the process.

Return ONLY a JSON object inside a ```json code fence, with this shape:
{{
  "summary": "2-3 sentences: what this process is and when it applies",
  "steps": [
    {{
      "title": "short step name (max ~8 words)",
      "actor": "who acts (e.g. Developer, JMB, Parcel owner, Commissioner, Tribunal)",
      "detail": "1-3 plain-English sentences on what happens, with exact numbers as written",
      "deadline": "time limit as written, or null",
      "penalty": "consequence/offence for not doing it, or null",
      "branches": [{{"if": "condition", "then": "what happens instead", "cites": ["..."]}}],
      "cites": ["Act s.17(1)", "Reg r.12(1)"]
    }}
  ],
  "key_numbers": [{{"label": "what the number is", "value": "e.g. 12 months / RM250,000 / 14 days", "cite": "Act s.17(1)"}}],
  "memory_hook": "one short line to remember the whole process"
}}

Rules:
- 5-10 steps in chronological order. "branches" is [] when there is no decision point.
- Every citation must use exactly these forms: "Act s.N", "Act s.N(x)(y)", "Reg r.N", "Reg r.N(x)", "By-law N", "Form N", "Act First Schedule" (etc.). One provision per string.
- Only state what the provided text says. No general knowledge.
- 4-10 key_numbers: the deadlines, amounts and thresholds most worth memorising."""

def all_cites(m: dict) -> list[str]:
    out = []
    for s in m["steps"]:
        out += s.get("cites", [])
        for b in s.get("branches", []):
            out += b.get("cites", [])
    out += [k["cite"] for k in m.get("key_numbers", []) if k.get("cite")]
    return out


async def generate(slug: str, title: str, scope: str) -> dict:
    for attempt in (1, 2):
        text, usage = "", None
        async for item in llm.stream_text([{"role": "user", "content": PROMPT.format(title=title, scope=scope)}]):
            if isinstance(item, str):
                text += item
            else:
                usage = item["usage"]
        m = re.search(r"```json\s*(\{.*\})\s*```", text, re.S)
        try:
            data = json.loads(m.group(1) if m else text)
        except (json.JSONDecodeError, AttributeError):
            print(f"  {slug}: attempt {attempt} returned invalid JSON")
            continue
        bad = [c for c in all_cites(data) if not corpus.cite_exists(c)]
        print(f"  {slug}: {len(data['steps'])} steps, {len(all_cites(data))} cites, "
              f"bad={bad or 'none'}, cache_read={usage['cache_read']}, out={usage['output']}")
        if not bad:
            return {"slug": slug, "title": title, **data}
    sys.exit(f"ERROR: {slug} failed validation twice")


async def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ""
    todo = [m for m in MAPS if only in m[0]]
    existing = {m["slug"]: m for m in json.loads(OUT.read_text())} if OUT.exists() else {}
    # First request warms the prompt cache; the rest run in parallel and read from it.
    first = await generate(*todo[0])
    rest = await asyncio.gather(*(generate(*m) for m in todo[1:]))
    for m in [first, *rest]:
        existing[m["slug"]] = m
    order = [slug for slug, _, _ in MAPS]
    maps = sorted(existing.values(), key=lambda m: order.index(m["slug"]))
    OUT.write_text(json.dumps(maps, ensure_ascii=False, indent=1))
    print(f"Wrote {OUT} ({len(maps)} maps)")


if __name__ == "__main__":
    asyncio.run(main())
