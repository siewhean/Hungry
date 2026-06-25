import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const functionsDir = path.join(repoRoot, "supabase", "functions");

const authGuards = [
  /auth\.getUser\(\)/,
  /ACCOUNT_DELETION_WORKER_TOKEN/,
  /GUEST_SESSION_API_KEY/,
  /app_can_make_ops_request/,
];

const findings = [];

function addFinding(file, message) {
  findings.push(`${path.relative(repoRoot, file)}: ${message}`);
}

for (const entry of fs.readdirSync(functionsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const indexPath = path.join(functionsDir, entry.name, "index.ts");
  if (!fs.existsSync(indexPath)) {
    addFinding(indexPath, "missing index.ts");
    continue;
  }

  const source = fs.readFileSync(indexPath, "utf8");
  if (/\/\/\s*@ts-nocheck/.test(source)) {
    addFinding(indexPath, "must not disable TypeScript checking with @ts-nocheck");
  }

  if (!/Deno\.serve\s*\(/.test(source)) {
    addFinding(indexPath, "missing Deno.serve handler");
  }

  if (/SUPABASE_SERVICE_ROLE_KEY/.test(source) && !authGuards.some((guard) => guard.test(source))) {
    addFinding(indexPath, "service-role function lacks an explicit auth guard");
  }

  if (/String\.fromCharCode\(\.\.\.imageBytes\)/.test(source)) {
    addFinding(indexPath, "uses unsafe unchunked image base64 conversion");
  }

  if (/Access-Control-Allow-Origin/.test(source) && !/ALLOWED_ORIGINS|AllowedOrigins|allowedOrigins/.test(source)) {
    addFinding(indexPath, "CORS origin is not allowlist-driven");
  }
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("Edge Function static checks passed.");
