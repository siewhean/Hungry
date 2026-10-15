#!/usr/bin/env node

// Retired: this script toggled password_hibp_enabled through the Supabase Cloud Management API
// (api.supabase.com/v1/projects/<ref>/config/auth). Hungry now runs on self-hosted Supabase,
// which has no Management API, so there is nothing for this script to call.
console.error(
  [
    "[supabase-enable-leaked-password-protection] retired: this targets Supabase Cloud only (Management API).",
    "Self-hosted equivalent: set GOTRUE_PASSWORD_HIBP_ENABLED=true for the auth (GoTrue) service in the",
    "self-hosted Supabase docker .env / docker-compose.yml, then restart the auth container.",
  ].join("\n"),
);
process.exit(1);
