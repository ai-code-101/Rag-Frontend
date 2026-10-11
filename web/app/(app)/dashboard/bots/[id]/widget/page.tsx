"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useBot } from "@/components/dashboard/BotContext";
import { Alert, Button, Card, CopyButton, Field, Input, Spinner, Textarea, Toggle } from "@/components/ui";
import { contrastText } from "@/components/widget/theme";
import { api, ApiError, json } from "@/lib/api";
import type { WidgetConfig, WidgetSettings } from "@/lib/types";

const FONTS = ["system", "inter", "roboto", "open-sans", "lato", "serif", "mono"] as const;
const ICONS = ["chat", "message", "help", "sparkle"] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-medium">{title}</h2>
      {children}
    </Card>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value.slice(0, 7)} onChange={(e) => onChange(e.target.value)} className="h-9 w-10 cursor-pointer rounded border border-slate-300" aria-label={label} />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" maxLength={9} />
      </div>
    </Field>
  );
}

function ListEditor({ items, onChange, placeholder, max }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; max: number }) {
  return (
    <div className="space-y-2">
      {items.map((q, i) => (
        <div key={i} className="flex gap-2">
          <Input value={q} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove">
            ×
          </Button>
        </div>
      ))}
      {items.length < max && (
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...items, ""])}>
          + {placeholder}
        </Button>
      )}
    </div>
  );
}

