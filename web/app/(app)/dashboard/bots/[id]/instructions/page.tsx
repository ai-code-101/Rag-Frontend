"use client";

import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useBot } from "@/components/dashboard/BotContext";
import { Alert, Badge, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { api, ApiError, json } from "@/lib/api";
import type { Bot } from "@/lib/types";

const TEMPLATE = `Tone: friendly, concise and professional.
Persona: you are the virtual assistant of <Company>.
Scope: answer questions about our products, pricing, shipping and returns.
Rules:
- Recommend contacting support@<company>.com for account-specific issues.
- Keep answers under 120 words unless the visitor asks for detail.
Avoid: discussing competitors, giving legal or medical advice, making promises about delivery dates.`;

const MAX = 8000;

export default function InstructionsPage() {
  const { bot, setBot } = useBot();
  const [form, setForm] = useState({
    name: bot.name,
    system_instructions: bot.system_instructions,
    fallback_message: bot.fallback_message,
    model: bot.model,
    temperature: bot.temperature,
    allowed_origins: bot.allowed_origins,
  });
  const [originDraft, setOriginDraft] = useState("");
  const [models, setModels] = useState<string[]>([bot.model]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    api<{ models: string[] }>("/models").then((r) => setModels(r.models)).catch(() => {});
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const addOrigin = () => {
    const o = originDraft.trim().replace(/\/+$/, "");
    if (!o) return;
    if (!form.allowed_origins.includes(o)) set("allowed_origins", [...form.allowed_origins, o]);
    setOriginDraft("");
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const updated = await api<Bot>(`/bots/${bot.id}`, { method: "PATCH", ...json(form) });
      setBot(updated);
      setForm((f) => ({ ...f, allowed_origins: updated.allowed_origins }));
      setMsg({ kind: "success", text: "Saved. Changes apply to new messages within a few seconds." });
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof ApiError ? (err.field ? `${err.field}: ${err.message}` : err.message) : "Could not save." });
    } finally {
      setSaving(false);
    }
  };

  const claude5 = /^claude-(opus|sonnet|haiku)-5/.test(form.model);

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-3">
      <Card className="space-y-5 p-5 lg:col-span-2">
        <Field label="Bot name" htmlFor="name">
          <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required />
        </Field>
        <Field
          label="Custom instructions"
          htmlFor="instructions"
          hint={
            <span className="flex justify-between">
              <span>Tone, persona, rules and what to avoid. The bot always answers only from your knowledge.</span>
              <span className={form.system_instructions.length > MAX ? "text-red-600" : ""}>
                {form.system_instructions.length}/{MAX}
              </span>
            </span>
          }
        >
          <Textarea
            id="instructions"
            rows={16}
            className="font-mono text-[13px] leading-relaxed"
            placeholder={TEMPLATE}
            value={form.system_instructions}
            onChange={(e) => set("system_instructions", e.target.value)}
          />
        </Field>
        {!form.system_instructions && (
          <Button type="button" variant="secondary" size="sm" onClick={() => set("system_instructions", TEMPLATE)}>
            Start from a template
          </Button>
        )}
        <Field label="Fallback message" htmlFor="fallback" hint="Used when the knowledge base doesn't contain the answer, instead of guessing.">
          <Textarea id="fallback" rows={2} maxLength={500} value={form.fallback_message} onChange={(e) => set("fallback_message", e.target.value)} />
        </Field>
      </Card>

      <div className="space-y-6">
        <Card className="space-y-5 p-5">
          <Field label="Model" htmlFor="model">
            <select
              id="model"
              value={form.model}
              onChange={(e) => set("model", e.target.value)}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={`Temperature: ${form.temperature.toFixed(1)}`}
            htmlFor="temperature"
            hint={claude5 ? "Claude 5 models use fixed sampling; this applies to other models." : "Lower is more factual, higher more creative."}
          >
            <input
              id="temperature"
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={form.temperature}
              onChange={(e) => set("temperature", Number(e.target.value))}
              className="w-full accent-brand-600"
            />
          </Field>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-medium text-slate-700">Allowed websites</h2>
          <p className="text-xs text-slate-500">Only these origins can embed the widget. Wildcards like https://*.example.com are supported.</p>
          {form.allowed_origins.length === 0 && <Alert kind="warning">No origins set: any website can embed this bot and use your quota.</Alert>}
          <div className="flex flex-wrap gap-1.5">
            {form.allowed_origins.map((o) => (
              <Badge key={o} color="blue">
                {o}
                <button type="button" aria-label={`Remove ${o}`} onClick={() => set("allowed_origins", form.allowed_origins.filter((x) => x !== o))} className="ml-1 hover:text-red-600">
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="https://www.example.com"
              value={originDraft}
              onChange={(e) => setOriginDraft(e.target.value)}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOrigin();
                }
              }}
              aria-label="Add origin"
            />
            <Button type="button" variant="secondary" onClick={addOrigin}>
              Add
            </Button>
          </div>
        </Card>

        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <Button type="submit" loading={saving} className="w-full">
          Save changes
        </Button>
      </div>
    </form>
  );
}
