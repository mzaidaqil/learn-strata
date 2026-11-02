import { notFound } from "next/navigation";
import TutorApp from "@/components/TutorApp";
import { AI_ENABLED } from "@/lib/features";
import { getRecord } from "@/lib/law";

export default async function TutorPage(props: PageProps<"/tutor">) {
  if (!AI_ENABLED) notFound();
  const { chat, doc, id, q } = await props.searchParams;
  const chatId = typeof chat === "string" && /^\d+$/.test(chat) ? Number(chat) : null;

  let context = null;
  if (typeof doc === "string" && typeof id === "string") {
    const rec = await getRecord(doc, id);
    if (rec) context = { doc: rec.doc, id: rec.id, label: rec.label, title: rec.title };
  }

  // key forces a fresh client state when arriving from a different section or chat link
  return (
    <TutorApp
      key={`${chatId}-${doc}-${id}-${q}`}
      initialChatId={chatId}
      context={context}
      initialInput={typeof q === "string" ? q : ""}
    />
  );
}
