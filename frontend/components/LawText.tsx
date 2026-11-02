import Link from "next/link";
import type { ReactNode } from "react";
import type { Doc } from "@/lib/api";

const ROMAN = new Set(["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"]);

/** Indent level from the paragraph marker: (1) → 0, (a) → 1, (i) → 2, (A) → 3. */
function levels(paras: string[]): number[] {
  let lastLetter = "";
  return paras.map((p) => {
    const m = p.match(/^\(([0-9]+[A-Z]?|[a-z]{1,4}|[A-Z])\)/);
    if (!m) return 0;
    const mk = m[1];
    if (/^[0-9]/.test(mk)) return 0;
    if (/^[A-Z]$/.test(mk)) return 3;
    const romanNotLetter =
      ROMAN.has(mk) &&
      !(mk === "i" && lastLetter === "h") &&
      !(mk === "v" && lastLetter === "u") &&
      !(mk === "x" && lastLetter === "w");
    if (romanNotLetter) return 2;
    lastLetter = mk;
    return 1;
  });
}

// "section 24", "subsection 24(2)", "sections 10", "regulation 13", "subregulation 51(1)", "paragraph ..." is left alone.
const REF = /\b(sub)?(section|regulation)s?\s+(\d+[A-Z]?)((?:\(\w+\))*)/g;

/** Turn cross-references into links into the Reader. */
function linkify(text: string, doc: Doc, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(REF)) {
    const [whole, , kind, num] = m;
    const after = text.slice(m.index! + whole.length, m.index! + whole.length + 40);
    const target: Doc = kind === "regulation" ? "reg" : "act";
    // "section 4 of the Strata Titles Act 1985" points at another law — don't link it.
    const otherLaw = /^[^.;]*?\bof the (?!Strata Management Act|Act\b)[A-Z][\w ]*Act\b/.test(after);
    // The Act never cites regulations by number; the Regulations cite sections as "... of the Act".
    const skip =
      otherLaw ||
      (doc === "act" && target === "reg") ||
      (doc === "reg" && target === "act" && !/\bof the (Strata Management )?Act\b/.test(after));
    if (skip) continue;
    out.push(text.slice(last, m.index));
    out.push(
      <Link
        key={`${keyPrefix}-${m.index}`}
        href={`/read/${target}/${num}`}
        className="text-teal-700 underline decoration-teal-700/30 underline-offset-2 hover:decoration-teal-700 dark:text-teal-300 dark:decoration-teal-300/30"
      >
        {whole}
      </Link>,
    );
    last = m.index! + whole.length;
  }
  out.push(text.slice(last));
  return out;
}

/** Bold the term being defined: “sinking fund account” means ... */
function withDefinition(p: string, doc: Doc, key: string): ReactNode[] {
  const m = p.match(/^(“[^”]+”)([\s\S]*)$/);
  if (!m) return linkify(p, doc, key);
  return [<strong key={`${key}-def`} className="font-semibold">{m[1]}</strong>, ...linkify(m[2], doc, key)];
}

export default function LawText({ text, doc }: { text: string; doc: Doc }) {
  const paras = text.split("\n");
  const lv = levels(paras);
  return (
    <div className="law-text space-y-3 font-serif text-base leading-7 [overflow-wrap:anywhere] sm:text-[17px]">
      {paras.map((p, i) => {
        if (p.startsWith("## ")) {
          return (
            <h3 key={i} className="pt-4 font-sans text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              {p.slice(3)}
            </h3>
          );
        }
        return (
          <p key={i} style={{ marginLeft: `${lv[i] * 1.75}rem` }}>
            {withDefinition(p, doc, String(i))}
          </p>
        );
      })}
    </div>
  );
}
