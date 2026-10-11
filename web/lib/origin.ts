/** Normalises an origin the same way the API does ("https://A.com:443" → "https://a.com"). */
export function normalizeOrigin(origin: string): string | null {
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Mirrors the API's allow-list check: exact origins plus "https://*.example.com" wildcards
 * (which match subdomains but not the apex). An empty list allows every origin.
 */
export function originAllowed(allowed: string[], origin: string): boolean {
  if (!allowed.length) return true;
  const norm = normalizeOrigin(origin);
  if (!norm) return false;
  return allowed.some((a) => {
    if (a === norm) return true;
    const i = a.indexOf("://*.");
    if (i < 0) return false;
    const scheme = a.slice(0, i);
    const suffix = a.slice(i + 4); // ".example.com[:port]"
    return norm.startsWith(scheme + "://") && norm.endsWith(suffix) && norm.length > scheme.length + 3 + suffix.length;
  });
}
