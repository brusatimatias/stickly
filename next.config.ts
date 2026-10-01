import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { STATIC_SECURITY_HEADERS } from "./src/lib/securityHeaders";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app"],
  images: {
    remotePatterns: [{ hostname: "lh3.googleusercontent.com" }],
  },
  // The per-request Content-Security-Policy is set in src/proxy.ts.
  async headers() {
    return [
      { source: "/:path*", headers: STATIC_SECURITY_HEADERS },
      // Browsers check for a new service worker on their own; never let a
      // cache hand them an old one.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
