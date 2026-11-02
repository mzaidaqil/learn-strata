"use client";

import Link from "next/link";
import { useState } from "react";
import { generateCards } from "@/lib/cards";

/** "Make flashcards" for one provision on the Reader page. */
export default function CardsButton({ doc, id, initialCount }: { doc: string; id: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      setCount((await generateCards(doc, id)).length);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {count > 0 ? (
        <Link
          href="/review"
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:border-teal-600 dark:border-stone-700"
        >
          {count} flashcard{count === 1 ? "" : "s"} · Review
        </Link>
      ) : (
        <button
          onClick={make}
          disabled={busy}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:border-teal-600 disabled:opacity-60 dark:border-stone-700"
        >
          {busy ? "Writing flashcards…" : "Make flashcards"}
        </button>
      )}
      {error && <span className="text-sm text-amber-700 dark:text-amber-300">{error}</span>}
    </span>
  );
}
