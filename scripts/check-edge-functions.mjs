import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const functionsDir = path.join(repoRoot, "supabase", "functions");

const authGuards = [
  /auth\.getUser\(\)/,
  /ACCOUNT_DELETION_WORKER_TOKEN/,
  /TASTE_TAGGING_WORKER_TOKEN/,
  /NOTIFICATION_WORKER_TOKEN/,
  /ORPHAN_MEDIA_WORKER_TOKEN/,
  /REPORT_DIGEST_TOKEN/,
  /GUEST_SESSION_API_KEY/,
  /app_can_make_ops_request/,
];

const findings = [];

function addFinding(file, message) {
  findings.push(`${path.relative(repoRoot, file)}: ${message}`);
}

for (const entry of fs.readdirSync(functionsDir, { withFileTypes: true })) {
  // Folders starting with "_" hold shared modules, not deployable functions.
  if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
  const indexPath = path.join(functionsDir, entry.name, "index.ts");
  if (!fs.existsSync(indexPath)) {
    addFinding(indexPath, "missing index.ts");
    continue;
  }

  const source = fs.readFileSync(indexPath, "utf8");
  // serveWithSentry wraps Deno.serve and reports errors to Sentry; see _shared/sentry.ts.
  if (!/(Deno\.serve|serveWithSentry)\s*\(/.test(source)) {
    addFinding(indexPath, "missing Deno.serve or serveWithSentry handler");
  }

  if (/SUPABASE_SERVICE_ROLE_KEY/.test(source) && !authGuards.some((guard) => guard.test(source))) {
    addFinding(indexPath, "service-role function lacks an explicit auth guard");
  }

  if (/String\.fromCharCode\(\.\.\.imageBytes\)/.test(source)) {
    addFinding(indexPath, "uses unsafe unchunked image base64 conversion");
  }

  if (
    /Access-Control-Allow-Origin/.test(source) &&
    !/ALLOWED_ORIGINS|AllowedOrigins|allowedOrigins/.test(source)
  ) {
    addFinding(indexPath, "CORS origin is not allowlist-driven");
  }
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("Edge Function static checks passed.");
