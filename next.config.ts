import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";

/**
 * Security headers (ST4S S1/S5 and OWASP): HTTPS only, no framing, no MIME sniffing, a strict
 * referrer policy, and a content security policy that only allows Bcome's own origin. Next.js
 * needs inline scripts for hydration; everything else is same-origin.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(production ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Data files in /data are read on the server at request time.
  outputFileTracingIncludes: { "/api/**": ["./data/**/*"] },
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Signed-in pages are never cached by browsers or proxies.
      { source: "/(account|adviser|verify|invite)/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
