import { Fragment, type ReactNode } from "react";

/**
 * Tiny, safe Markdown renderer for assistant messages. It builds React elements directly
 * (no innerHTML), so model output can never inject markup. Supported: paragraphs, line
 * breaks, bullet/numbered lists, **bold**, *italic*, `code`, [links](https://…) and bare
 * https URLs. Only http(s) and mailto links are rendered as links.
 */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]|\*[^*\s][^*]*\*)/g;

export function safeHref(href: string): string | null {
  try {
    const u = new URL(href);
    return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    const tok = m[0];
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}-${n++}`;
    if (tok.startsWith("**")) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={key} className="rounded bg-black/5 px-1 py-0.5 text-[0.9em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const label = tok.slice(1, tok.indexOf("]"));
      const href = safeHref(tok.slice(tok.indexOf("(") + 1, -1));
      out.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
            {label}
          </a>
        ) : (
          label
        ),
      );
    } else if (tok.startsWith("http")) {
      const href = safeHref(tok);
      out.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 break-all">
            {tok}
          </a>
        ) : (
          tok
        ),
      );
    } else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = start + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (!lines.length) return null;
        const bullet = lines.every((l) => /^\s*[-*•]\s+/.test(l));
        const numbered = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
        if (bullet || numbered) {
          const items = lines.map((l, li) => <li key={li}>{renderInline(l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ""), `${bi}-${li}`)}</li>);
          return numbered ? (
            <ol key={bi} className="my-1 list-decimal space-y-0.5 pl-5">
              {items}
            </ol>
          ) : (
            <ul key={bi} className="my-1 list-disc space-y-0.5 pl-5">
              {items}
            </ul>
          );
        }
        const heading = lines.length === 1 && /^#{1,6}\s+/.test(lines[0]);
        if (heading) return <p key={bi} className="my-1 font-semibold">{renderInline(lines[0].replace(/^#{1,6}\s+/, ""), `${bi}`)}</p>;
        return (
          <p key={bi} className="my-1 first:mt-0 last:mb-0">
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(l, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
