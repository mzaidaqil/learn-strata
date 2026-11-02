"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { generateCards } from "@/lib/cards";

/** Generate flashcards for every section in a Part that has none yet (3 at a time). */
export default function PartCardsButton({ doc, ids }: { doc: string; ids: string[] }) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; failed: number } | null>(null);

  const run = async () => {
    if (!confirm(`Write flashcards for ${ids.length} sections? This uses about $0.04 of API credit per section.`)) return;
    let done = 0;
    let failed = 0;
    setProgress({ done, failed });
    const queue = [...ids];
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        try {
          await generateCards(doc, id);
        } catch {
          failed++;
        }
        done++;
        setProgress({ done, failed });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    router.refresh();
  };

  if (progress) {
    return (
      <span className="text-xs text-stone-500">
        {progress.done}/{ids.length} sections{progress.failed ? `, ${progress.failed} failed` : ""}
      </span>
    );
  }
  return (
    <button onClick={run} className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-400">
      Make cards ({ids.length})
    </button>
  );
}
