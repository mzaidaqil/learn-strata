"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "@/components/Markdown";
import {
  type ChatContext,
  type ChatMessage,
  type ChatSummary,
  deleteChat,
  getChat,
  listChats,
  streamChat,
} from "@/lib/chat";

const STARTERS = [
  "Who must convene the first JMB AGM, and by when?",
  "What's the difference between a JMB and a management corporation?",
  "What happens if a parcel owner doesn't pay maintenance charges?",
  "Water is leaking from the unit above into my ceiling. What's the process?",
  "Maintenance account vs sinking fund: what is each one for?",
  "What claims can I bring to the Strata Management Tribunal?",
];

const QUIZ_PROMPT =
  "Quiz me on what you just explained. Ask me 3 questions, one at a time: wait for my answer, tell me if I'm right with the citation, then ask the next one.";

interface Props {
  initialChatId: number | null;
  context: (ChatContext & { label: string; title: string }) | null;
  initialInput?: string;
}

export default function TutorApp({ initialChatId, context: initialContext, initialInput = "" }: Props) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatId, setChatId] = useState<number | null>(initialChatId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [context, setContext] = useState(initialContext);
  const [input, setInput] = useState(initialInput);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refreshChats = useCallback(() => {
    listChats().then(setChats).catch(() => setError("Can't reach the backend. Is it running on port 8000?"));
  }, []);

  useEffect(refreshChats, [refreshChats]);

  useEffect(() => {
    if (initialChatId != null) getChat(initialChatId).then((c) => setMessages(c.messages)).catch(() => {});
  }, [initialChatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const openChat = async (id: number) => {
    if (busy) return;
    const c = await getChat(id);
    setChatId(id);
    setMessages(c.messages);
    setContext(null);
    setError(null);
    window.history.replaceState(null, "", `/tutor?chat=${id}`);
  };

  const newChat = () => {
    if (busy) return;
    setChatId(null);
    setMessages([]);
    setError(null);
    window.history.replaceState(null, "", "/tutor");
    inputRef.current?.focus();
  };

  const removeChat = async (id: number) => {
    if (!confirm("Delete this chat?")) return;
    await deleteChat(id);
    if (id === chatId) newChat();
    refreshChats();
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    const ctx = context ? { doc: context.doc, id: context.id } : null;
    const meta = context ? { context: { ...context } } : null;
    setMessages((m) => [...m, { role: "user", content: message, meta }, { role: "assistant", content: "" }]);

    const appendToLast = (t: string) =>
      setMessages((m) => {
        const copy = m.slice();
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = { ...last, content: last.content + t };
        return copy;
      });

    await streamChat({ message, chat_id: chatId, context: ctx }, (e) => {
      if (e.type === "meta" && chatId == null) {
        setChatId(e.chat_id);
        window.history.replaceState(null, "", `/tutor?chat=${e.chat_id}`);
      } else if (e.type === "delta") appendToLast(e.text);
      else if (e.type === "error") setError(e.message);
    });
    setContext(null);
    setBusy(false);
    refreshChats();
    inputRef.current?.focus();
  };

  const lastIsAnswer = messages.length > 0 && messages[messages.length - 1].role === "assistant";

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-7xl gap-6 px-4">
      <aside className="hidden w-64 shrink-0 flex-col py-6 md:flex">
        <button
          onClick={newChat}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium hover:border-teal-600 dark:border-stone-700"
        >
          + New chat
        </button>
        <div className="mt-4 flex-1 space-y-0.5 overflow-y-auto text-sm">
          {chats.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center rounded ${
                c.id === chatId ? "bg-stone-200/70 dark:bg-stone-800" : "hover:bg-stone-100 dark:hover:bg-stone-900"
              }`}
            >
              <button onClick={() => openChat(c.id)} className="min-w-0 flex-1 truncate px-2 py-1.5 text-left">
                {c.title}
              </button>
              <button
                onClick={() => removeChat(c.id)}
                className="px-2 text-stone-400 opacity-0 group-hover:opacity-100 hover:text-red-600"
                aria-label="Delete chat"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.length === 0 && (
              <div className="pt-8">
                <h1 className="text-2xl font-semibold tracking-tight">Ask the Tutor</h1>
                <p className="mt-2 text-stone-600 dark:text-stone-400">
                  Ask anything about the Strata Management Act 2013 or the 2015 Regulations. Answers come only from
                  those two documents, and every point is cited. Click a citation to read the section.
                </p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-lg border border-stone-200 bg-white p-3 text-left text-sm hover:border-teal-600 dark:border-stone-800 dark:bg-stone-900"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-teal-700 px-4 py-2.5 text-white">
                    {m.meta?.context && (
                      <div className="mb-1 text-xs text-teal-100">
                        About {m.meta.context.label}: {m.meta.context.title}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              ) : (
                <div key={i}>
                  {m.content ? (
                    <Markdown text={m.content} />
                  ) : (
                    <div className="animate-pulse text-sm text-stone-500">Reading the Act and Regulations…</div>
                  )}
                </div>
              ),
            )}

            {lastIsAnswer && !busy && (
              <div className="flex gap-2">
                <button
                  onClick={() => send(QUIZ_PROMPT)}
                  className="rounded-full border border-stone-300 px-3 py-1 text-sm hover:border-teal-600 dark:border-stone-700"
                >
                  Quiz me on this
                </button>
                <button
                  onClick={() => send("Explain that again more simply, with a short real-life example.")}
                  className="rounded-full border border-stone-300 px-3 py-1 text-sm hover:border-teal-600 dark:border-stone-700"
                >
                  Explain more simply
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="pb-6">
          <div className="mx-auto max-w-3xl">
            {context && (
              <div className="mb-2 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                <span>
                  Asking about{" "}
                  <Link href={`/read/${context.doc}/${context.id}`} className="font-medium text-teal-700 dark:text-teal-400">
                    {context.label}: {context.title}
                  </Link>
                </span>
                <button onClick={() => setContext(null)} className="text-stone-400 hover:text-stone-700" aria-label="Remove">
                  ×
                </button>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2 rounded-xl border border-stone-300 bg-white p-2 focus-within:border-teal-600 dark:border-stone-700 dark:bg-stone-900"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={2}
                autoFocus
                placeholder={context ? `Ask about ${context.label}…` : "Ask a question about the Act or Regulations…"}
                className="flex-1 resize-none bg-transparent px-2 py-1 outline-none"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {busy ? "…" : "Ask"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
