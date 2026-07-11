import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRootEnvPath = path.resolve(__dirname, "../../..", ".env.local");
const allowedRepoEnvKeys = new Set([
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_SUPABASE_KEY",
  "EXPO_PUBLIC_SUPABASE_URL",
  "HUNGRY_CONSOLE_PASSWORD",
  "HUNGRY_CONSOLE_USERNAME",
  "HUNGRY_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

function loadRepoRootEnvFallback() {
  if (!existsSync(repoRootEnvPath)) return;

  for (const line of readFileSync(repoRootEnvPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!allowedRepoEnvKeys.has(key) || process.env[key]) continue;

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadRepoRootEnvFallback();

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "upgrade-insecure-requests",
].join("; ");

const contentSecurityPolicyReportOnly = contentSecurityPolicy
  .split("; ")
  .filter((directive) => directive !== "upgrade-insecure-requests")
  .join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicyReportOnly,
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), payment=(), usb=(), bluetooth=(), browsing-topics=(), geolocation=(self)",
  },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const privateNoIndexHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, no-cache, must-revalidate, proxy-revalidate",
  },
  {
    key: "Pragma",
    value: "no-cache",
  },
  {
    key: "Expires",
    value: "0",
  },
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/merchant",
        headers: privateNoIndexHeaders,
      },
      {
        source: "/merchant/:path*",
        headers: privateNoIndexHeaders,
      },
      {
        source: "/console",
        headers: privateNoIndexHeaders,
      },
      {
        source: "/console/:path*",
        headers: privateNoIndexHeaders,
      },
      {
        source: "/api/merchant/:path*",
        headers: privateNoIndexHeaders,
      },
      {
        source: "/api/console/:path*",
        headers: privateNoIndexHeaders,
      },
    ];
  },
};

export default nextConfig;
