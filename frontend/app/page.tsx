import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import Dashboard from "@/components/Dashboard";
import { getProgress } from "@/lib/api";
import { AI_ENABLED } from "@/lib/features";
import { getToc } from "@/lib/law";

export default async function Home() {
  const [toc, progress] = await Promise.all([getToc(), AI_ENABLED ? getProgress() : null]);
  const counts = toc.map((t) => {
    const items = t.groups.flatMap((g) => g.chapters.flatMap((c) => c.items));
    return {
      ...t,
      sections: items.filter((i) => i.kind === "section").length,
      parts: t.groups.filter((g) => g.part.startsWith("Part")).length,
      extras: items.filter((i) => i.kind !== "section").length,
    };
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Learn the Strata Management law</h1>
      <p className="mt-3 max-w-2xl text-stone-600 dark:text-stone-400">
        Read the Strata Management Act 2013 (Act 757) and the Maintenance and Management Regulations 2015 section by
        section, and follow the main processes step by step. Cross-references are clickable, and every section links
        to its page in the original PDF.
      </p>

      <div className="mt-8">
        <SearchBox large />
      </div>

      {AI_ENABLED && (
        <Link
          href="/tutor"
          className="mt-6 flex items-center justify-between rounded-xl bg-teal-700 p-5 text-white hover:bg-teal-800"
        >
          <div>
            <div className="font-semibold">Ask the Tutor</div>
            <div className="mt-1 text-sm text-teal-100">
              Ask any question about the Act or Regulations and get a plain-English answer with citations.
            </div>
          </div>
          <span className="text-xl">→</span>
        </Link>
      )}

      <Link
        href="/maps"
        className="mt-4 flex items-center justify-between rounded-xl border border-teal-700 p-5 hover:bg-teal-50 dark:hover:bg-teal-950"
      >
        <div>
          <div className="font-semibold">Process maps</div>
          <div className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            9 step-by-step flows (JMB to MC handover, unpaid charges, leaks, Tribunal claims and more), with a
            test-yourself mode.
          </div>
        </div>
        <span className="text-xl text-teal-700">→</span>
      </Link>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {counts.map((t) => (
          <Link
            key={t.doc}
            href={`/read/${t.doc}/1`}
            className="group rounded-xl border border-stone-200 bg-white p-5 transition hover:border-teal-600 dark:border-stone-800 dark:bg-stone-900"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
              {t.doc === "act" ? "The Act" : "The Regulations"}
            </div>
            <div className="mt-1 font-semibold">{t.name}</div>
            <div className="mt-3 text-sm text-stone-500 dark:text-stone-400">
              {t.parts} Parts · {t.sections} {t.doc === "act" ? "sections" : "regulations"} · {t.extras}{" "}
              {t.doc === "act" ? "schedules" : "schedules, forms & by-laws"}
            </div>
            <div className="mt-4 text-sm font-medium text-teal-700 group-hover:underline dark:text-teal-400">
              Start reading →
            </div>
          </Link>
        ))}
      </div>

      {progress && <Dashboard progress={progress} />}
    </main>
  );
}
