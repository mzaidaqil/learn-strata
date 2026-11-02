"use client";

import { useState } from "react";
import TocSidebar from "@/components/TocSidebar";
import type { Doc, TocDoc } from "@/lib/api";

/** On small screens the table of contents opens as a full-height drawer. */
export default function MobileToc(props: { toc: TocDoc[]; doc: Doc; current: string; explained: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 lg:hidden">
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-1.5 text-sm dark:border-stone-700"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
        Contents
      </button>
      {open && (
        <div className="fixed inset-0 z-30 flex">
          <div
            className="flex h-full w-[85%] max-w-sm flex-col bg-background p-4 shadow-xl"
            // Close the drawer when a section link is tapped.
            onClickCapture={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold">Contents</span>
              <button onClick={() => setOpen(false)} className="px-2 text-2xl leading-none text-stone-500" aria-label="Close">
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <TocSidebar {...props} />
            </div>
          </div>
          <button className="flex-1 bg-black/40" onClick={() => setOpen(false)} aria-label="Close contents" />
        </div>
      )}
    </div>
  );
}
