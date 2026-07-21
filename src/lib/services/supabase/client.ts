import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAuthStorage } from "./authStorage";
import { installPkceCryptoPolyfill } from "./pkceCryptoPolyfill";

export type HungryDataSource = "mock" | "supabase" | "excel";
export type HungryAppEnvironment = "development" | "staging" | "production";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const SUPABASE_ANON_KEY =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim()) ??
  "";
let configuredDataSourceOverride: HungryDataSource | null = null;
let cachedClient: SupabaseClient | null | undefined;

export function getAppEnvironment(): HungryAppEnvironment {
  const explicit = process.env.EXPO_PUBLIC_APP_ENV?.trim().toLowerCase();
  if (explicit === "staging" || explicit === "production" || explicit === "development") {
    return explicit;
  }
  // EAS profiles set EXPO_PUBLIC_APP_ENV explicitly. Treat unspecified Node,
  // test, and local processes as development so test fixtures remain usable.
  return "development";
}

export function isReleasedBuild(): boolean {
  const environment = getAppEnvironment();
  return environment === "staging" || environment === "production";
}

/**
 * Released builds require Supabase for authentication and every shared write.
 * The bundled Excel catalog is an authenticated, read-only outage fallback; it
 * must never compensate for missing release configuration.
 */
export function getReleasedSupabaseConfigurationError(): string | null {
  if (!isReleasedBuild() || isSupabaseConfigured()) return null;
  return "This Hungry build is missing its secure account-service configuration.";
}

export function getConfiguredDataSource(): HungryDataSource {
  if (isReleasedBuild()) return "supabase";
  if (configuredDataSourceOverride) return configuredDataSourceOverride;

  const e2eSource = process.env.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE?.trim().toLowerCase();
  const privateSource = process.env.HUNGRY_DATA_SOURCE?.trim().toLowerCase();
  const publicSource = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE?.trim().toLowerCase();
  const explicit = e2eSource || privateSource || publicSource;
  if (explicit === "supabase" || explicit === "excel" || explicit === "mock") return explicit;

  return isSupabaseConfigured() ? "supabase" : "excel";
}

export function setConfiguredDataSource(override?: HungryDataSource): void {
  configuredDataSourceOverride = override ?? null;
}

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

export function getSupabaseClient(): SupabaseClient | null {
  installPkceCryptoPolyfill();
  if (cachedClient !== undefined) return cachedClient;
  if (!isSupabaseConfigured()) {
    cachedClient = null;
    return cachedClient;
  }
  const { createClient } =
    require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: supabaseAuthStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
  return cachedClient;
}
