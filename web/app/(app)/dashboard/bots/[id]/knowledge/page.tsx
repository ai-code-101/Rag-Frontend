"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useBot } from "@/components/dashboard/BotContext";
import { Alert, Badge, Button, Card, Field, Input, Spinner, Textarea, cn } from "@/components/ui";
import { api, apiFetch, ApiError, json } from "@/lib/api";
import type { KnowledgeDocument } from "@/lib/types";

const ACCEPT = ".pdf,.docx,.txt,.md,.markdown";
const MAX_MB = 20;

type Upload = { name: string; state: "uploading" | "done" | "duplicate" | "error"; error?: string };

function statusBadge(d: KnowledgeDocument) {
  switch (d.status) {
    case "ready":
      return <Badge color="green">Ready · {d.chunk_count} chunks</Badge>;
    case "failed":
      return <Badge color="red">Failed</Badge>;
    case "processing":
      return (
        <Badge color="amber">
          <Spinner className="h-3 w-3" /> Processing
        </Badge>
      );
    default:
      return <Badge>Queued</Badge>;
  }
}

function formatSize(n: number) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1 << 20) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1 << 20)).toFixed(1)} MB`;
}

export default function KnowledgePage() {
  const { bot } = useBot();
  const [docs, setDocs] = useState<KnowledgeDocument[] | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"url" | "text" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ documents: KnowledgeDocument[] }>(`/bots/${bot.id}/documents`);
      setDocs(r.documents);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load documents.");
    }
  }, [bot.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live status: poll only while something is still being processed.
  const active = docs?.some((d) => d.status === "pending" || d.status === "processing");
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => void load(), 2500);
    return () => clearInterval(id);
  }, [active, load]);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    setError(null);
    for (const f of list) {
      const entry: Upload = { name: f.name, state: "uploading" };
      if (f.size > MAX_MB << 20) {
        setUploads((u) => [{ ...entry, state: "error", error: `Larger than ${MAX_MB} MB` }, ...u]);
        continue;
      }
      setUploads((u) => [entry, ...u]);
      const body = new FormData();
      body.append("file", f);
      try {
        const res = await apiFetch(`/bots/${bot.id}/documents`, { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed");
        setUploads((u) => u.map((x) => (x === entry ? { ...x, state: data.duplicate ? "duplicate" : "done" } : x)));
      } catch (e) {
        setUploads((u) => u.map((x) => (x === entry ? { ...x, state: "error", error: (e as Error).message } : x)));
      }
    }
    void load();
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
  };

  const addUrl = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("url");
    setError(null);
    try {
      await api(`/bots/${bot.id}/documents/url`, { method: "POST", ...json({ url: url.trim() }) });
      setUrl("");
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the URL.");
    } finally {
      setBusy(null);
    }
  };

  const addText = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("text");
    setError(null);
    try {
      await api(`/bots/${bot.id}/documents/text`, { method: "POST", ...json({ title: title.trim(), text }) });
      setTitle("");
      setText("");
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the text.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (d: KnowledgeDocument) => {
    if (!confirm(`Remove "${d.filename}" from the knowledge base?`)) return;
    setDocs((list) => list?.filter((x) => x.id !== d.id) ?? null);
    try {
      await api(`/bots/${bot.id}/documents/${d.id}`, { method: "DELETE" });
    } catch {
      void load();
    }
  };

  const reingest = async (d: KnowledgeDocument) => {
    await api(`/bots/${bot.id}/documents/${d.id}/reingest`, { method: "POST" }).catch(() => {});
    void load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-2">
        <Card className="p-5">
          <h2 className="font-medium">Upload files</h2>
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition",
              dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-500 hover:bg-slate-50",
            )}
          >
            <svg className="h-8 w-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-2 text-sm font-medium text-slate-700">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-slate-500">PDF, DOCX, TXT or Markdown · up to {MAX_MB} MB each</p>
            <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => e.target.files && void uploadFiles(e.target.files)} />
          </div>
          {uploads.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {uploads.slice(0, 6).map((u, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-600">{u.name}</span>
                  {u.state === "uploading" && <Spinner className="h-4 w-4 text-slate-400" />}
                  {u.state === "done" && <Badge color="green">Uploaded</Badge>}
                  {u.state === "duplicate" && <Badge>Already added</Badge>}
                  {u.state === "error" && <Badge color="red">{u.error}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-medium">Import a web page</h2>
          <form onSubmit={addUrl} className="mt-3 flex gap-2">
            <Input type="url" required placeholder="https://example.com/faq" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Page URL" />
            <Button type="submit" loading={busy === "url"}>
              Add
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="font-medium">Paste text</h2>
          <form onSubmit={addText} className="mt-3 space-y-3">
            <Field label="Title" htmlFor="kt-title">
              <Input id="kt-title" placeholder="e.g. Shipping policy" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </Field>
            <Field label="Content" htmlFor="kt-text" hint="Markdown headings (#, ##) are used as section titles.">
              <Textarea id="kt-text" rows={6} required value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <Button type="submit" loading={busy === "text"}>
              Add text
            </Button>
          </form>
        </Card>
      </div>

      <Card className="p-0 lg:col-span-3">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-medium">Knowledge base</h2>
          <span className="text-xs text-slate-500">{docs ? `${docs.length} source${docs.length === 1 ? "" : "s"}` : ""}</span>
        </div>
        {error && (
          <div className="p-4">
            <Alert>{error}</Alert>
          </div>
        )}
        {docs === null ? (
          <div className="flex justify-center py-12 text-slate-400">
            <Spinner />
          </div>
        ) : docs.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">No knowledge yet. Upload a file, import a page or paste some text.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800" title={d.source_url ?? d.filename}>
                    {d.filename}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {d.source_type.toUpperCase()} {formatSize(d.size_bytes) && `· ${formatSize(d.size_bytes)}`} · {new Date(d.created_at).toLocaleString()}
                  </p>
                  {d.status === "failed" && d.error && <p className="mt-1 text-xs text-red-600">{d.error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {statusBadge(d)}
                  {(d.source_type === "url" || d.status === "failed") && d.status !== "pending" && d.status !== "processing" && (
                    <Button variant="ghost" size="sm" onClick={() => reingest(d)} title={d.source_type === "url" ? "Re-fetch the page" : "Retry"}>
                      {d.source_type === "url" ? "Refresh" : "Retry"}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => remove(d)} aria-label={`Delete ${d.filename}`} className="text-red-600">
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
