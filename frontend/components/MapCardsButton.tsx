"use client";

import { useState } from "react";
import { cardsFromMap } from "@/lib/cards";

export default function MapCardsButton({ slug }: { slug: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const add = async () => {
    try {
      const r = await cardsFromMap(slug);
      setMsg(r.added ? `Added ${r.added} cards to Review` : "Already in your flashcards");
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return msg ? (
    <span className="text-sm text-teal-700 dark:text-teal-400">{msg}</span>
  ) : (
    <button
      onClick={add}
      className="rounded-full border border-stone-300 px-3 py-1 text-sm hover:border-teal-600 dark:border-stone-700"
    >
      Add these to my flashcards
    </button>
  );
}
