import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const repoRoot = resolve(root, "../../..");
const failures = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function readRepo(path) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function requireFile(path, message) {
  if (!existsSync(join(root, path))) {
    failures.push(`${message}: ${path} is missing`);
  }
}

function requireMarker(source, marker, file, message) {
  if (!source.includes(marker)) {
    failures.push(`${message}: ${file} is missing ${marker}`);
  }
}

function requireMatch(source, pattern, file, message) {
  if (!pattern.test(source)) {
    failures.push(`${message}: ${file} does not match ${pattern}`);
  }
}

function rejectMatch(source, pattern, file, message) {
  if (pattern.test(source)) {
    failures.push(`${message}: ${file} unexpectedly matches ${pattern}`);
  }
}

const publicLegalPages = [
  "src/app/privacy/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/account/delete/page.tsx",
  "src/app/contact/page.tsx",
];

for (const page of publicLegalPages) {
  requireFile(page, "Public legal/support route contract failed");
}

const privacy = read("src/app/privacy/page.tsx");
const terms = read("src/app/terms/page.tsx");
const accountDelete = read("src/app/account/delete/page.tsx");
const contact = read("src/app/contact/page.tsx");
const seo = read("src/app/seo.ts");
const rootPackage = readRepo("package.json");
const appConfig = readRepo("app.json");
const supabaseConfig = readRepo("supabase/config.toml");
const accountDeletionWorker = readRepo("supabase/functions/process-account-deletions/index.ts");
const accountDeletionMigration = readRepo(
  "supabase/migrations/0040_release_hardening_account_deletion_merchant_rpcs.sql",
);
const ocrWorker = readRepo("supabase/functions/ingest-menu-photo/index.ts");
const posthogSink = readRepo("src/lib/analytics/posthogSink.ts");
const sentryPrivacy = readRepo("src/lib/analytics/privacy.ts");

for (const [file, source] of [
  ["privacy/page.tsx", privacy],
  ["terms/page.tsx", terms],
  ["account/delete/page.tsx", accountDelete],
]) {
  requireMarker(source, "routeMetadata(", file, "Legal page metadata contract failed");
  requireMarker(source, "usehungrysingapore@gmail.com", file, "Legal support email contract failed");
}

for (const [file, source] of [
  ["privacy/page.tsx", privacy],
  ["terms/page.tsx", terms],
]) {
  requireMarker(source, "privacy contact (Data Protection Officer)", file, "Named privacy contact contract failed");
  rejectMatch(source, /hungry\.sg|support@usehungry\.com/, file, "Legal page contact domain contract failed");
}

requireMarker(contact, "routeMetadata(", "contact/page.tsx", "Legal page metadata contract failed");
requireMarker(contact, "siteConfig.contactEmail", "contact/page.tsx", "Legal support email contract failed");

requireMarker(seo, 'contactEmail: "usehungrysingapore@gmail.com"', "seo.ts", "Canonical support email contract failed");
requireMarker(contact, "mailto:${siteConfig.contactEmail}", "contact/page.tsx", "Contact email source-of-truth contract failed");
requireMarker(contact, "/account/delete", "contact/page.tsx", "Contact deletion fallback contract failed");

