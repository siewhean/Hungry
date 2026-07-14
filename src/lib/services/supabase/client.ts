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

export function getConfiguredDataSource(): HungryDataSource {
  const appEnvironment = process.env.EXPO_PUBLIC_APP_ENV?.trim().toLowerCase();
  const isReleasedBuild = appEnvironment === "staging" || appEnvironment === "production";
  if (isReleasedBuild) return "supabase";
  if (configuredDataSourceOverride) {
    return configuredDataSourceOverride;
  }
  const e2eSource = process.env.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE?.trim().toLowerCase();
  const privateSource = process.env.HUNGRY_DATA_SOURCE?.trim().toLowerCase();
  const publicSource = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE?.trim().toLowerCase();
  const explicit = e2eSource || privateSource || publicSource;
  // Consumer builds are Supabase-only. Test/developer overrides remain explicit
  // so fixture data can never appear because configuration was absent or invalid.
  if (explicit === "supabase" || explicit === "excel" || explicit === "mock") return explicit;
  return "supabase";
}

export function setConfiguredDataSource(override?: HungryDataSource): void {
  configuredDataSourceOverride = override ?? null;
}

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

export function getSupabaseClient(): SupabaseClient | null {
  installPkceCryptoPolyfill();
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
