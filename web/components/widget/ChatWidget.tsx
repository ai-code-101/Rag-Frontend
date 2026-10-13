"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { consumeChatStream, newVisitorId, safeStorage } from "@/lib/chat-client";
import { originAllowed } from "@/lib/origin";
import type { PublicWidgetConfig, WidgetSettings } from "@/lib/types";
import { ChatView, type ChatMessage, type SendFn } from "./ChatView";

type Props = { config: PublicWidgetConfig; apiUrl: string; publicKey: string; preview: boolean };

/**
 * Chat UI inside the iframe. Visitor and conversation ids live in this frame's
 * localStorage (partitioned per embedding site by modern browsers, no third-party
 * cookies). The parent page talks to us only through origin-checked postMessage.
 */
export function ChatWidget({ config, apiUrl, publicKey, preview }: Props) {
  const storage = useMemo(() => safeStorage(), []);
  const [settings, setSettings] = useState<WidgetSettings>(config);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [focus, setFocus] = useState(0);
  const [leadDone, setLeadDone] = useState(true);
  const parentOrigin = useRef<string | null>(null);
  const visitorMeta = useRef<Record<string, string>>({});
  const conversationId = useRef<string | null>(null);
  const [embedded, setEmbedded] = useState(false);

  const vidKey = `hv_vid_${publicKey}`;
  const cidKey = `hv_cid_${publicKey}`;
  const leadKey = `hv_lead_${publicKey}`;

  const visitorId = useMemo(() => {
    if (typeof window === "undefined") return "";
    let v = storage.get(vidKey);
    if (!v || !/^[A-Za-z0-9_-]{16,64}$/.test(v)) {
      v = newVisitorId();
      storage.set(vidKey, v);
    }
    return v;
  }, [storage, vidKey]);

  // Restore the previous conversation after a reload.
  useEffect(() => {
    setLeadDone(!config.features.lead_capture.enabled || !!storage.get(leadKey));
    const cid = storage.get(cidKey);
    if (!cid || preview) return;
    conversationId.current = cid;
    fetch(`${apiUrl}/v1/widget/${publicKey}/conversations/${encodeURIComponent(cid)}?visitor_id=${encodeURIComponent(visitorId)}`, { credentials: "omit" })
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((r: { messages: { id: string; role: "user" | "assistant"; content: string }[] }) =>
        setHistory(r.messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))),
      )
      .catch(() => {});
  }, [apiUrl, publicKey, visitorId, storage, cidKey, leadKey, preview, config.features.lead_capture.enabled]);

  const postToParent = useCallback((msg: object) => {
    if (window.parent === window) return;
    window.parent.postMessage(msg, parentOrigin.current ?? "*");
  }, []);

  // postMessage bridge with the loader (or the dashboard preview).
  useEffect(() => {
    setEmbedded(window.parent !== window);
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      const data = e.data as { type?: string; user?: Record<string, string>; settings?: WidgetSettings; open?: boolean };
      if (!data || typeof data.type !== "string") return;
      // Live preview: only the dashboard (same origin) may push draft settings.
      if (data.type === "hv:preview") {
        if (preview && e.origin === window.location.origin && data.settings) setSettings(data.settings);
        return;
      }
      if (e.origin !== window.location.origin && !originAllowed(config.allowed_origins, e.origin)) return;
      if (data.type === "hv:init") {
        parentOrigin.current = e.origin;
        if (data.user) visitorMeta.current = data.user;
        if (data.open) setFocus((f) => f + 1);
      } else if (data.type === "hv:identify" && data.user) {
        visitorMeta.current = data.user;
      } else if (data.type === "hv:open") {
        setFocus((f) => f + 1);
      }
    };
    window.addEventListener("message", onMessage);
    postToParent({ type: "hv:ready" }); // contains nothing sensitive, safe before the handshake
    return () => window.removeEventListener("message", onMessage);
  }, [config.allowed_origins, preview, postToParent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && postToParent({ type: "hv:close" });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [postToParent]);

  const send: SendFn = useCallback(
    async (text, h, signal) => {
      const res = await fetch(`${apiUrl}/v1/widget/${publicKey}/chat`, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor_id: visitorId, conversation_id: conversationId.current ?? "", message: text, visitor_meta: visitorMeta.current }),
        signal,
      });
      await consumeChatStream(
        res,
        {
          onMeta: (m) => {
            conversationId.current = m.conversation_id;
            if (!preview) storage.set(cidKey, m.conversation_id);
          },
          onSources: h.onSources,
          onToken: h.onToken,
          onDone: h.onDone,
          onError: () => h.onError(settings.content.offline_message || "We're having trouble connecting."),
        },
        signal,
      );
    },
    [apiUrl, publicKey, visitorId, preview, storage, cidKey, settings.content.offline_message],
  );

  const lc = settings.features.lead_capture;
  const gate =
    lc.enabled && !leadDone ? (
      <LeadForm
        fields={lc.fields}
        prompt={lc.prompt}
        onSubmit={async (values) => {
          if (!preview) {
            const res = await fetch(`${apiUrl}/v1/widget/${publicKey}/leads`, {
              method: "POST",
              credentials: "omit",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ visitor_id: visitorId, conversation_id: conversationId.current ?? "", ...values }),
            });
            if (!res.ok) {
              const b = await res.json().catch(() => ({}));
              throw new Error(b?.error?.message ?? "Could not submit the form.");
            }
            storage.set(leadKey, "1");
          }
          visitorMeta.current = { ...visitorMeta.current, ...values };
          setLeadDone(true);
        }}
      />
    ) : undefined;

  return (
    <div className="h-[100dvh] w-full">
      <ChatView
        theme={settings.theme}
        content={settings.content}
        features={settings.features}
        initialMessages={history}
        send={send}
        onClose={embedded ? () => postToParent({ type: "hv:close" }) : undefined}
        gate={gate}
        focusSignal={focus}
      />
    </div>
  );
}

function LeadForm({ fields, prompt, onSubmit }: { fields: string[]; prompt: string; onSubmit: (v: Record<string, string>) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const labels: Record<string, [string, string]> = { name: ["Name", "text"], email: ["Email", "email"], phone: ["Phone", "tel"] };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 border-t border-black/5 p-3">
      <p className="text-sm">{prompt || "Before we start, how can we reach you?"}</p>
      {fields.map((f) => (
        <input
          key={f}
          required
          type={labels[f]?.[1] ?? "text"}
          placeholder={labels[f]?.[0] ?? f}
          aria-label={labels[f]?.[0] ?? f}
          value={values[f] ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
          className="block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[var(--hv-primary)] focus:outline-none"
        />
      ))}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-[var(--hv-primary)] py-2 text-sm font-medium text-[var(--hv-on-primary)] disabled:opacity-60">
        Start chatting
      </button>
    </form>
  );
}