requireMarker(privacy, "Supabase", "privacy/page.tsx", "Privacy provider disclosure contract failed");
requireMarker(privacy, "PostHog for analytics where configured", "privacy/page.tsx", "PostHog conditional disclosure contract failed");
requireMarker(privacy, "Sentry for crash diagnostics where configured", "privacy/page.tsx", "Sentry conditional disclosure contract failed");
requireMarker(privacy, "Google services for maps, places, OCR, or AI-assisted extraction where enabled", "privacy/page.tsx", "Google conditional disclosure contract failed");
requireMarker(privacy, "Precise latitude and longitude are not sent as PostHog identity properties by default", "privacy/page.tsx", "Precise coordinate analytics disclosure contract failed");
requireMarker(privacy, "Deletion is scheduled 30 days after the request", "privacy/page.tsx", "Account deletion queue disclosure contract failed");
requireMarker(privacy, "Personal Data Protection Act", "privacy/page.tsx", "Singapore privacy disclosure contract failed");
requireMarker(privacy, "Anthropic", "privacy/page.tsx", "Third-party AI provider disclosure contract failed (App Store 5.1.2)");
requireMarker(privacy, "Google Cloud Vision", "privacy/page.tsx", "Third-party AI provider disclosure contract failed (App Store 5.1.2)");
requireMarker(privacy, "Google Gemini", "privacy/page.tsx", "Third-party AI provider disclosure contract failed (App Store 5.1.2)");
requireMarker(privacy, "Resend", "privacy/page.tsx", "Email provider disclosure contract failed");
requireMarker(privacy, "Mapbox", "privacy/page.tsx", "Map provider disclosure contract failed");
requireMarker(privacy, "within 24 hours", "privacy/page.tsx", "Report response time disclosure contract failed (App Store 1.2)");
requireMarker(terms, "no tolerance for objectionable content", "terms/page.tsx", "UGC zero-tolerance terms contract failed (App Store 1.2)");
requireMarker(terms, "within 24 hours", "terms/page.tsx", "Report response time terms contract failed (App Store 1.2)");

requireMarker(terms, "User-Generated Content", "terms/page.tsx", "UGC terms contract failed");
requireMarker(terms, "AI, OCR, And Recommendations", "terms/page.tsx", "AI/OCR terms contract failed");
requireMarker(terms, "Account Deletion", "terms/page.tsx", "Account deletion terms contract failed");
requireMarker(terms, "Merchant And Menu Information", "terms/page.tsx", "Merchant terms contract failed");

requireMarker(accountDelete, "Signed-in users can request deletion", "account/delete/page.tsx", "Deletion support page contract failed");
requireMarker(accountDelete, "30-day grace period", "account/delete/page.tsx", "Deletion timeline contract failed");
rejectMatch(accountDelete, /instant|immediate|guaranteed/i, "account/delete/page.tsx", "Deletion page must not overpromise timing");

requireMarker(rootPackage, '"@sentry/react-native"', "package.json", "Sentry dependency evidence missing");
requireMarker(rootPackage, '"posthog-react-native"', "package.json", "PostHog dependency evidence missing");
requireMarker(appConfig, "@sentry/react-native/expo", "app.json", "Sentry Expo plugin evidence missing");
requireMarker(posthogSink, "POSTHOG_API_KEY", "posthogSink.ts", "PostHog configured-only evidence missing");
requireMarker(sentryPrivacy, "sanitizeSentryEvent", "privacy.ts", "Sentry sanitizer evidence missing");
requireMarker(sentryPrivacy, "sanitizeSentryBreadcrumb", "privacy.ts", "Sentry breadcrumb sanitizer evidence missing");

requireMarker(supabaseConfig, "[functions.process-account-deletions]", "supabase/config.toml", "Account deletion function config missing");
requireMarker(accountDeletionWorker, "claim_account_deletion_requests", "process-account-deletions/index.ts", "Account deletion worker claim evidence missing");
requireMarker(accountDeletionWorker, "anonymize_account_deletion_request", "process-account-deletions/index.ts", "Account deletion worker anonymization evidence missing");
requireMarker(accountDeletionWorker, "complete_account_deletion_request", "process-account-deletions/index.ts", "Account deletion worker completion evidence missing");
requireMarker(accountDeletionMigration, "account_deletion_requests", "0040_release_hardening_account_deletion_merchant_rpcs.sql", "Account deletion table evidence missing");
requireMarker(accountDeletionMigration, "account_deletion_processing_events", "0040_release_hardening_account_deletion_merchant_rpcs.sql", "Account deletion audit evidence missing");

requireMarker(ocrWorker, "Google Vision API key", "ingest-menu-photo/index.ts", "Google OCR evidence missing");
requireMarker(ocrWorker, "ALLOWED_OCR_IMAGE_TYPES", "ingest-menu-photo/index.ts", "OCR upload validation evidence missing");
requireMatch(privacy, /where configured|where enabled/g, "privacy/page.tsx", "Conditional provider wording contract failed");

if (failures.length > 0) {
  console.error("Legal readiness contracts failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Legal readiness contracts passed.");
