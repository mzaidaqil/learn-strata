import { BACKEND_URL } from "./api";

export interface Card {
  id: number;
  doc: string | null;
  rid: string | null;
  source: string;
  kind: "recall" | "mcq";
  front: string;
  back: string;
  options: string[] | null;
  answer: number | null;
  cite: string | null;
  interval: number;
  reps: number;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, { cache: "no-store", ...init });
  } catch {
    throw new Error(`Can't reach the backend at ${BACKEND_URL}. Is it running?`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Backend error ${res.status}`);
  }
  return res.json();
}

const post = <T>(path: string, body?: unknown) =>
  call<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });

export const provisionCards = (doc: string, id: string) => call<Card[]>(`/cards/provision/${doc}/${encodeURIComponent(id)}`);
export const generateCards = (doc: string, id: string) => post<Card[]>(`/cards/generate/${doc}/${encodeURIComponent(id)}`);
export const cardsFromMap = (slug: string) => post<{ added: number; total: number }>(`/cards/from-map/${slug}`);
export const dueCards = () => call<Card[]>("/cards/due");
export const reviewCard = (id: number, grade: number) =>
  post<{ interval_days: number; due: number }>(`/cards/${id}/review`, { grade });
