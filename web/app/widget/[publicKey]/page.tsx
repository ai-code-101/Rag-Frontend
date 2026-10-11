import type { Metadata } from "next";
import { ChatWidget } from "@/components/widget/ChatWidget";
import { serverEnv } from "@/lib/env";
import { getPublicConfig } from "@/lib/widget-public";

export const metadata: Metadata = { title: "Chat", robots: { index: false, follow: false } };

// The iframe page. Its CSP frame-ancestors header (set in proxy.ts) restricts which sites
// may embed it. Config is fetched server-side so the first paint is already themed.
export default async function WidgetPage({ params, searchParams }: { params: Promise<{ publicKey: string }>; searchParams: Promise<{ preview?: string; v?: string }> }) {
  const { publicKey } = await params;
  const { preview, v } = await searchParams;
  // Preview always renders the latest saved config (the draft arrives via postMessage).
  const config = await getPublicConfig(publicKey, v, preview === "1");
  if (!config) {
    return <p className="p-6 text-center text-sm text-slate-500">This chat is unavailable.</p>;
  }
  return <ChatWidget config={config} apiUrl={serverEnv.publicApiUrl} publicKey={publicKey} preview={preview === "1"} />;
}
