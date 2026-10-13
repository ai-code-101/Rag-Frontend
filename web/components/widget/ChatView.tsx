"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { DonePayload } from "@/lib/chat-client";
import { Markdown } from "@/lib/markdown";
import type { Content, Features, Source, Theme } from "@/lib/types";
import { themeVars } from "./theme";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  streaming?: boolean;
  error?: boolean;
  meta?: DonePayload;
};

export type SendFn = (
  text: string,
  handlers: {
    onToken: (t: string) => void;
    onSources: (s: Source[]) => void;
    onDone: (d: DonePayload) => void;
    onError: (msg: string) => void;
  },
  signal: AbortSignal,
) => Promise<void>;

type Props = {
  theme: Partial<Theme>;
  content: Partial<Content>;
  features: Partial<Features>;
  initialMessages?: ChatMessage[];
  send: SendFn;
  onClose?: () => void;
  showUsage?: boolean;
  /** Rendered instead of the composer (e.g. the lead form). */
  gate?: ReactNode;
  focusSignal?: number;
  className?: string;
};

const NO_MESSAGES: ChatMessage[] = [];
let counter = 0;
const uid = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

export function ChatView({ theme, content, features, initialMessages = NO_MESSAGES, send, onClose, showUsage, gate, focusSignal, className }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMessages(initialMessages), [initialMessages]);
  useEffect(() => {
    if (focusSignal) inputRef.current?.focus();
  }, [focusSignal]);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = (id: string, f: (m: ChatMessage) => ChatMessage) => setMessages((ms) => ms.map((m) => (m.id === id ? f(m) : m)));

  const submit = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, 2000);
      if (!text || busy) return;
      const botId = uid();
      setMessages((ms) => [...ms, { id: uid(), role: "user", content: text }, { id: botId, role: "assistant", content: "", streaming: true }]);
      setInput("");
      setBusy(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        await send(
          text,
          {
            onToken: (t) => patch(botId, (m) => ({ ...m, content: m.content + t })),
            onSources: (s) => patch(botId, (m) => ({ ...m, sources: s })),
            onDone: (d) => patch(botId, (m) => ({ ...m, meta: d })),
            onError: (msg) =>
              patch(botId, (m) => ({ ...m, error: true, content: m.content || content.offline_message || msg })),
          },
          ctrl.signal,
        );
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          patch(botId, (m) => ({ ...m, error: true, content: m.content || content.offline_message || "We're having trouble connecting." }));
        }
      } finally {
        patch(botId, (m) => ({ ...m, streaming: false }));
        setBusy(false);
        abortRef.current = null;
        inputRef.current?.focus();
      }
    },
    [busy, send, content.offline_message],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(input);
  };

  const showQuickReplies = !messages.some((m) => m.role === "user") && (content.quick_replies?.length ?? 0) > 0;

  return (
    <div style={themeVars(theme)} className={`flex h-full flex-col bg-[var(--hv-bg)] text-[var(--hv-text)] ${className ?? ""}`}>
      <header className="flex items-center gap-3 bg-[var(--hv-primary)] px-4 py-3 text-[var(--hv-on-primary)]">
        {theme.logo_url && /^https?:\/\//.test(theme.logo_url) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.logo_url} alt="" className="h-8 w-8 rounded-full bg-white/20 object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{content.title || "Chat"}</p>
          {content.subtitle && <p className="truncate text-xs opacity-80">{content.subtitle}</p>}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close chat" className="rounded-full p-1.5 hover:bg-black/10">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {content.greeting && <Bubble role="assistant">{<Markdown text={content.greeting} />}</Bubble>}
        {messages.map((m) => (
          <div key={m.id}>
            <Bubble role={m.role} error={m.error}>
              {m.role === "assistant" ? (
                m.content ? (
                  <Markdown text={m.content} />
                ) : m.streaming ? (
                  <span className="hv-typing inline-flex gap-1" aria-label="Assistant is typing">
                    <span>●</span>
                    <span>●</span>
                    <span>●</span>
                  </span>
                ) : null
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </Bubble>
            {m.role === "assistant" && !m.streaming && features.show_sources && m.sources && m.sources.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1 pl-1">
                {m.sources.slice(0, 4).map((s) =>
                  s.url ? (
                    <a key={s.document_id} href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full border border-black/10 px-2 py-0.5 text-[11px] opacity-80 hover:opacity-100">
                      {s.title}
                    </a>
                  ) : (
                    <span key={s.document_id} className="rounded-full border border-black/10 px-2 py-0.5 text-[11px] opacity-70">
                      {s.title}
                    </span>
                  ),
                )}
              </div>
            )}
            {showUsage && m.meta && !m.streaming && (
              <p className="mt-1 pl-1 text-[11px] opacity-60">
                {m.meta.cached
                  ? "Served from answer cache · 0 tokens"
                  : m.meta.usage
                    ? `${m.meta.usage.model} · ${m.meta.usage.input_tokens} in (${m.meta.usage.cached_input_tokens} cached) · ${m.meta.usage.output_tokens} out`
                    : null}
                {m.sources && ` · ${m.sources.length} source${m.sources.length === 1 ? "" : "s"}`}
              </p>
            )}
          </div>
        ))}
        {showQuickReplies && (
          <div className="flex flex-wrap gap-2 pt-1">
            {content.quick_replies!.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void submit(q)}
                className="rounded-full border border-[var(--hv-primary)] px-3 py-1.5 text-sm text-[var(--hv-primary)] transition hover:bg-[var(--hv-primary)] hover:text-[var(--hv-on-primary)]"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {gate ?? (
        <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-black/5 p-3">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            maxLength={2000}
            placeholder={content.input_placeholder || "Type your message…"}
            aria-label="Message"
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(120, e.target.scrollHeight)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit(input);
              }
            }}
            className="max-h-[120px] flex-1 resize-none rounded-[calc(var(--hv-radius)*0.75)] border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[var(--hv-primary)] focus:outline-none"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label="Stop generating"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hv-primary)] text-[var(--hv-on-primary)]"
            >
              <span className="h-3 w-3 rounded-sm bg-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hv-primary)] text-[var(--hv-on-primary)] disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </form>
      )}
      {features.branding !== false && (
        <p className="pb-2 text-center text-[11px] opacity-50">
          Powered by <span className="font-medium">Horizon Valley</span>
        </p>
      )}
    </div>
  );
}

function Bubble({ role, error, children }: { role: "user" | "assistant"; error?: boolean; children: ReactNode }) {
  const user = role === "user";
  return (
    <div className={`flex ${user ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2 text-sm leading-relaxed break-words ${
          user ? "bg-[var(--hv-user)] text-[var(--hv-on-user)]" : "bg-[var(--hv-bot)] text-[var(--hv-text)]"
        } ${error ? "ring-1 ring-red-300" : ""}`}
        style={{ borderRadius: "var(--hv-radius)", [user ? "borderBottomRightRadius" : "borderBottomLeftRadius"]: "4px" }}
      >
        {children}
      </div>
    </div>
  );
}