export default function WidgetPage() {
  const { bot } = useBot();
  const [settings, setSettings] = useState<WidgetSettings | null>(null);
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    api<WidgetConfig>(`/bots/${bot.id}/widget`).then((c) => {
      setSettings({ theme: c.theme, content: c.content, behavior: c.behavior, features: c.features });
      setVersion(c.config_version);
    });
  }, [bot.id]);

  // Push the draft to the preview iframe (same origin only).
  const pushPreview = () => {
    if (settings && frame.current?.contentWindow) {
      frame.current.contentWindow.postMessage({ type: "pc:preview", settings }, window.location.origin);
    }
  };
  useEffect(() => {
    const id = setTimeout(pushPreview, 120);
    return () => clearTimeout(id);
  });

  if (!settings) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Spinner />
      </div>
    );
  }

  const up = <S extends keyof WidgetSettings>(section: S, patch: Partial<WidgetSettings[S]>) =>
    setSettings((s) => (s ? { ...s, [section]: { ...s[section], ...patch } } : s));
  const { theme, content, behavior, features } = settings;

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const cleaned: WidgetSettings = {
        ...settings,
        content: { ...content, quick_replies: content.quick_replies.map((q) => q.trim()).filter(Boolean) },
        behavior: { ...behavior, hide_on_paths: behavior.hide_on_paths.map((p) => p.trim()).filter(Boolean) },
      };
      const r = await api<WidgetConfig>(`/bots/${bot.id}/widget`, { method: "PUT", ...json({ ...cleaned, config_version: version }) });
      setVersion(r.config_version);
      setSettings(cleaned);
      setMsg({ kind: "success", text: "Saved. Live widgets pick up the change within a minute." });
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof ApiError ? (err.field ? `${err.field}: ${err.message}` : err.message) : "Could not save." });
    } finally {
      setSaving(false);
    }
  };

  const snippet = bot.embed_snippet;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Section title="Theme">
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField label="Primary" value={theme.primary_color} onChange={(v) => up("theme", { primary_color: v })} />
            <ColorField label="Background" value={theme.background_color} onChange={(v) => up("theme", { background_color: v })} />
            <ColorField label="Text" value={theme.text_color} onChange={(v) => up("theme", { text_color: v })} />
            <ColorField label="Visitor bubble" value={theme.user_bubble_color} onChange={(v) => up("theme", { user_bubble_color: v })} />
            <ColorField label="Bot bubble" value={theme.bot_bubble_color} onChange={(v) => up("theme", { bot_bubble_color: v })} />
            <Field label={`Corner radius: ${theme.radius}px`}>
              <input type="range" min={0} max={32} value={theme.radius} onChange={(e) => up("theme", { radius: Number(e.target.value) })} className="w-full accent-brand-600" />
            </Field>
            <Field label="Font">
              <select value={theme.font_family} onChange={(e) => up("theme", { font_family: e.target.value as WidgetSettings["theme"]["font_family"] })} className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Launcher icon">
              <select
                value={ICONS.includes(theme.launcher_icon as (typeof ICONS)[number]) ? theme.launcher_icon : "custom"}
                onChange={(e) => up("theme", { launcher_icon: e.target.value === "custom" ? "https://" : e.target.value })}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {ICONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
                <option value="custom">Custom image URL</option>
              </select>
            </Field>
          </div>
          {!ICONS.includes(theme.launcher_icon as (typeof ICONS)[number]) && (
            <Field label="Launcher image URL (https)">
              <Input value={theme.launcher_icon} onChange={(e) => up("theme", { launcher_icon: e.target.value })} />
            </Field>
          )}
          <Field label="Logo URL (https, optional)">
            <Input placeholder="https://example.com/logo.png" value={theme.logo_url} onChange={(e) => up("theme", { logo_url: e.target.value })} />
          </Field>
        </Section>

        <Section title="Content">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <Input value={content.title} maxLength={60} onChange={(e) => up("content", { title: e.target.value })} />
            </Field>
            <Field label="Subtitle">
              <Input value={content.subtitle} maxLength={120} onChange={(e) => up("content", { subtitle: e.target.value })} />
            </Field>
          </div>
          <Field label="Greeting">
            <Textarea rows={2} maxLength={500} value={content.greeting} onChange={(e) => up("content", { greeting: e.target.value })} />
          </Field>
          <Field label="Quick replies" hint="Suggested first questions (up to 6).">
            <ListEditor items={content.quick_replies} max={6} placeholder="Add quick reply" onChange={(v) => up("content", { quick_replies: v })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Input placeholder">
              <Input value={content.input_placeholder} maxLength={80} onChange={(e) => up("content", { input_placeholder: e.target.value })} />
            </Field>
            <Field label="Offline message">
              <Input value={content.offline_message} maxLength={300} onChange={(e) => up("content", { offline_message: e.target.value })} />
            </Field>
          </div>
        </Section>

        <Section title="Behavior">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Position">
              <select value={behavior.position} onChange={(e) => up("behavior", { position: e.target.value as WidgetSettings["behavior"]["position"] })} className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-left">Bottom left</option>
              </select>
            </Field>
            <Field label="Offset X (px)">
              <Input type="number" min={0} max={200} value={behavior.offset_x} onChange={(e) => up("behavior", { offset_x: Number(e.target.value) })} />
            </Field>
            <Field label="Offset Y (px)">
              <Input type="number" min={0} max={200} value={behavior.offset_y} onChange={(e) => up("behavior", { offset_y: Number(e.target.value) })} />
            </Field>
          </div>
          <Toggle label="Open automatically (once per visit)" checked={behavior.auto_open} onChange={(v) => up("behavior", { auto_open: v })} />
          {behavior.auto_open && (
            <Field label="Delay before opening (ms)">
              <Input type="number" min={0} max={60000} step={500} value={behavior.auto_open_delay_ms} onChange={(e) => up("behavior", { auto_open_delay_ms: Number(e.target.value) })} />
            </Field>
          )}
          <Field label="Hide on paths" hint="E.g. /checkout/* or /admin. Use * as a wildcard.">
            <ListEditor items={behavior.hide_on_paths} max={50} placeholder="Add path" onChange={(v) => up("behavior", { hide_on_paths: v })} />
          </Field>
        </Section>

        <Section title="Features">
          <Toggle label="Show sources under answers" checked={features.show_sources} onChange={(v) => up("features", { show_sources: v })} />
          <Toggle label="Show “Powered by PeakChat”" checked={features.branding} onChange={(v) => up("features", { branding: v })} />
          <Toggle label="Lead capture form before chatting" checked={features.lead_capture.enabled} onChange={(v) => up("features", { lead_capture: { ...features.lead_capture, enabled: v, fields: features.lead_capture.fields.length ? features.lead_capture.fields : ["email"] } })} />
          {features.lead_capture.enabled && (
            <div className="space-y-3 rounded-lg bg-slate-50 p-3">
              <div className="flex gap-4">
                {(["name", "email", "phone"] as const).map((f) => (
                  <label key={f} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      className="accent-brand-600"
                      checked={features.lead_capture.fields.includes(f)}
                      onChange={(e) =>
                        up("features", {
                          lead_capture: {
                            ...features.lead_capture,
                            fields: e.target.checked ? [...features.lead_capture.fields, f] : features.lead_capture.fields.filter((x) => x !== f),
                          },
                        })
                      }
                    />
                    {f}
                  </label>
                ))}
              </div>
              <Input placeholder="Prompt, e.g. Leave your email so we can follow up" value={features.lead_capture.prompt} maxLength={200} onChange={(e) => up("features", { lead_capture: { ...features.lead_capture, prompt: e.target.value } })} />
            </div>
          )}
        </Section>

        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <Button onClick={save} loading={saving} className="w-full">
          Save widget
        </Button>
      </div>

      <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Embed code</h2>
            <CopyButton text={snippet} label="Copy embed code" />
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
            <code>{snippet}</code>
          </pre>
          <p className="mt-3 text-xs text-slate-500">
            Paste it into your site&apos;s &lt;head&gt; or before &lt;/body&gt;. Control it from JavaScript with{" "}
            <code>PeakChat.open()</code>, <code>PeakChat.close()</code> and <code>PeakChat.identify({"{ name, email }"})</code>, or open it with a
            link ending in <code>?chat=open</code>.
          </p>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
            <span className="ml-2 text-xs text-slate-500">Live preview</span>
          </div>
          <div className="relative h-[680px] bg-[linear-gradient(135deg,#f8fafc,#eef2ff)]">
            <div className={`absolute bottom-20 w-[360px] max-w-[calc(100%-24px)] overflow-hidden shadow-2xl ${behavior.position === "bottom-left" ? "left-3" : "right-3"}`} style={{ height: 560, borderRadius: theme.radius }}>
              <iframe ref={frame} title="Widget preview" src={`/widget/${bot.public_key}?preview=1`} onLoad={pushPreview} className="h-full w-full border-0" />
            </div>
            <div
              className={`absolute bottom-4 flex h-14 w-14 items-center justify-center rounded-full shadow-lg ${behavior.position === "bottom-left" ? "left-3" : "right-3"}`}
              style={{ background: theme.primary_color, color: contrastText(theme.primary_color.slice(0, 7)) }}
              aria-hidden
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
