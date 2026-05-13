import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envVars: Record<string, string> = {};
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf-8");
  content.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      envVars[match[1]] = match[2].replace(/^["'](.*)["']$/, "$1").trim();
    }
  });
}

const SUPABASE_URL = envVars["EXPO_PUBLIC_SUPABASE_URL"];
const SUPABASE_ANON_KEY = envVars["EXPO_PUBLIC_SUPABASE_KEY"];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data } = await supabase
    .from("dishes")
    .select("id, name, image_url")
    .eq("id", "dish-chicken-rice");
  console.log("dishes", data);
}

run();
