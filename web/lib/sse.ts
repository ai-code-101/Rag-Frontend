export type SSEEvent = { event: string; data: unknown };

/**
 * Reads a text/event-stream body incrementally and calls onEvent for every complete event.
 * Works with fetch() POST streams (EventSource only supports GET).
 */
export async function readSSE(body: ReadableStream<Uint8Array>, onEvent: (e: SSEEvent) => void, signal?: AbortSignal): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const onAbort = () => reader.cancel().catch(() => {});
  signal?.addEventListener("abort", onAbort);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, "");
        const ev = parseEvent(raw);
        if (ev) onEvent(ev);
      }
    }
    const tail = parseEvent(buffer);
    if (tail) onEvent(tail);
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

export function parseEvent(raw: string): SSEEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  if (!data.length) return null;
  const text = data.join("\n");
  try {
    return { event, data: JSON.parse(text) };
  } catch {
    return { event, data: text };
  }
}
