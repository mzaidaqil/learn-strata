import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { citationHref } from "@/lib/cite";

/** Turn [Act s.21] style citations into markdown links (skipping ones that already are links). */
function linkCitations(md: string): string {
  return md.replace(/\[((?:Act|Reg|By-law|Form) [^\]]{1,40})\](?!\()/g, (whole, cite: string) => {
    const href = citationHref(cite);
    return href ? `[${cite}](${href})` : whole;
  });
}

export default function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = "", children }) =>
            href.startsWith("/read/") ? (
              <Link
                href={href}
                className="mx-0.5 inline-block rounded bg-teal-50 px-1.5 py-px text-[0.8em] font-medium whitespace-nowrap text-teal-800 no-underline hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-200 dark:hover:bg-teal-900"
              >
                {children}
              </Link>
            ) : (
              <a href={href} target="_blank" rel="noreferrer" className="underline">
                {children}
              </a>
            ),
        }}
      >
        {linkCitations(text)}
      </ReactMarkdown>
    </div>
  );
}
