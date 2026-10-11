import { readSSE } from "./sse";
import type { Source } from "./types";

export type ChatCallbacks = {
  onMeta?: (m: { conversation_id: string }) => void;
  onSources?: (s: Source[]) => void;
  onToken: (t: string) => void;
  onDone?: (d: DonePayload) => void;
  onError?: (message: string) => void;
};

export type DonePayload = {
  message_id?: string;
  cached?: boolean;
  usage?: { input_tokens: number; output_tokens: number; cached_input_tokens: number; model: string };
};

/** Consumes a chat SSE response (meta → sources → token… → done) from the API. */
export async function consumeChatStream(res: Response, cb: ChatCallbacks, signal?: AbortSignal): Promise<void> {
  if (!res.ok || !res.body) {
    let message = "The assistant is unavailable right now.";
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* keep default */
    }
    cb.onError?.(message);
    return;
  }
  await readSSE(
    res.body,
    (ev) => {
      const d = ev.data as Record<string, unknown>;
      switch (ev.event) {
        case "meta":
          cb.onMeta?.(d as { conversation_id: string });
          break;
        case "sources":
          cb.onSources?.(ev.data as Source[]);
          break;
        case "token":
          if (typeof d?.t === "string") cb.onToken(d.t);
          break;
        case "done":
          cb.onDone?.(d as DonePayload);
          break;
        case "error":
          cb.onError?.(typeof d?.message === "string" ? d.message : "The assistant is unavailable right now.");
          break;
      }
    },
    signal,
  );
}

export function newVisitorId(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return "v_" + btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** localStorage that degrades to memory when storage is blocked (some privacy modes). */
export function safeStorage() {
  const mem = new Map<string, string>();
  return {
    get(k: string): string | null {
      try {
        return window.localStorage.getItem(k);
      } catch {
        return mem.get(k) ?? null;
      }
    },
    set(k: string, v: string) {
      try {
        window.localStorage.setItem(k, v);
      } catch {
        mem.set(k, v);
      }
    },
    remove(k: string) {
      try {
        window.localStorage.removeItem(k);
      } catch {
        mem.delete(k);
      }
    },
  };
}
