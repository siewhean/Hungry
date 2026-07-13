import { execFileSync } from "node:child_process";

const output = execFileSync(
  "npx",
  [
    "--no-install",
    "supabase",
    "db",
    "query",
    "--linked",
    "--file",
    "supabase/publish/catalog_raw_release.sql",
    "--output",
    "json",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);

process.stdout.write(output);

const result = JSON.parse(output);
if (result.rows?.[0]?.status !== "active") {
  process.stderr.write("Catalog release was not activated; investigate the reported release status.\n");
  process.exitCode = 1;
}
