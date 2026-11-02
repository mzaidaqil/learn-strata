import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import { search } from "@/lib/law";

export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q : "";
  const hits = query ? await search(query) : [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <SearchBox initial={query} large />
      {query && (
        <p className="mt-6 text-sm text-stone-500">
          {hits.length} result{hits.length === 1 ? "" : "s"} for “{query}”
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {hits.map((h) => (
          <li key={`${h.doc}-${h.id}`}>
            <Link
              href={`/read/${h.doc}/${h.id}`}
              className="block rounded-lg border border-stone-200 bg-white p-4 hover:border-teal-600 dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="text-sm">
                <span className="font-semibold text-teal-700 dark:text-teal-400">{h.label}</span>
                <span className="ml-2 font-medium">{h.title}</span>
              </div>
              <div className="mt-1 font-serif text-sm text-stone-600 dark:text-stone-400">{h.snippet}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
