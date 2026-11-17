#!/usr/bin/env node

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ||
  process.env.HUNGRY_SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const BASE_URL = "https://api.supabase.com/v1";

function fail(message, details) {
  console.error(`[supabase-enable-leaked-password-protection] ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

async function request(path, init = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let body = null;
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { response, body };
}

function summarizeError(body) {
  if (!body) return "";
  if (typeof body === "string") return body;
  return body.message || body.error || JSON.stringify(body);
}

if (!PROJECT_REF) {
  fail("SUPABASE_PROJECT_REF is required (the ref of the project to update).");
}

if (!TOKEN) {
  fail(
    "SUPABASE_ACCESS_TOKEN is required. Generate a Supabase personal access token with auth config write access, then rerun this command.",
  );
}

const current = await request(`/projects/${PROJECT_REF}/config/auth`);
if (!current.response.ok) {
  fail(
    `failed to read auth config for project ${PROJECT_REF} (${current.response.status})`,
    summarizeError(current.body),
  );
}

if (current.body?.password_hibp_enabled === true) {
  console.log(
    "[supabase-enable-leaked-password-protection] password_hibp_enabled is already true.",
  );
  process.exit(0);
}

const update = await request(`/projects/${PROJECT_REF}/config/auth`, {
  method: "PATCH",
  body: JSON.stringify({ password_hibp_enabled: true }),
});

if (!update.response.ok) {
  const detail = summarizeError(update.body);
  fail(
    `failed to enable password_hibp_enabled for project ${PROJECT_REF} (${update.response.status}). This usually means the token lacks auth_config_write/project_admin_write, or the project plan does not include leaked password protection.`,
    detail,
  );
}

const verify = await request(`/projects/${PROJECT_REF}/config/auth`);
if (!verify.response.ok) {
  fail(
    `updated auth config but failed to verify it (${verify.response.status})`,
    summarizeError(verify.body),
  );
}

if (verify.body?.password_hibp_enabled !== true) {
  fail("auth config update returned successfully, but password_hibp_enabled is still not true.");
}

console.log("[supabase-enable-leaked-password-protection] password_hibp_enabled is now true.");
