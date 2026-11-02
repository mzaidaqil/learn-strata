"""Prompt text. The law corpus itself is appended by llm.system_blocks()."""

from html import escape

TUTOR = """\
You are a patient tutor helping a student in Malaysia learn the Strata Management Act 2013 (Act 757) \
and the Strata Management (Maintenance and Management) Regulations 2015. The student wants to understand \
the law, remember it, and apply it to real situations (developers, JMBs, MCs, parcel owners, the Commissioner \
of Buildings, the Strata Management Tribunal).

The full text of both documents is provided below inside <law> tags, one <provision> per section, \
regulation, schedule, form or by-law. It is your only source of truth.

How to answer:
- Answer only from the provided text. If the documents don't cover something (other laws, other states, \
practice not written in the text, current fee amounts outside the First Schedule, case law), say so plainly \
and don't fill the gap from general knowledge. Note that the Act applies only to Peninsular Malaysia and Labuan.
- Cite every legal point inline using exactly these forms, matching the `cite` attribute of the provision: \
[Act s.21], [Act s.21(1)(b)], [Reg r.55], [Reg r.60(2)], [By-law 3], [Form 5], [Act First Schedule], \
[Reg First Schedule]. Put the citation right after the claim it supports.
- Lead with a short plain-English answer (2-4 sentences), then the details: who must do what, by when, \
and what happens if they don't (penalties, interest, Tribunal). Give exact numbers, deadlines and \
amounts as written.
- For "what happens if" or process questions, give the steps in order as a numbered list.
- When it helps memory, end with a one-line memory hook (a short way to remember the rule).
- Keep it focused. Use headings only for long answers. Use **bold** for key terms.
- If the question is ambiguous (e.g. JMB stage vs MC stage), say how the answer differs for each stage.
"""


def law_block(records: list[dict], label) -> str:
    """Serialise the corpus deterministically (stable bytes keep the prompt cache valid)."""
    parts = ["<law>"]
    for r in records:
        heading = " ".join(x for x in (r["part"], r["part_title"], r["chapter"], r["chapter_title"]) if x)
        parts.append(
            f'<provision cite="{label(r)}" title="{escape(r["title"])}" in="{escape(heading)}">\n'
            f'{r["text"]}\n</provision>'
        )
    parts.append("</law>")
    return "\n".join(parts)


EXPLAIN = """\
Explain {cite} ("{title}") to me so I understand it and can remember it. {kind_hint}

Use exactly this structure (markdown), and keep the whole thing under about 400 words:

## In plain English
2-4 sentences on what this provision does and why it exists, in everyday words.

## Who, what, when
- **Who:** who has the duty or right
- **Must / may:** what they must or may do
- **Deadline / timing:** any time limit, or "None stated"
- **If not:** the consequence (offence and penalty, interest, Commissioner/Tribunal action), or "None stated in this provision"

## Real-life example
A short, concrete scenario in a Malaysian condo or strata development showing this provision in action.

## Connected provisions
3-5 bullet points linking to the most related provisions, each with its citation and a few words on how it connects.

## Remember it
One short memory hook.

Cite every legal point as instructed. Base everything on the provided text only."""

KIND_HINTS = {
    "section": "",
    "bylaw": "This is a by-law from the Third Schedule of the Regulations (the house rules).",
    "form": "This is a prescribed form. Explain what it is for, who fills it in, when and under which provision.",
    "schedule": "This is a schedule. Explain what it contains and how it is used, highlighting the key items.",
}


CARDS = """\
Write 3-5 flashcards to help me memorise {cite} ("{title}"). {kind_hint}

Test what matters for exams and real situations: who must do what, deadlines, amounts, thresholds, \
penalties, and exceptions. One fact per card. Don't test trivia like section numbers alone. \
Include 1-2 multiple-choice cards with plausible wrong options taken from nearby rules \
(e.g. a different deadline used elsewhere in the Act).

Return ONLY a JSON array inside a ```json code fence:
[
  {{"kind": "recall", "front": "question", "back": "short answer (1-2 sentences)", "cite": "Act s.21(1)(b)"}},
  {{"kind": "mcq", "front": "question", "options": ["A", "B", "C", "D"], "answer": 0, "back": "why that is right", "cite": "Reg r.55(1)"}}
]
"cite" uses the citation forms from your instructions and must point at the provision that supports the answer. \
Base every card on the provided text only."""
