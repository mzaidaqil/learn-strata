export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export type Doc = "act" | "reg";
export type Kind = "section" | "schedule" | "form" | "bylaw";

export interface TocItem {
  id: string;
  kind: Kind;
  title: string;
}

export interface TocChapter {
  chapter: string;
  chapter_title: string;
  items: TocItem[];
}

export interface TocGroup {
  part: string;
  part_title: string;
  chapters: TocChapter[];
}

export interface TocDoc {
  doc: Doc;
  name: string;
  groups: TocGroup[];
}

export interface LawRecord {
  doc: Doc;
  doc_name: string;
  kind: Kind;
  id: string;
  label: string;
  title: string;
  part: string;
  part_title: string;
  chapter: string;
  chapter_title: string;
  pages: [number, number];
  text: string;
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
}

export interface SearchHit {
  doc: Doc;
  id: string;
  title: string;
  label: string;
  snippet: string;
}

async function get<T>(path: string): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, { cache: "no-store" });
  } catch {
    throw new Error(
      `Can't reach the backend at ${BACKEND_URL}. Start it with: cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000`,
    );
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Backend error ${res.status} on ${path}`);
  return res.json();
}

export const getExplanation = (doc: string, id: string) =>
  get<{ content: string | null }>(`/explain/${doc}/${encodeURIComponent(id)}`).then((r) => r?.content ?? null);

export const getExplained = () =>
  get<{ doc: Doc; rid: string }[]>("/explain").then((r) => (r ?? []).map((x) => `${x.doc}/${x.rid}`));

export interface MapStep {
  title: string;
  actor: string;
  detail: string;
  deadline: string | null;
  penalty: string | null;
  branches: { if: string; then: string; cites: string[] }[];
  cites: string[];
}

export interface ProcessMap {
  slug: string;
  title: string;
  summary: string;
  steps: MapStep[];
  key_numbers: { label: string; value: string; cite: string }[];
  memory_hook: string;
}

export interface PartProgress {
  doc: Doc;
  part: string;
  part_title: string;
  first_id: string;
  provisions: number;
  explained: number;
  with_cards: number;
  cards: number;
  mastered: number;
  due: number;
  missing: string[];
}

export interface Progress {
  stats: { total: number; due: number; new: number; mastered: number; reviewed_today: number };
  parts: PartProgress[];
}

export const getProgress = () => get<Progress>("/cards/progress");
export const getProvisionCardCount = (doc: string, id: string) =>
  get<unknown[]>(`/cards/provision/${doc}/${encodeURIComponent(id)}`).then((c) => c?.length ?? 0);

/** "Section 21", "Regulation 55", "By-law 3", "Form 5", "First Schedule" */
export function heading(doc: Doc, kind: Kind, id: string): string {
  if (kind === "section") return doc === "act" ? `Section ${id}` : `Regulation ${id}`;
  if (kind === "bylaw") return `By-law ${id.split("-")[1]}`;
  return "";
}
