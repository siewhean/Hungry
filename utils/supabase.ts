export { getSupabaseClient, isSupabaseConfigured } from "@/lib/services/supabase/client";

import { getSupabaseClient } from "@/lib/services/supabase/client";

// Backward-compatible export for older imports. New code should prefer
// getSupabaseClient() so missing configuration can be handled explicitly.
export const supabase = getSupabaseClient();
