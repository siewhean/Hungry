import { createClient } from "@supabase/supabase-js";

if (process.env.HUNGRY_ALLOW_SERVICE_ROLE_SMOKE !== "1") {
  throw new Error("Refusing service-role smoke without HUNGRY_ALLOW_SERVICE_ROLE_SMOKE=1.");
}

const SUPABASE_URL = process.env.HUNGRY_SMOKE_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.HUNGRY_SMOKE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Set HUNGRY_SMOKE_SUPABASE_URL and HUNGRY_SMOKE_SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
});

async function run() {
  const { data, error } = await supabase.rpc("exec_sql", {
    sql: "SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'dishes';",
  });
  console.log(data, error);
}

void run();
