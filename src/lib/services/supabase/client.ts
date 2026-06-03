import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAuthStorage } from "./authStorage";
import { installPkceCryptoPolyfill } from "./pkceCryptoPolyfill";

export type HungryDataSource = "mock" | "supabase";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
// Accept both the canonical ANON_KEY name and the newer publishable KEY alias
const SUPABASE_ANON_KEY =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim()) ??
  "";
let configuredDataSourceOverride: HungryDataSource | null = null;

let cachedClient: SupabaseClient | null | undefined;

export function getConfiguredDataSource(): HungryDataSource {
  if (configuredDataSourceOverride) {
    return configuredDataSourceOverride;
  }
  const privateSource = process.env.HUNGRY_DATA_SOURCE?.trim().toLowerCase();
  const publicSource = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE?.trim().toLowerCase();
  const explicit = privateSource || publicSource;
  // If explicitly set, honour it (allows forcing mock even when credentials exist).
  if (explicit) return explicit === "supabase" ? "supabase" : "mock";
  // If not explicitly set but credentials are present, prefer supabase automatically.
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0 ? "supabase" : "mock";
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
