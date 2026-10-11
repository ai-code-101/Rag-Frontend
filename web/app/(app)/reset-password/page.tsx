"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { CodeStep } from "@/components/auth/CodeStep";
import { Alert, Field, Input } from "@/components/ui";
import { ApiError, auth } from "@/lib/api";

function ResetForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const retry = Number(params.get("retry") ?? 60) || 60;

  if (done) {
    return (
      <AuthShell title="Password updated">
        <Alert kind="success">Your password has been reset. All other sessions were signed out.</Alert>
        <Link href="/login" className="mt-4 block text-center text-sm font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" footer={<Link href="/login" className="font-medium text-brand-600 hover:underline">Back to sign in</Link>}>
      {!params.get("email") && (
        <div className="mb-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
      )}
      <CodeStep
        email={email}
        purpose="reset_password"
        retryAfter={retry}
        submitLabel="Reset password"
        onSubmit={async (code) => {
          if (password.length < 8) throw new ApiError(422, "validation_error", "Password must be at least 8 characters with letters and numbers.");
          await auth.reset(email, code, password);
          setDone(true);
        }}
      >
        <Field label="New password" htmlFor="new-password" hint="At least 8 characters, with letters and numbers.">
          <Input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      </CodeStep>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
