import { BACKEND_URL } from "./api";

export interface ChatSummary {
  id: number;
  title: string;
  updated_at: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  meta?: { context?: { doc: string; id: string; label: string; title: string } } | null;
}

export interface ChatContext {
  doc: string;
  id: string;
}

export type ChatEvent =
  | { type: "meta"; chat_id: number }
  | { type: "delta"; text: string }
  | { type: "done"; stop_reason: string; usage: Record<string, number> }
  | { type: "error"; message: string };

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, init);
  if (!res.ok) throw new Error(`Backend error ${res.status}`);
  return res.json();
}

export const listChats = () => json<ChatSummary[]>("/chats");
export const getChat = (id: number) => json<{ id: number; title: string; messages: ChatMessage[] }>(`/chats/${id}`);
export const deleteChat = (id: number) => json(`/chats/${id}`, { method: "DELETE" });

/** POST /chat and call onEvent for each server-sent event as it arrives. */
export const streamChat = (
  body: { message: string; chat_id: number | null; context: ChatContext | null },
  onEvent: (e: ChatEvent) => void,
) => streamSSE("/chat", body, onEvent);

/** POST to an SSE endpoint and call onEvent for each event as it arrives. */
export async function streamSSE(path: string, body: unknown, onEvent: (e: ChatEvent) => void): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    onEvent({ type: "error", message: `Can't reach the backend at ${BACKEND_URL}. Is it running?` });
    return;
  }
  if (!res.ok || !res.body) {
    onEvent({ type: "error", message: `Backend error ${res.status}` });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      if (chunk.startsWith("data: ")) onEvent(JSON.parse(chunk.slice(6)));
    }
  }
}
