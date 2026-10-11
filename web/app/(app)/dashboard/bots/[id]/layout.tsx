"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BotContext } from "@/components/dashboard/BotContext";
import { Alert, Button, CopyButton, Spinner, cn } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Bot } from "@/lib/types";

const TABS = [
  { slug: "knowledge", label: "Knowledge" },
  { slug: "instructions", label: "Instructions" },
  { slug: "widget", label: "Widget" },
  { slug: "test", label: "Test chat" },
];

export default function BotLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const [bot, setBot] = useState<Bot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Bot>(`/bots/${id}`)
      .then(setBot)
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? "Bot not found." : "Could not load the bot."));
  }, [id]);

  if (error) return <Alert>{error}</Alert>;
  if (!bot) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Spinner />
      </div>
    );
  }

  const remove = async () => {
    if (!confirm(`Delete "${bot.name}"? Its knowledge, conversations and widget stop working immediately.`)) return;
    await api(`/bots/${bot.id}`, { method: "DELETE" });
    router.replace("/dashboard");
  };

  return (
    <BotContext.Provider value={{ bot, setBot }}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
              ← All bots
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">{bot.name}</h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <code className="rounded bg-slate-100 px-1.5 py-0.5">{bot.public_key}</code>
              <CopyButton text={bot.public_key} label="Copy key" />
            </div>
          </div>
          <Button variant="secondary" onClick={remove} className="self-start text-red-600">
            Delete bot
          </Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Bot sections">
          {TABS.map((t) => {
            const href = `/dashboard/bots/${bot.id}/${t.slug}`;
            const active = pathname.startsWith(href);
            return (
              <Link
                key={t.slug}
                href={href}
                className={cn(
                  "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap",
                  active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div>{children}</div>
      </div>
    </BotContext.Provider>
  );
}
