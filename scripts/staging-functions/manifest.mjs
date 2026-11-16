// What each Edge Function needs on the STAGING project, and how the staging smoke checks it.
// Single source for scripts/staging-functions.sh, scripts/smoke-staging-functions.mjs and the
// drift test (scripts/staging-functions/manifest.test.mjs). Holds names only, never secret values.
import fs from "node:fs";
import path from "node:path";

export const STAGING_REF = "uuylnktiipkmcweyqnpd";
export const PROD_REF = "frluxwpqqyomiqmjzavd";

// Set automatically by Supabase on every function; never set by hand.
export const PLATFORM_SECRETS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
];

// guard: how the function rejects a caller without credentials.
//   worker  - bearer worker token (tokenEnv); anonymous call must be 401
//   guest   - x-guest-session-key + allowed Origin; anonymous call is 403 (no Origin) or 401
//   user    - signed-in user JWT; anonymous (anon key only) call must be 401
//   origin  - ops-style function that checks Origin first; anonymous call is 401 or 403
//   webhook - Standard Webhooks signature; anonymous call is 401 (500 when its secrets are unset)
export const FUNCTIONS = [
  {
    name: "check-photo-safety",
    guard: "user",
    required: ["GOOGLE_CLOUD_VISION_API_KEY", "CHECK_PHOTO_SAFETY_ALLOWED_ORIGINS"],
  },
  {
    name: "guest-sessions",
    guard: "guest",
    tokenEnv: "GUEST_SESSION_API_KEY",
    required: ["GUEST_SESSION_API_KEY", "GUEST_SESSION_ALLOWED_ORIGINS"],
  },
  {
    name: "ingest-menu-photo",
    guard: "origin",
    required: ["GOOGLE_CLOUD_VISION_API_KEY", "GEMINI_API_KEY", "INGEST_MENU_PHOTO_ALLOWED_ORIGINS"],
  },
  { name: "mood-search", guard: "user", required: [] },
  {
    name: "ops-dishes-draft",
    guard: "origin",
    required: ["OPS_DISHES_DRAFT_ALLOWED_ORIGINS"],
  },
  {
    name: "process-account-deletions",
    guard: "worker",
    tokenEnv: "ACCOUNT_DELETION_WORKER_TOKEN",
    required: ["ACCOUNT_DELETION_WORKER_TOKEN"],
  },
  {
    name: "purge-orphan-media",
    guard: "worker",
    tokenEnv: "ORPHAN_MEDIA_WORKER_TOKEN",
    required: ["ORPHAN_MEDIA_WORKER_TOKEN"],
  },
  {
    name: "report-digest",
    guard: "worker",
    tokenEnv: "REPORT_DIGEST_TOKEN",
    required: ["REPORT_DIGEST_TOKEN", "RESEND_API_KEY", "RESEND_FROM"],
  },
  {
    // Staging auth mail does not go through this hook, so only the deploy and the signature
    // guard are checked; 500 (hook secrets unset) is accepted.
    name: "send-email",
    guard: "webhook",
    required: [],
    optional: ["RESEND_API_KEY", "RESEND_FROM", "SEND_EMAIL_HOOK_SECRET", "RESEND_TEMPLATE_SIGNIN_ID"],
  },
  {
    name: "send-notifications",
    guard: "worker",
    tokenEnv: "NOTIFICATION_WORKER_TOKEN",
    required: ["NOTIFICATION_WORKER_TOKEN"],
    optional: ["EXPO_ACCESS_TOKEN"],
  },
  {
    // tag-dishes calls the AI provider: GEMINI_API_KEY, or AI_PROVIDER=anthropic + ANTHROPIC_API_KEY.
    name: "tag-dishes",
    guard: "worker",
    tokenEnv: "TASTE_TAGGING_WORKER_TOKEN",
    required: ["TASTE_TAGGING_WORKER_TOKEN"],
  },
];

// Shared by every function: error tracking environment tag and the DSN.
export const SHARED_REQUIRED = ["APP_ENV"];
export const SHARED_OPTIONAL = ["SENTRY_DSN"];

export function requiredSecretNames() {
  return [...new Set([...SHARED_REQUIRED, ...FUNCTIONS.flatMap((fn) => fn.required)])].sort();
}

export function missingSecrets(presentNames) {
  const present = new Set(presentNames);
  return requiredSecretNames().filter((name) => !present.has(name));
}

/** Names of the deployable function folders (skips _shared). */
export function listRepoFunctions(functionsDir) {
  return fs
    .readdirSync(functionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();
}

/** Problems between the manifest and the repo; an empty list means they agree. */
export function manifestProblems(repoRoot) {
  const problems = [];
  const repo = listRepoFunctions(path.join(repoRoot, "supabase", "functions"));
  const listed = FUNCTIONS.map((fn) => fn.name).sort();
  for (const name of repo) {
    if (!listed.includes(name)) problems.push(`${name} is in supabase/functions but not in the staging manifest`);
  }
  for (const name of listed) {
    if (!repo.includes(name)) problems.push(`${name} is in the staging manifest but not in supabase/functions`);
  }

  // Every Deno.env.get name a function reads must be listed (required/optional) or be a platform name.
  const known = new Set([...PLATFORM_SECRETS, ...SHARED_REQUIRED, ...SHARED_OPTIONAL]);
  for (const fn of FUNCTIONS) {
    [...fn.required, ...(fn.optional ?? [])].forEach((name) => known.add(name));
  }
  const dirs = [path.join(repoRoot, "supabase", "functions", "_shared")];
  for (const name of repo) dirs.push(path.join(repoRoot, "supabase", "functions", name));
  const unlisted = new Set();
  for (const dir of dirs) {
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      const source = fs.readFileSync(path.join(dir, file), "utf8");
      for (const match of source.matchAll(/Deno\.env\.get\(\s*"([A-Z0-9_]+)"/g)) {
        if (!known.has(match[1]) && !EXTRA_KNOWN.has(match[1])) unlisted.add(`${match[1]} (${path.basename(dir)}/${file})`);
      }
    }
  }
  for (const entry of [...unlisted].sort()) problems.push(`secret ${entry} is read by a function but not in the manifest`);

  // verify_jwt in config.toml must match the guard: only worker/guest/webhook functions skip JWT.
  const config = fs.readFileSync(path.join(repoRoot, "supabase", "config.toml"), "utf8");
  for (const fn of FUNCTIONS) {
    const block = config.match(new RegExp(`\\[functions\\.${fn.name}\\]([^\\[]*)`));
    const skipsJwt = block ? /verify_jwt\s*=\s*false/.test(block[1]) : false;
    const shouldSkip = ["worker", "guest", "webhook"].includes(fn.guard);
    if (skipsJwt !== shouldSkip) {
      problems.push(`${fn.name}: config.toml verify_jwt does not match its ${fn.guard} guard`);
    }
  }
  return problems;
}

// Names read through helpers that take them as arguments (AI provider selection), kept optional.
const EXTRA_KNOWN = new Set(["AI_PROVIDER", "AI_MODEL", "ANTHROPIC_API_KEY", "ANTHROPIC_WORKSPACE_ID", "GEMINI_API_KEY", "MERCHANT_ALERTS_ENABLED", "REPORT_DIGEST_TO", "SB_EXECUTION_ID", "SB_REGION"]);
