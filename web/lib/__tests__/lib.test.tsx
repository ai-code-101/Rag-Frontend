import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { contrastText } from "@/components/widget/theme";
import { Markdown, safeHref } from "@/lib/markdown";
import { originAllowed } from "@/lib/origin";
import { parseEvent, readSSE } from "@/lib/sse";

describe("markdown", () => {
  it("renders formatting, lists and safe links without raw HTML", () => {
    const html = renderToStaticMarkup(
      <Markdown text={"**Hours**: 9-5\n\n- Mon\n- Tue\n\nSee [docs](https://acme.test/faq) or https://acme.test/x.\n\n<script>alert(1)</script>"} />,
    );
    expect(html).toContain("<strong>Hours</strong>");
    expect(html).toContain("<li>Mon</li>");
    expect(html).toContain('href="https://acme.test/faq"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('href="https://acme.test/x"');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("never renders javascript: or data: links", () => {
    const html = renderToStaticMarkup(<Markdown text={"[click](javascript:alert(1)) [x](data:text/html,hi)"} />);
    expect(html).not.toContain("href");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("mailto:hi@acme.test")).toBe("mailto:hi@acme.test");
  });
});

describe("originAllowed", () => {
  const list = ["https://acme.test", "https://*.shop.test"];
  it.each([
    ["https://acme.test", true],
    ["https://ACME.test:443", true],
    ["http://acme.test", false],
    ["https://a.shop.test", true],
    ["https://shop.test", false],
    ["https://evilshop.test", false],
    ["null", false],
  ])("%s → %s", (origin, want) => expect(originAllowed(list, origin)).toBe(want));
  it("empty list allows all", () => expect(originAllowed([], "https://anything.test")).toBe(true));
});

describe("sse", () => {
  it("parses events, multi-line data and comments", () => {
    expect(parseEvent(": ping")).toBeNull();
    expect(parseEvent('event: token\ndata: {"t":"hi"}')).toEqual({ event: "token", data: { t: "hi" } });
    expect(parseEvent("data: a\ndata: b")).toEqual({ event: "message", data: "a\nb" });
  });

  it("reassembles events split across chunks", async () => {
    const enc = new TextEncoder();
    const parts = ['event: token\ndata: {"t":"He', 'llo"}\n\nevent: done\n', "data: {}\n\n"];
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        parts.forEach((p) => c.enqueue(enc.encode(p)));
        c.close();
      },
    });
    const got: unknown[] = [];
    await readSSE(body, (e) => got.push(e));
    expect(got).toEqual([{ event: "token", data: { t: "Hello" } }, { event: "done", data: {} }]);
  });
});

describe("theme", () => {
  it("picks readable text colours", () => {
    expect(contrastText("#ffffff")).toBe("#111827");
    expect(contrastText("#4f46e5")).toBe("#ffffff");
    expect(contrastText("#fde047")).toBe("#111827");
  });
});
