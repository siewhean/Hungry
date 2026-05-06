import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envLocalPath = path.resolve(process.cwd(), ".env.local");
let content = "";
if (fs.existsSync(envLocalPath)) {
  content = fs.readFileSync(envLocalPath, "utf-8");
}
const envVars: Record<string, string> = {};
content.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2].replace(/^["'](.*)["']$/, "$1").trim();
  }
});

const SUPABASE_URL = envVars["EXPO_PUBLIC_SUPABASE_URL"];
const SUPABASE_SERVICE_ROLE_KEY = envVars["SUPABASE_SERVICE_ROLE_KEY"];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function run() {
  const { data, error } = await supabase.from("dishes").select("id").limit(1);
  console.log("data:", data, "error:", error);
}

run();
