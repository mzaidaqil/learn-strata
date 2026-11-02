"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CiteChip from "@/components/CiteChip";
import { type Card, dueCards, reviewCard } from "@/lib/cards";

const GRADES = [
  { grade: 1, label: "Again", hint: "10 min", cls: "bg-red-600 hover:bg-red-700" },
  { grade: 3, label: "Hard", hint: "shorter", cls: "bg-amber-600 hover:bg-amber-700" },
  { grade: 4, label: "Good", hint: "", cls: "bg-teal-700 hover:bg-teal-800" },
  { grade: 5, label: "Easy", hint: "longer", cls: "bg-sky-700 hover:bg-sky-800" },
];

export default function ReviewSession() {
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [shown, setShown] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dueCards().then(setQueue).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="mt-8 text-amber-700">{error}</p>;
  if (!queue) return <p className="mt-8 text-stone-500">Loading…</p>;

  const card = queue[0];
  if (!card) {
    return (
      <div className="mt-10 rounded-xl border border-stone-200 bg-white p-8 text-center dark:border-stone-800 dark:bg-stone-900">
        <div className="text-2xl font-semibold">{done ? "All done for now 🎉" : "No cards due"}</div>
        <p className="mt-2 text-stone-600 dark:text-stone-400">
          {done ? `You reviewed ${done} card${done === 1 ? "" : "s"}. ` : ""}
          Make more cards with <b>Make flashcards</b> on any section, or <b>Add these to my flashcards</b> on a process
          map.
        </p>
        <div className="mt-4 flex justify-center gap-3 text-sm">
          <Link href="/maps" className="rounded-lg border border-stone-300 px-3 py-1.5 dark:border-stone-700">
            Process maps
          </Link>
          <Link href="/" className="rounded-lg border border-stone-300 px-3 py-1.5 dark:border-stone-700">
            Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const grade = async (g: number) => {
    await reviewCard(card.id, g).catch((e) => setError(e.message));
    setDone((d) => d + 1);
    setShown(false);
    setPicked(null);
    // "Again" cards come back at the end of this session.
    setQueue((q) => (q ? [...q.slice(1), ...(g < 3 ? [card] : [])] : q));
  };

  const isMcq = card.kind === "mcq" && card.options;
  const correct = picked != null && picked === card.answer;

  return (
    <div className="mt-6">
      <div className="mb-3 flex justify-between text-sm text-stone-500">
        <span>{queue.length} left</span>
        <span>{done} reviewed</span>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
          {card.source.startsWith("map:") ? "Process map" : "Flashcard"}
          {isMcq ? " · Multiple choice" : ""}
        </div>
        <div className="mt-2 text-lg font-medium">{card.front}</div>

        {isMcq && (
          <div className="mt-4 grid gap-2">
            {card.options!.map((o, i) => {
              const state =
                picked == null ? "" : i === card.answer ? "border-teal-600 bg-teal-50 dark:bg-teal-950" : i === picked ? "border-red-500 bg-red-50 dark:bg-red-950" : "opacity-60";
              return (
                <button
                  key={i}
                  disabled={picked != null}
                  onClick={() => {
                    setPicked(i);
                    setShown(true);
                  }}
                  className={`rounded-lg border border-stone-300 p-3 text-left dark:border-stone-700 ${state}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        )}

        {shown ? (
          <div className="mt-5 border-t border-stone-200 pt-4 dark:border-stone-800">
            {isMcq && (
              <div className={`mb-1 font-semibold ${correct ? "text-teal-700" : "text-red-600"}`}>
                {correct ? "Correct" : "Not quite"}
              </div>
            )}
            <div className="text-stone-800 dark:text-stone-200">{card.back}</div>
            {card.cite && (
              <div className="mt-3">
                <CiteChip cite={card.cite} />
              </div>
            )}
          </div>
        ) : (
          !isMcq && (
            <button
              onClick={() => setShown(true)}
              className="mt-6 w-full rounded-lg bg-stone-800 py-2.5 font-medium text-white hover:bg-stone-900 dark:bg-stone-200 dark:text-stone-900"
            >
              Show answer
            </button>
          )
        )}
      </div>

      {shown && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {GRADES.map((g) => (
            <button
              key={g.grade}
              onClick={() => grade(isMcq && !correct && g.grade > 1 ? Math.min(g.grade, 3) : g.grade)}
              className={`rounded-lg py-2.5 text-sm font-medium text-white ${g.cls}`}
            >
              {g.label}
              {g.hint && <span className="block text-xs opacity-80">{g.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
