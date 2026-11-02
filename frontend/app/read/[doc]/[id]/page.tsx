import Link from "next/link";
import { notFound } from "next/navigation";
import CardsButton from "@/components/CardsButton";
import ExplainPanel from "@/components/ExplainPanel";
import LawText from "@/components/LawText";
import MobileToc from "@/components/MobileToc";
import TocSidebar from "@/components/TocSidebar";
import { getExplained, getExplanation, getProvisionCardCount, heading } from "@/lib/api";
import { AI_ENABLED } from "@/lib/features";
import { allRecordParams, getRecord, getToc, pdfUrl } from "@/lib/law";

// All 293 provisions are known at build time, so every Reader page is pre-rendered.
export const dynamicParams = false;
export const generateStaticParams = async () => allRecordParams();

export default async function ReadPage(props: PageProps<"/read/[doc]/[id]">) {
  const { doc, id } = await props.params;
  if (doc !== "act" && doc !== "reg") notFound();
  const rid = decodeURIComponent(id);
  const [rec, toc, explanation, explained, cardCount] = await Promise.all([
    getRecord(doc, rid),
    getToc(),
    AI_ENABLED ? getExplanation(doc, rid) : null,
    AI_ENABLED ? getExplained() : [],
    AI_ENABLED ? getProvisionCardCount(doc, rid) : 0,
  ]);
  if (!rec) notFound();

  const num = heading(rec.doc, rec.kind, rec.id);
  const crumbs = [
    rec.part && `${rec.part}${rec.part_title ? ` · ${rec.part_title}` : ""}`,
    rec.chapter && `${rec.chapter}${rec.chapter_title ? ` · ${rec.chapter_title}` : ""}`,
  ].filter(Boolean);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4">
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-80 shrink-0 py-6 lg:block">
        <TocSidebar toc={toc} doc={rec.doc} current={rec.id} explained={explained} />
      </aside>

      <main className="min-w-0 flex-1 py-6 lg:py-8">
        <MobileToc toc={toc} doc={rec.doc} current={rec.id} explained={explained} />
        <article className="max-w-3xl">
          <div className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
            {rec.doc_name}
          </div>
          {crumbs.map((c) => (
            <div key={c} className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {c}
            </div>
          ))}
          <h1 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
            {num && <span className="text-teal-700 dark:text-teal-400">{num} · </span>}
            {rec.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
            {AI_ENABLED && (
              <Link
                href={`/tutor?doc=${rec.doc}&id=${rec.id}`}
                className="rounded-lg bg-teal-700 px-3 py-1.5 font-medium text-white hover:bg-teal-800"
              >
                Ask the tutor about this
              </Link>
            )}
            <a
              href={pdfUrl(rec.doc, rec.pages[0])}
              target="_blank"
              rel="noreferrer"
              className="text-stone-500 underline decoration-stone-300 underline-offset-2 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
            >
              View in original PDF (p. {rec.pages[0]}
              {rec.pages[1] !== rec.pages[0] ? `–${rec.pages[1]}` : ""})
            </a>
          </div>

          {AI_ENABLED && (
            <div className="mt-6 space-y-3">
              <ExplainPanel key={`${rec.doc}-${rec.id}`} doc={rec.doc} id={rec.id} initial={explanation} />
              <CardsButton key={`c-${rec.doc}-${rec.id}`} doc={rec.doc} id={rec.id} initialCount={cardCount} />
            </div>
          )}

          <div className="mt-6 sm:mt-8">
            <LawText text={rec.text} doc={rec.doc} />
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4 border-t border-stone-200 pt-6 text-sm dark:border-stone-800">
            <div>
              {rec.prev && (
                <Link href={`/read/${rec.doc}/${rec.prev.id}`} className="group block">
                  <div className="text-stone-500">← Previous</div>
                  <div className="font-medium group-hover:text-teal-700 dark:group-hover:text-teal-400">
                    {rec.prev.title}
                  </div>
                </Link>
              )}
            </div>
            <div className="text-right">
              {rec.next && (
                <Link href={`/read/${rec.doc}/${rec.next.id}`} className="group block">
                  <div className="text-stone-500">Next →</div>
                  <div className="font-medium group-hover:text-teal-700 dark:group-hover:text-teal-400">
                    {rec.next.title}
                  </div>
                </Link>
              )}
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
