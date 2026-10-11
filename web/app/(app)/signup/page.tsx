"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { CodeStep } from "@/components/auth/CodeStep";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ApiError, auth } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      const r = await auth.signup(email, password);
      if (r.kind === "verify") setRetryAfter(r.retryAfter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign up. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (retryAfter !== null) {
    return (
      <AuthShell title="Check your email" subtitle="Verify your address to finish creating your account.">
        <CodeStep
          email={email}
          purpose="verify_email"
          retryAfter={retryAfter}
          submitLabel="Verify and continue"
          onSubmit={async (code) => {
            await auth.verifyEmail(email, password, code);
            router.replace("/dashboard");
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Build an AI assistant trained on your own content."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters, with letters and numbers.">
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm">
          <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={busy} className="w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
