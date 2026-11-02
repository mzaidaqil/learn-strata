"use client";

import { useState } from "react";
import CiteChip from "@/components/CiteChip";
import type { MapStep } from "@/lib/api";

/** The steps as a vertical timeline. "Test yourself" hides everything but the step titles until revealed. */
export default function MapSteps({ steps }: { steps: MapStep[] }) {
  const [testMode, setTestMode] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const toggleMode = () => {
    setTestMode((t) => !t);
    setRevealed(new Set());
  };
  const reveal = (i: number) => setRevealed((r) => new Set(r).add(i));

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">The process</h2>
        <button
          onClick={toggleMode}
          className={`rounded-full border px-3 py-1 text-sm ${
            testMode
              ? "border-teal-700 bg-teal-700 text-white"
              : "border-stone-300 hover:border-teal-600 dark:border-stone-700"
          }`}
        >
          {testMode ? `Test mode: ${revealed.size}/${steps.length} revealed` : "Test yourself"}
        </button>
      </div>
      {testMode && (
        <p className="mt-2 text-sm text-stone-500">
          For each step, say out loud who acts, what they do, the deadline and the penalty. Then tap to check.
        </p>
      )}

      <ol className="relative mt-6 border-l-2 border-teal-200 dark:border-teal-900">
        {steps.map((s, i) => {
          const hidden = testMode && !revealed.has(i);
          return (
            <li key={i} className="relative mb-8 ml-8">
              <span className="absolute -left-[45px] flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="font-semibold">{s.title}</h3>
                <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                  {s.actor}
                </span>
              </div>

              {hidden ? (
                <button
                  onClick={() => reveal(i)}
                  className="mt-2 w-full rounded-lg border border-dashed border-stone-300 p-3 text-left text-sm text-stone-500 hover:border-teal-600 dark:border-stone-700"
                >
                  Recall the details, then tap to reveal
                </button>
              ) : (
                <>
                  <p className="mt-2 text-stone-700 dark:text-stone-300">{s.detail}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    {s.deadline && (
                      <span className="rounded-md bg-sky-50 px-2 py-1 text-sky-900 dark:bg-sky-950 dark:text-sky-200">
                        ⏱ {s.deadline}
                      </span>
                    )}
                    {s.penalty && (
                      <span className="rounded-md bg-red-50 px-2 py-1 text-red-900 dark:bg-red-950 dark:text-red-200">
                        ⚠ {s.penalty}
                      </span>
                    )}
                  </div>
                  {s.branches.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {s.branches.map((b, j) => (
                        <div
                          key={j}
                          className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950/40"
                        >
                          <span className="font-semibold">If</span> {b.if} <span className="font-semibold">→</span> {b.then}
                          {b.cites.length > 0 && (
                            <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                              {b.cites.map((c) => (
                                <CiteChip key={c} cite={c} />
                              ))}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {s.cites.map((c) => (
                      <CiteChip key={c} cite={c} />
                    ))}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
