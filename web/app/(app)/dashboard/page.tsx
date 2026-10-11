"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Alert, Badge, Button, Card, Input, Spinner } from "@/components/ui";
import { api, ApiError, json } from "@/lib/api";
import type { Bot } from "@/lib/types";

export default function BotsPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ bots: Bot[] }>("/bots")
      .then((r) => setBots(r.bots))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load bots."));
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const bot = await api<Bot>("/bots", { method: "POST", ...json({ name: name.trim() }) });
      router.push(`/dashboard/bots/${bot.id}/knowledge`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the bot.");
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your chatbots</h1>
          <p className="mt-1 text-sm text-slate-500">Each bot has its own knowledge, instructions and widget.</p>
        </div>
        <form onSubmit={create} className="flex w-full gap-2 sm:w-auto">
          <Input placeholder="New bot name, e.g. Support" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className="sm:w-64" aria-label="Bot name" />
          <Button type="submit" loading={creating}>
            Create bot
          </Button>
        </form>
      </div>

      {error && <Alert>{error}</Alert>}

      {bots === null ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner />
        </div>
      ) : bots.length === 0 ? (
        <Card className="p-10 text-center">
          <h2 className="text-lg font-medium">Create your first chatbot</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Give it a name above, upload your docs or website, and you&apos;ll have an embeddable assistant in a few minutes.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((b) => (
            <Link key={b.id} href={`/dashboard/bots/${b.id}/knowledge`} className="group">
              <Card className="h-full p-5 transition group-hover:border-brand-500 group-hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium text-slate-900">{b.name}</h2>
                  <Badge color="blue">{b.model}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-500">{b.system_instructions || "No custom instructions yet."}</p>
                <p className="mt-4 text-xs text-slate-400">Created {new Date(b.created_at).toLocaleDateString()}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
