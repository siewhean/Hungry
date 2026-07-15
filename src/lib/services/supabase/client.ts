import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAuthStorage } from "./authStorage";
import { installPkceCryptoPolyfill } from "./pkceCryptoPolyfill";

export type HungryDataSource = "mock" | "supabase" | "excel";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
// Accept both the canonical ANON_KEY name and the newer publishable KEY alias
const SUPABASE_ANON_KEY =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim()) ??
  "";
let configuredDataSourceOverride: HungryDataSource | null = null;

let cachedClient: SupabaseClient | null | undefined;

const SUPPORTED_DATA_SOURCES = new Set<HungryDataSource>(["mock", "supabase", "excel"]);

function isProductionRuntime(): boolean {
  return process.env.EXPO_PUBLIC_APP_ENV?.trim().toLowerCase() === "production";
}

export function getSupabaseConfigurationError(
  url = SUPABASE_URL,
  anonKey = SUPABASE_ANON_KEY,
): string | null {
  if (!url || !anonKey) return "Supabase URL and public key are required";

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return "Supabase URL is invalid";
  }

  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) {
    return "Supabase URL must be an HTTPS endpoint without embedded credentials";
  }

  const normalizedKey = anonKey.trim();
  if (
    normalizedKey.length < 20 ||
    /\s/.test(normalizedKey) ||
    /^(your[-_]|replace[-_]|placeholder|changeme|test[-_]?key)/i.test(normalizedKey)
  ) {
    return "Supabase public key is invalid or a placeholder";
  }

  if (/^(sb_secret_)|service[_-]?role/i.test(normalizedKey)) {
    return "A service-role key must never be bundled in the mobile client";
  }

  if (/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(normalizedKey)) return null;

  const jwtParts = normalizedKey.split(".");
  if (jwtParts.length === 3) {
    try {
      const base64 = jwtParts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const payload = JSON.parse(globalThis.atob(padded)) as { role?: unknown };
      if (payload.role === "service_role") {
        return "A service-role key must never be bundled in the mobile client";
      }
      if (payload.role === "anon") return null;
    } catch {
      // Invalid JWT-shaped values fall through to the generic key error.
    }
  }

  return "Supabase public key format is not recognized";
}

function productionConfigurationError(source: string): string | null {
  if (!source) return "EXPO_PUBLIC_HUNGRY_DATA_SOURCE is required in production";
  if (!SUPPORTED_DATA_SOURCES.has(source as HungryDataSource)) {
    return `Unsupported production data source: ${source}`;
  }
  if (source !== "supabase") {
    return "Production builds must use the Supabase data source";
  }
  return getSupabaseConfigurationError();
}

export function getConfiguredDataSource(): HungryDataSource {
  const publicSource = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE?.trim().toLowerCase();
  if (isProductionRuntime()) {
    const configurationError = productionConfigurationError(publicSource || "");
    if (configurationError) {
      throw new Error(`[Hungry production configuration] ${configurationError}`);
    }
    return "supabase";
  }
  if (configuredDataSourceOverride) {
    return configuredDataSourceOverride;
  }
  const e2eSource = process.env.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE?.trim().toLowerCase();
  const privateSource = process.env.HUNGRY_DATA_SOURCE?.trim().toLowerCase();
  const explicit = e2eSource || privateSource || publicSource || "";
  // If explicitly set, honour supported local and remote sources. Unknown values
  // stay on the safe mock fallback rather than connecting to Supabase implicitly.
  if (explicit === "supabase" || explicit === "excel" || explicit === "mock") return explicit;
  if (explicit) return "mock";
  // If not explicitly set but credentials are present, prefer supabase automatically.
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0 ? "supabase" : "mock";
}

export function setConfiguredDataSource(override?: HungryDataSource): void {
  configuredDataSourceOverride = override ?? null;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigurationError() === null;
}

export function getSupabaseClient(): SupabaseClient | null {
  installPkceCryptoPolyfill();
  if (isProductionRuntime()) {
    const configurationError = productionConfigurationError(
      process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE?.trim().toLowerCase() ?? "",
    );
    if (configurationError) {
      throw new Error(`[Hungry production configuration] ${configurationError}`);
    }
  }
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  if (!isSupabaseConfigured()) {
    cachedClient = null;
    return cachedClient;
  }

  const { createClient } =
    require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Persist auth tokens in a SecureStore-backed chunked adapter instead of
      // the default AsyncStorage (plaintext on disk). See `authStorage.ts` for
      // rationale and migration strategy. This is the primary MASVS-STORAGE
      // control for the mobile app.
      storage: supabaseAuthStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
  return cachedClient;
}
