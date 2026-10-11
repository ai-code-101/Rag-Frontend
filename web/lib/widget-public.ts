import "server-only";
import { serverEnv } from "./env";
import type { PublicWidgetConfig } from "./types";

const KEY_RE = /^pk_[A-Za-z0-9_-]{24}$/;

export function validPublicKey(k: string) {
  return KEY_RE.test(k);
}

/** Server-side fetch of a bot's public widget config (cached for 30 s). */
export async function getPublicConfig(publicKey: string, version?: string, fresh = false): Promise<PublicWidgetConfig | null> {
  if (!validPublicKey(publicKey)) return null;
  // The version only varies the cache key, so a saved change shows up immediately.
  const v = version && /^\d{1,9}$/.test(version) ? `?v=${version}` : "";
  try {
    const res = await fetch(`${serverEnv.apiInternalUrl}/v1/widget/${publicKey}/config${v}`, fresh ? { cache: "no-store" } : { next: { revalidate: 30 } });
    if (!res.ok) return null;
    return (await res.json()) as PublicWidgetConfig;
  } catch {
    return null;
  }
}

/** frame-ancestors value: this app (dashboard preview) plus the bot's allowed origins, or any site if none are set. */
export function frameAncestors(allowed: string[] | undefined): string {
  if (!allowed || allowed.length === 0) return "*";
  const safe = allowed.filter((o) => /^https?:\/\/(\*\.)?[a-z0-9.-]+(:\d+)?$/i.test(o));
  return ["'self'", ...safe].join(" ");
}
