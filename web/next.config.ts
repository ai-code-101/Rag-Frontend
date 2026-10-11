import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // small, self-contained server for Cloud Run
  poweredByHeader: false,
  reactStrictMode: true,
  // SSE responses are proxied through /api; compression would buffer them.
  compress: false,
};

export default nextConfig;
