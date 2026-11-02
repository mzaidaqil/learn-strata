"use client";

import { useState } from "react";
import Markdown from "@/components/Markdown";
import { streamSSE } from "@/lib/chat";

export default function ExplainPanel({ doc, id, initial }: { doc: string; id: string; initial: string | null }) {
  const [text, setText] = useState(initial ?? "");
  const [open, setOpen] = useState(initial != null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setOpen(true);
    setError(null);
    setText("");
    await streamSSE(`/explain/${doc}/${encodeURIComponent(id)}`, null, (e) => {
      if (e.type === "delta") setText((t) => t + e.text);
      else if (e.type === "error") setError(e.message);
    });
    setBusy(false);
  };

  if (!open) {
    return (
      <button
        onClick={text ? () => setOpen(true) : generate}
        className="rounded-lg border border-teal-700 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50 dark:border-teal-500 dark:text-teal-300 dark:hover:bg-teal-950"
      >
        {text ? "Show explanation" : "Explain simply"}
      </button>
    );
  }

  return (
    <section className="explain rounded-xl border border-teal-200 bg-teal-50/50 p-5 dark:border-teal-900 dark:bg-teal-950/30">
      <div className="mb-3 flex items-center gap-3 text-sm">
        <span className="font-semibold text-teal-800 dark:text-teal-300">Explained simply</span>
        <span className="text-stone-500">· from the Act &amp; Regulations, by Claude</span>
        <div className="ml-auto flex gap-3">
          {!busy && text && (
            <button onClick={generate} className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
              Regenerate
            </button>
          )}
          {!busy && (
            <button onClick={() => setOpen(false)} className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
              Hide
            </button>
          )}
        </div>
      </div>
      {text ? (
        <Markdown text={text} />
      ) : (
        !error && <div className="animate-pulse text-sm text-stone-500">Reading the provision and its connections…</div>
      )}
      {error && <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">{error}</div>}
    </section>
  );
}
