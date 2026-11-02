import Link from "next/link";
import { citationHref } from "@/lib/cite";

export default function CiteChip({ cite }: { cite: string }) {
  const href = citationHref(cite);
  const cls =
    "inline-block rounded bg-teal-50 px-1.5 py-px text-xs font-medium whitespace-nowrap text-teal-800 dark:bg-teal-950 dark:text-teal-200";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-teal-100 dark:hover:bg-teal-900`}>
      {cite}
    </Link>
  ) : (
    <span className={cls}>{cite}</span>
  );
}
