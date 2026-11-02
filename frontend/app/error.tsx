"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-3 rounded-lg bg-amber-50 p-4 font-mono text-sm break-words text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        {error.message}
      </p>
      <button onClick={reset} className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white">
        Try again
      </button>
    </main>
  );
}
