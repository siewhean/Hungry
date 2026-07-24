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
const release = result.rows?.[0];
if (
  result.rows?.[0]?.status !== "active" ||
  (Array.isArray(release?.quality_findings) && release.quality_findings.length)
) {
  process.stderr.write(
    `Catalog release was not activated; investigate the quality findings: ${JSON.stringify(release?.quality_findings ?? [])}\n`,
  );
  process.exitCode = 1;
}
