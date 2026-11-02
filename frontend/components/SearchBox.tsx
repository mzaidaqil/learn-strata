"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBox({ initial = "", large = false }: { initial?: string; large?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the Act & Regulations…"
        className={`w-full rounded-lg border border-stone-300 bg-white outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-stone-700 dark:bg-stone-900 ${
          large ? "px-4 py-3 text-base" : "px-3 py-1.5 text-sm"
        }`}
      />
    </form>
  );
}
