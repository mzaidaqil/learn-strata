import Link from "next/link";
import PartCardsButton from "@/components/PartCardsButton";
import type { Progress } from "@/lib/api";

function Bar({ value, total, cls }: { value: number; total: number; cls: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
      <div className={`h-full ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Dashboard({ progress }: { progress: Progress }) {
  const { stats, parts } = progress;
  const docs = [
    { doc: "act", name: "Act 757" },
    { doc: "reg", name: "Regulations 2015" },
  ] as const;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Your progress</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Due now", stats.due],
          ["Reviewed today", stats.reviewed_today],
          ["Flashcards", stats.total],
          ["Mastered", stats.mastered],
        ].map(([label, n]) => (
          <div key={label} className="rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
            <div className="text-2xl font-semibold">{n}</div>
            <div className="text-sm text-stone-500">{label}</div>
          </div>
        ))}
      </div>
      {stats.due > 0 && (
        <Link
          href="/review"
          className="mt-3 block rounded-lg bg-teal-700 py-2.5 text-center font-medium text-white hover:bg-teal-800"
        >
          Review {stats.due} due card{stats.due === 1 ? "" : "s"}
        </Link>
      )}

      <div className="mt-4 flex gap-4 text-xs text-stone-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> explained
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-teal-600" /> has flashcards
        </span>
        <span>Mastered = next review is 3+ weeks away</span>
      </div>

      {docs.map(({ doc, name }) => (
        <div key={doc} className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{name}</h3>
          <div className="mt-2 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
            {parts
              .filter((p) => p.doc === doc && p.part.startsWith("Part"))
              .map((p) => (
                <div key={p.part} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 p-3 sm:grid-cols-[1fr_10rem_auto]">
                  <Link href={`/read/${p.doc}/${p.first_id}`} className="min-w-0 text-sm hover:text-teal-700">
                    <span className="font-medium">{p.part}</span>
                    <span className="ml-2 text-stone-500">{p.part_title}</span>
                  </Link>
                  <div className="col-span-2 row-start-2 space-y-1 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                    <Bar value={p.explained} total={p.provisions} cls="bg-sky-500" />
                    <Bar value={p.with_cards} total={p.provisions} cls="bg-teal-600" />
                  </div>
                  <div className="text-right text-xs text-stone-500">
                    {p.cards ? `${p.mastered}/${p.cards} mastered` : ""}
                    {p.missing.length > 0 && (
                      <div>
                        <PartCardsButton doc={p.doc} ids={p.missing} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}
