import Link from "next/link";
import { notFound } from "next/navigation";
import CiteChip from "@/components/CiteChip";
import MapCardsButton from "@/components/MapCardsButton";
import MapSteps from "@/components/MapSteps";
import { AI_ENABLED } from "@/lib/features";
import { allMapParams, getMap } from "@/lib/law";

export const dynamicParams = false;
export const generateStaticParams = async () => allMapParams();

export default async function MapPage(props: PageProps<"/maps/[slug]">) {
  const { slug } = await props.params;
  const map = await getMap(slug);
  if (!map) notFound();

  const quiz = `Quiz me on the process "${map.title}". Ask me 5 questions one at a time (order of steps, who acts, deadlines, penalties), wait for each answer, then tell me if I'm right with the citation.`;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <Link href="/maps" className="text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
        ← All process maps
      </Link>
      <h1 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{map.title}</h1>
      <p className="mt-3 text-stone-600 dark:text-stone-400">{map.summary}</p>
      {AI_ENABLED && (
        <div className="mt-4">
          <Link
            href={`/tutor?q=${encodeURIComponent(quiz)}`}
            className="inline-block rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
          >
            Quiz me with the tutor
          </Link>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Numbers to remember</h2>
        {AI_ENABLED && <MapCardsButton slug={map.slug} />}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {map.key_numbers.map((k) => (
          <div key={k.label} className="rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
            <div className="text-lg font-semibold text-teal-800 dark:text-teal-300">{k.value}</div>
            <div className="mt-0.5 text-sm text-stone-600 dark:text-stone-400">{k.label}</div>
            <div className="mt-2">
              <CiteChip cite={k.cite} />
            </div>
          </div>
        ))}
      </div>

      <MapSteps steps={map.steps} />

      <div className="mt-10 rounded-xl bg-teal-700 p-5 text-white">
        <div className="text-xs font-semibold uppercase tracking-wide text-teal-100">Remember it</div>
        <div className="mt-1 text-lg">{map.memory_hook}</div>
      </div>
    </main>
  );
}
