"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, auth } from "@/lib/api";
import { Alert, Button } from "@/components/ui";

type Purpose = "verify_email" | "login" | "reset_password";

/** Six-digit code entry with paste support and a resend countdown. */
export function CodeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  const set = (i: number, d: string) => {
    const next = digits.map((c, j) => (j === i ? d : c)).join("").replace(/ /g, "");
    onChange(next.slice(0, 6));
  };

  return (
    <div className="flex justify-between gap-2" onPaste={(e) => {
      const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (text) {
        e.preventDefault();
        onChange(text);
        refs.current[Math.min(text.length, 5)]?.focus();
      }
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          aria-label={`Digit ${i + 1}`}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={d.trim()}
          autoFocus={i === 0}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(-1);
            set(i, v || " ");
            if (v && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d.trim() && i > 0) refs.current[i - 1]?.focus();
          }}
          className="h-12 w-11 rounded-lg border border-slate-300 text-center text-lg font-semibold shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
        />
      ))}
    </div>
  );
}

export function useCountdown(initial: number) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return [left, setLeft] as const;
}

export function CodeStep({
  email,
  purpose,
  retryAfter,
  onSubmit,
  submitLabel = "Verify",
  children,
}: {
  email: string;
  purpose: Purpose;
  retryAfter: number;
  onSubmit: (code: string) => Promise<void>;
  submitLabel?: string;
  children?: React.ReactNode;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useCountdown(retryAfter);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return setError("Enter the 6-digit code.");
    setBusy(true);
    setError(null);
    try {
      await onSubmit(code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      const r = await auth.resend(email, purpose);
      setLeft(r.kind === "verify" ? r.retryAfter : 60);
      setInfo("If an account exists for this address, a new code is on its way.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend the code.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="text-sm text-slate-600">
        We sent a 6-digit code to <span className="font-medium text-slate-900">{email}</span>. It expires in 10 minutes.
      </p>
      <CodeInput value={code} onChange={setCode} disabled={busy} />
      {children}
      {error && <Alert>{error}</Alert>}
      {info && !error && <Alert kind="info">{info}</Alert>}
      <Button type="submit" loading={busy} className="w-full">
        {submitLabel}
      </Button>
      <p className="text-center text-sm text-slate-500">
        Didn&apos;t get it?{" "}
        {left > 0 ? (
          <span>Resend in {left}s</span>
        ) : (
          <button type="button" onClick={resend} className="font-medium text-brand-600 hover:underline">
            Resend code
          </button>
        )}
      </p>
    </form>
  );
}
