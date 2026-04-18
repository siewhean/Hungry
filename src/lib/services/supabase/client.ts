import type { SupabaseClient } from "@supabase/supabase-js";

export type HungryDataSource = "mock" | "supabase";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

let cachedClient: SupabaseClient | null | undefined;

export function getConfiguredDataSource(): HungryDataSource {
  const privateSource = process.env.HUNGRY_DATA_SOURCE?.trim().toLowerCase();
  const publicSource = process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE?.trim().toLowerCase();
  const raw = privateSource || publicSource || "mock";
  return raw === "supabase" ? "supabase" : "mock";
}

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  if (!isSupabaseConfigured()) {
    cachedClient = null;
    return cachedClient;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } =
    require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return cachedClient;
}
