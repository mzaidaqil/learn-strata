// Server-side access to the law text and process maps, bundled with the app as static JSON
// (copied from backend/data by `npm run sync-data`). Import only from server components:
// the JSON is ~650 KB and must not end up in client bundles.
import corpusData from "@/data/corpus.json";
import mapsData from "@/data/maps.json";
import type { Doc, LawRecord, ProcessMap, SearchHit, TocDoc } from "@/lib/api";

type Raw = Omit<LawRecord, "doc_name" | "label" | "prev" | "next">;

const records = corpusData as Raw[];
const maps = mapsData as ProcessMap[];
const index = new Map(records.map((r, i) => [`${r.doc}/${r.id}`, i]));

export const DOC_NAMES: Record<Doc, string> = {
  act: "Strata Management Act 2013 (Act 757)",
  reg: "Strata Management (Maintenance and Management) Regulations 2015",
};

/** Short citation label, e.g. "Act s.21", "Reg r.55", "By-law 3", "Form 5". */
export function label(r: Raw): string {
  if (r.kind === "section") return r.doc === "act" ? `Act s.${r.id}` : `Reg r.${r.id}`;
  if (r.kind === "bylaw") return `By-law ${r.id.split("-")[1]}`;
  if (r.kind === "form") return `Form ${r.id.split("-")[1]}`;
  return `${r.doc === "act" ? "Act" : "Reg"} ${r.title.split(" — ")[0]}`;
}

export async function getRecord(doc: string, id: string): Promise<LawRecord | null> {
  const i = index.get(`${doc}/${id}`);
  if (i === undefined) return null;
  const r = records[i];
  const prev = i > 0 && records[i - 1].doc === r.doc ? records[i - 1] : null;
  const next = i + 1 < records.length && records[i + 1].doc === r.doc ? records[i + 1] : null;
  return {
    ...r,
    doc_name: DOC_NAMES[r.doc],
    label: label(r),
    prev: prev && { id: prev.id, title: prev.title },
    next: next && { id: next.id, title: next.title },
  };
}

/** Every provision, for pre-rendering all Reader pages at build time. */
export const allRecordParams = () => records.map((r) => ({ doc: r.doc, id: r.id }));
export const allMapParams = () => maps.map((m) => ({ slug: m.slug }));

export async function getToc(): Promise<TocDoc[]> {
  return (Object.keys(DOC_NAMES) as Doc[]).map((doc) => {
    const groups: TocDoc["groups"] = [];
    for (const r of records) {
      if (r.doc !== doc) continue;
      if (!groups.length || groups[groups.length - 1].part !== r.part) {
        groups.push({ part: r.part, part_title: r.part_title, chapters: [] });
      }
      const chapters = groups[groups.length - 1].chapters;
      if (!chapters.length || chapters[chapters.length - 1].chapter !== r.chapter) {
        chapters.push({ chapter: r.chapter, chapter_title: r.chapter_title, items: [] });
      }
      chapters[chapters.length - 1].items.push({ id: r.id, kind: r.kind, title: r.title });
    }
    return { doc, name: DOC_NAMES[doc], groups };
  });
}

/** Plain keyword search: every word must appear; title hits rank higher. */
export async function search(q: string, limit = 30): Promise<SearchHit[]> {
  const words = (q.toLowerCase().match(/[a-z0-9-]+/g) ?? []).filter((w) => w.length > 1);
  if (!words.length) return [];
  const count = (s: string, w: string) => s.split(w).length - 1;
  const hits = [];
  for (const r of records) {
    const title = r.title.toLowerCase();
    const text = r.text.toLowerCase();
    if (!words.every((w) => title.includes(w) || text.includes(w))) continue;
    const score = words.reduce((s, w) => s + 5 * count(title, w) + count(text, w), 0);
    const positions = words.map((w) => text.indexOf(w)).filter((p) => p >= 0);
    const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 80);
    const snippet = (start ? "…" : "") + r.text.slice(start, start + 220).replace(/\n/g, " ") + "…";
    hits.push({ doc: r.doc, id: r.id, title: r.title, label: label(r), snippet, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

export async function listMaps() {
  return maps.map((m) => ({ slug: m.slug, title: m.title, summary: m.summary, steps: m.steps.length }));
}

export async function getMap(slug: string): Promise<ProcessMap | null> {
  return maps.find((m) => m.slug === slug) ?? null;
}

/** The original PDF (served from public/pdf), opened at a page. */
export const pdfUrl = (doc: Doc, page: number) => `/pdf/${doc}.pdf#page=${page}`;
