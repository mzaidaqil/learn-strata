import Link from "next/link";
import { AI_ENABLED } from "@/lib/features";
import SearchBox from "./SearchBox";

const LINKS = [
  { href: "/read/act/1", label: "Read" },
  { href: "/maps", label: "Maps" },
  ...(AI_ENABLED
    ? [
        { href: "/tutor", label: "Tutor" },
        { href: "/review", label: "Review" },
      ]
    : []),
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-background/90 backdrop-blur dark:border-stone-800">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:gap-6">
        <Link href="/" className="shrink-0 font-semibold tracking-tight whitespace-nowrap">
          Learn <span className="text-teal-700 dark:text-teal-400">Strata</span>
        </Link>
        <nav className="flex gap-4 text-sm text-stone-600 dark:text-stone-400">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-stone-900 dark:hover:text-stone-100">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden w-full max-w-xs sm:block">
          <SearchBox />
        </div>
        <Link
          href="/search"
          aria-label="Search"
          className="ml-auto rounded-lg p-2 text-stone-600 hover:bg-stone-100 sm:hidden dark:text-stone-400 dark:hover:bg-stone-800"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
