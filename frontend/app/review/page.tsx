import { notFound } from "next/navigation";
import ReviewSession from "@/components/ReviewSession";
import { AI_ENABLED } from "@/lib/features";

export default function ReviewPage() {
  if (!AI_ENABLED) notFound();
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">
        Answer in your head first, then check. Be honest with the grade: <b>Again</b> brings the card back in this
        session, and <b>Good</b> or <b>Easy</b> push it further into the future.
      </p>
      <ReviewSession />
    </main>
  );
}
