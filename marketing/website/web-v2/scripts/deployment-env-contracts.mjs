const deployEnv =
  process.env.HUNGRY_DEPLOY_ENV?.trim().toLowerCase() ||
  process.env.VERCEL_ENV?.trim().toLowerCase() ||
  "";
const shouldRequireProof =
  process.env.HUNGRY_REQUIRE_DEPLOY_ENV_PROOF === "1" ||
  deployEnv === "production" ||
  deployEnv === "preview" ||
  deployEnv === "staging";
const failures = [];

function value(name) {
  return process.env[name]?.trim() || "";
}

function hasAny(names) {
  return names.some((name) => value(name).length > 0);
}

function publicSupabaseUrl() {
  return value("NEXT_PUBLIC_SUPABASE_URL") || value("EXPO_PUBLIC_SUPABASE_URL");
}

function publicSupabaseAnonKey() {
  return (
    value("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    value("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    value("EXPO_PUBLIC_SUPABASE_ANON_KEY") ||
    value("EXPO_PUBLIC_SUPABASE_KEY")
  );
}

function serviceRoleKey() {
  return value("SUPABASE_SERVICE_ROLE_KEY") || value("HUNGRY_SUPABASE_SERVICE_ROLE_KEY");
}

function consoleToken() {
  return value("HUNGRY_CONSOLE_API_TOKEN") || value("HUNGRY_CONSOLE_ADMIN_TOKEN");
}

function isLikelyWeakSecret(secret) {
  if (secret.length < 32) return true;
  return /^(local|test|dev|demo|changeme|password|secret|token|hungry)/i.test(secret);
}

function requireHttpsUrl(name, url, { allowLocalhost = false } = {}) {
  if (!url) {
    failures.push(`${name} is required.`);
    return;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    failures.push(`${name} must be a valid URL.`);
    return;
  }

  const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(allowLocalhost && isLocalhost)) {
    failures.push(`${name} must use https for staging/production.`);
  }
}

if (!shouldRequireProof) {
  console.log(
    "Deployment environment contracts skipped: set HUNGRY_REQUIRE_DEPLOY_ENV_PROOF=1, HUNGRY_DEPLOY_ENV=staging|production, or VERCEL_ENV=preview|production.",
  );
  process.exit(0);
}

if (process.env.HUNGRY_ALLOW_UNPROTECTED_CONSOLE_API === "1") {
  failures.push("HUNGRY_ALLOW_UNPROTECTED_CONSOLE_API must not be enabled for staging/production.");
}

requireHttpsUrl("NEXT_PUBLIC_SITE_URL", value("NEXT_PUBLIC_SITE_URL"));
requireHttpsUrl("Supabase URL", publicSupabaseUrl());

if (!publicSupabaseAnonKey()) {
  failures.push("A Supabase anon/publishable key is required for staging/production website forms.");
}

const token = consoleToken();
const hasStrongConsoleToken = token.length > 0 && !isLikelyWeakSecret(token);
const hasSupabaseAdminAuthPath = publicSupabaseUrl() && publicSupabaseAnonKey() && serviceRoleKey();

if (!hasStrongConsoleToken && !hasSupabaseAdminAuthPath) {
  failures.push(
    "Console access requires either a strong HUNGRY_CONSOLE_API_TOKEN/HUNGRY_CONSOLE_ADMIN_TOKEN or a configured Supabase admin bearer path.",
  );
}

if (token && isLikelyWeakSecret(token)) {
  failures.push("Console token is present but too short or appears to be a placeholder.");
}

if (hasAny(["SUPABASE_SERVICE_ROLE_KEY", "HUNGRY_SUPABASE_SERVICE_ROLE_KEY"]) && serviceRoleKey().length < 32) {
  failures.push("Supabase service role key is present but unexpectedly short.");
}

if (failures.length > 0) {
  console.error("Deployment environment contracts failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Deployment environment contracts passed.");
