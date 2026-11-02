import Link from "next/link";
import { listMaps } from "@/lib/law";

export default async function MapsPage() {
  const maps = await listMaps();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Process maps</h1>
      <p className="mt-2 max-w-2xl text-stone-600 dark:text-stone-400">
        The big processes in the Act and Regulations, step by step: who acts, by when, what happens if they
        don&apos;t, and where it says so. Use <em>Test yourself</em> on any map to practise recalling the steps.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {maps.map((m, i) => (
          <Link
            key={m.slug}
            href={`/maps/${m.slug}`}
            className="group rounded-xl border border-stone-200 bg-white p-5 hover:border-teal-600 dark:border-stone-800 dark:bg-stone-900"
          >
            <div className="text-xs font-semibold text-teal-700 dark:text-teal-400">
              Map {i + 1} · {m.steps} steps
            </div>
            <div className="mt-1 font-semibold group-hover:text-teal-800 dark:group-hover:text-teal-300">{m.title}</div>
            <p className="mt-2 line-clamp-3 text-sm text-stone-600 dark:text-stone-400">{m.summary}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
