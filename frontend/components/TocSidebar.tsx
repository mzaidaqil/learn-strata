"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Doc, TocDoc, TocItem } from "@/lib/api";

function itemLabel(doc: Doc, item: TocItem): string {
  if (item.kind === "section") return doc === "act" ? `s.${item.id}` : `r.${item.id}`;
  if (item.kind === "bylaw") return `BL ${item.id.split("-")[1]}`;
  return "";
}

interface Props {
  toc: TocDoc[];
  doc: Doc;
  current: string;
  /** "act/21"-style keys of provisions that already have an explanation */
  explained: string[];
}

export default function TocSidebar({ toc, doc, current, explained }: Props) {
  const done = new Set(explained);
  const active = toc.find((t) => t.doc === doc) ?? toc[0];
  const currentPart = active?.groups.find((g) => g.chapters.some((c) => c.items.some((i) => i.id === current)))?.part;
  // Parts the user has opened/closed by hand; otherwise only the current Part is open.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isOpenPart = (part: string) => overrides[part] ?? part === currentPart;
  const currentRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const toggle = (part: string) => setOverrides((o) => ({ ...o, [part]: !isOpenPart(part) }));

  return (
    <nav className="flex h-full flex-col text-sm">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-stone-200/60 p-1 dark:bg-stone-800">
        {toc.map((t) => (
          <Link
            key={t.doc}
            href={`/read/${t.doc}/1`}
            className={`rounded-md px-2 py-1.5 text-center font-medium ${
              t.doc === doc
                ? "bg-white shadow-sm dark:bg-stone-700"
                : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            }`}
          >
            {t.doc === "act" ? "Act 757" : "Regulations 2015"}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex-1 overflow-y-auto pr-1">
        {active?.groups.map((g) => {
          const isOpen = isOpenPart(g.part);
          return (
            <div key={g.part} className="border-b border-stone-200 py-1 dark:border-stone-800">
              <button
                onClick={() => toggle(g.part)}
                className="flex w-full items-start gap-2 rounded px-1 py-1.5 text-left hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <span className="mt-0.5 w-3 shrink-0 text-stone-400">{isOpen ? "▾" : "▸"}</span>
                <span>
                  <span className="font-semibold">{g.part}</span>
                  {g.part_title && <span className="block text-stone-500 dark:text-stone-400">{g.part_title}</span>}
                </span>
              </button>
              {isOpen &&
                g.chapters.map((c) => (
                  <div key={c.chapter || "none"} className="mb-1 ml-5">
                    {c.chapter && (
                      <div className="mt-2 mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                        {c.chapter}
                        {c.chapter_title && ` · ${c.chapter_title}`}
                      </div>
                    )}
                    {c.items.map((it) => {
                      const isCurrent = it.id === current;
                      const lbl = itemLabel(active.doc, it);
                      return (
                        <Link
                          key={it.id}
                          ref={isCurrent ? currentRef : undefined}
                          href={`/read/${active.doc}/${it.id}`}
                          className={`flex gap-2 rounded px-2 py-1 leading-snug ${
                            isCurrent
                              ? "bg-teal-50 font-medium text-teal-900 dark:bg-teal-950 dark:text-teal-100"
                              : "text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                          }`}
                        >
                          {lbl && <span className="w-12 shrink-0 tabular-nums text-stone-400">{lbl}</span>}
                          <span className="flex-1">{it.title}</span>
                          {done.has(`${active.doc}/${it.id}`) && (
                            <span title="Explained" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
