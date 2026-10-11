"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { CodeStep } from "@/components/auth/CodeStep";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ApiError, auth } from "@/lib/api";

type Step = { kind: "password" } | { kind: "code-email" } | { kind: "verify"; retryAfter: number } | { kind: "login-code"; retryAfter: number };

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = () => router.replace("/dashboard");

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await auth.login(email, password);
      if (r.kind === "session") done();
      else setStep({ kind: "verify", retryAfter: r.retryAfter });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitCodeEmail = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await auth.requestLoginCode(email);
      setStep({ kind: "login-code", retryAfter: r.kind === "verify" ? r.retryAfter : 60 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send a code.");
    } finally {
      setBusy(false);
    }
  };

  if (step.kind === "verify") {
    return (
      <AuthShell title="Verify your email" subtitle="Your email address isn't verified yet.">
        <CodeStep email={email} purpose="verify_email" retryAfter={step.retryAfter} onSubmit={async (code) => {
          await auth.verifyEmail(email, password, code);
          done();
        }} />
      </AuthShell>
    );
  }
  if (step.kind === "login-code") {
    return (
      <AuthShell title="Enter your sign-in code">
        <CodeStep email={email} purpose="login" retryAfter={step.retryAfter} submitLabel="Sign in" onSubmit={async (code) => {
          await auth.loginWithCode(email, code);
          done();
        }} />
      </AuthShell>
    );
  }

  const footer = (
    <>
      New to PeakChat?{" "}
      <Link href="/signup" className="font-medium text-brand-600 hover:underline">
        Create an account
      </Link>
    </>
  );

  if (step.kind === "code-email") {
    return (
      <AuthShell title="Sign in with a code" subtitle="We'll email you a one-time code." footer={footer}>
        <form onSubmit={submitCodeEmail} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" loading={busy} className="w-full">
            Email me a code
          </Button>
          <button type="button" onClick={() => setStep({ kind: "password" })} className="w-full text-center text-sm text-brand-600 hover:underline">
            Use your password instead
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your chatbots." footer={footer}>
      <form onSubmit={submitPassword} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={busy} className="w-full">
          Sign in
        </Button>
        <button type="button" onClick={() => setStep({ kind: "code-email" })} className="w-full text-center text-sm text-brand-600 hover:underline">
          Email me a sign-in code instead
        </button>
      </form>
    </AuthShell>
  );
}
