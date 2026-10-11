"use client";

import type { ApiErrorBody } from "./types";

/**
 * Dashboard API client. Calls go through the same-origin /api proxy, so the refresh
 * cookie is first-party. The short-lived access token is kept in memory only (never in
 * localStorage) and refreshed transparently on 401.
 */
const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) {
    super(message);
  }
}

type Session = { access_token: string; expires_at: string; user: { id: string; email: string; email_verified: boolean; created_at: string } };

let accessToken: string | null = null;
let refreshing: Promise<Session | null> | null = null;
let onSessionChange: ((s: Session | null) => void) | null = null;

export function setSessionListener(fn: ((s: Session | null) => void) | null) {
  onSessionChange = fn;
}

export function setSession(s: Session | null) {
  accessToken = s?.access_token ?? null;
  onSessionChange?.(s);
}

async function toError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error */
  }
  const e = body.error;
  return new ApiError(res.status, e?.code ?? "error", e?.message ?? `Request failed (${res.status})`, e?.field);
}

/** Refreshes the session using the httpOnly cookie. Concurrent callers share one request. */
export function refreshSession(): Promise<Session | null> {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-Requested-With": "peakchat" },
    })
      .then(async (res) => {
        if (!res.ok) {
          setSession(null);
          return null;
        }
        const s = (await res.json()) as Session;
        setSession(s);
        return s;
      })
      .catch(() => null)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: "same-origin" });
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    const s = await refreshSession();
    if (s) return apiFetch(path, init, false);
  }
  return res;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

// ---- auth calls -------------------------------------------------------------------

export type AuthResult = { kind: "session"; session: Session } | { kind: "verify"; retryAfter: number };

async function authCall(path: string, body: unknown): Promise<AuthResult> {
  const res = await fetch(`${BASE}/auth/${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Requested-With": "peakchat" },
    body: JSON.stringify(body),
  });
  if (res.status === 202) {
    const b = await res.json().catch(() => ({}));
    return { kind: "verify", retryAfter: b.retry_after ?? 60 };
  }
  if (!res.ok) throw await toError(res);
  const session = (await res.json()) as Session;
  setSession(session);
  return { kind: "session", session };
}

export const auth = {
  signup: (email: string, password: string) => authCall("signup", { email, password }),
  login: (email: string, password: string) => authCall("login", { email, password }),
  verifyEmail: (email: string, password: string, code: string) => authCall("verify-email", { email, password, code }),
  resend: (email: string, purpose: "verify_email" | "login" | "reset_password") => authCall("otp/resend", { email, purpose }),
  requestLoginCode: (email: string) => authCall("login/code", { email }),
  loginWithCode: (email: string, code: string) => authCall("login/code/verify", { email, code }),
  forgot: (email: string) => authCall("password/forgot", { email }),
  async reset(email: string, code: string, password: string) {
    const res = await fetch(`${BASE}/auth/password/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password }),
    });
    if (!res.ok) throw await toError(res);
  },
  async logout() {
    await fetch(`${BASE}/auth/logout`, { method: "POST", credentials: "same-origin", headers: { "X-Requested-With": "peakchat" } }).catch(() => {});
    setSession(null);
  },
};
