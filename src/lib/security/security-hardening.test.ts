import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  clearTrackedAnalyticsEvents,
  setAnalyticsSink,
  trackAnalyticsEvent,
} from "@/lib/analytics";
import {
  sanitizeAnalyticsProperties,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from "@/lib/analytics/privacy";
import { __internal as authStorageInternal } from "@/lib/services/supabase/authStorage";
import {
  assertValidMenuPhotoUpload,
  uploadImageFromUri,
} from "@/lib/services/supabase/mediaUpload";

function readRepoFile(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("analytics privacy scrubber redacts PII and rounds coordinates", () => {
  const sanitized = sanitizeAnalyticsProperties({
    email: "wei@example.com",
    phoneNumber: "+65 9123 4567",
    callbackUrl: "https://hungry.sg/reset?token=abc&email=wei@example.com",
    latitude: 1.23456,
    longitude: 103.98765,
  });

  assert.equal(sanitized.email, "[redacted]");
  assert.equal(sanitized.phoneNumber, "[redacted]");
  assert.equal(sanitized.callbackUrl, "https://hungry.sg/reset?[redacted]=[redacted]");
  assert.equal(sanitized.latitude, 1.235);
  assert.equal(sanitized.longitude, 103.988);
});

test("analytics tracking sanitizes before buffering or sink dispatch", () => {
  const seen: unknown[] = [];
  setAnalyticsSink((event) => seen.push(event));
  clearTrackedAnalyticsEvents();

  const record = trackAnalyticsEvent("security_probe", {
    email: "wei@example.com",
    callbackUrl: "https://hungry.sg/callback?token=abc&email=wei@example.com",
    latitude: 1.23456,
  });

  setAnalyticsSink(null);
  assert.equal(record.properties.email, "[redacted]");
  assert.equal(record.properties.callbackUrl, "https://hungry.sg/callback?[redacted]=[redacted]");
  assert.equal(record.properties.latitude, 1.235);
  assert.deepEqual(seen, [record]);
});

test("Sentry event and breadcrumb sanitizers scrub exception, request, and breadcrumb payloads", () => {
  const event = sanitizeSentryEvent({
    user: { email: "wei@example.com", id: "user-1" },
    request: { url: "https://hungry.sg/reset?token=abc&email=wei@example.com" },
    exception: { values: [{ value: "token=abc failed for wei@example.com" }] },
    breadcrumbs: [
      {
        message: "called +65 9123 4567",
        data: { authorization: "Bearer abc", url: "https://hungry.sg?a=b" },
      },
    ],
  });

  assert.equal(event.user?.email, undefined);
  assert.equal(event.request?.url, "https://hungry.sg/reset?[redacted]=[redacted]");
  assert.equal(event.exception?.values?.[0]?.value, "token=[redacted] failed for [redacted-email]");
  assert.equal(event.breadcrumbs?.[0]?.message, "called [redacted-phone]");
  assert.equal(event.breadcrumbs?.[0]?.data?.authorization, "[redacted]");

  const breadcrumb = sanitizeSentryBreadcrumb({
    message: "refresh_token=abc for wei@example.com",
    data: { phone: "+65 9123 4567" },
  });
  assert.equal(breadcrumb.message, "refresh_token=[redacted] for [redacted-email]");
  assert.equal(breadcrumb.data.phone, "[redacted]");
});

test("auth token storage allows plaintext fallback only behind explicit guard", () => {
  const previous = process.env.HUNGRY_ALLOW_INSECURE_AUTH_STORAGE;
  delete process.env.HUNGRY_ALLOW_INSECURE_AUTH_STORAGE;
  assert.equal(authStorageInternal.canUsePlaintextTokenFallback(), false);

  process.env.HUNGRY_ALLOW_INSECURE_AUTH_STORAGE = "1";
  assert.equal(authStorageInternal.canUsePlaintextTokenFallback(), true);
  if (previous === undefined) {
    delete process.env.HUNGRY_ALLOW_INSECURE_AUTH_STORAGE;
  } else {
    process.env.HUNGRY_ALLOW_INSECURE_AUTH_STORAGE = previous;
  }
});

test("media upload validation rejects unsafe MIME and signed URL failure", async () => {
  assert.throws(
    () => assertValidMenuPhotoUpload({ mimeType: "image/webp", fileSizeBytes: 1024 }),
    /image\/jpeg/,
  );

  const previousFetch = globalThis.fetch;
  const validPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  globalThis.fetch = async () =>
    new Response(new Blob([validPng], { type: "image/png" }), {
      status: 200,
    });

  const client = {
    storage: {
      from: () => ({
        createSignedUploadUrl: async () => ({ data: null, error: new Error("no token") }),
        getPublicUrl: () => ({ data: { publicUrl: "https://example.test/image.png" } }),
      }),
    },
  };

  await assert.rejects(
    () =>
      uploadImageFromUri({
        client: client as never,
        bucket: "review-media",
        path: "user-id/review/photo.png",
        uri: "file:///tmp/photo.png",
      }),
    /Signed upload URL/,
  );
  globalThis.fetch = previousFetch;
});

test("media upload validation rejects MIME spoofing before signed upload", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(new Blob(["not-a-png"], { type: "image/png" }), {
      status: 200,
    });

  const client = {
    storage: {
      from: () => ({
        createSignedUploadUrl: async () => ({
          data: { signedUrl: "token", path: "p" },
          error: null,
        }),
        uploadToSignedUrl: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://example.test/image.png" } }),
      }),
    },
  };

  await assert.rejects(
    () =>
      uploadImageFromUri({
        client: client as never,
        bucket: "review-media",
        path: "user-id/review/photo.png",
        uri: "file:///tmp/photo.png",
      }),
    /does not match its declared type/,
  );
  globalThis.fetch = previousFetch;
});

test("safe linking routes delivery and article opens through allowlisted helpers", () => {
  const source = readRepoFile("src/lib/security/safeLinking.ts");
  const deliveryButton = readRepoFile("src/components/dish/DeliveryPlatformButton.tsx");
  const articleScreen = readRepoFile("src/app/screens/reads/BlogPostWebViewScreen.tsx");

  assert.match(source, /ALLOWED_DELIVERY_SCHEMES/);
  assert.match(source, /ALLOWED_BLOG_HOSTS/);
  assert.doesNotMatch(deliveryButton, /Linking\.openURL/);
  assert.match(deliveryButton, /openTrustedDeliveryUrl/);
  assert.doesNotMatch(articleScreen, /openBrowserAsync/);
  assert.match(articleScreen, /openTrustedBlogUrl/);
});

test("ingest-menu-photo requires auth and verifies submission ownership", () => {
  const source = readRepoFile("supabase/functions/ingest-menu-photo/index.ts");

  assert.match(source, /function bytesToBase64\(bytes: Uint8Array\)/);
  assert.match(source, /bytesToBase64\(imageBytes\)/);
  assert.doesNotMatch(source, /btoa\(String\.fromCharCode\(\.\.\.imageBytes\)\)/);
  assert.match(source, /SUPABASE_ANON_KEY/);
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /submitted_by/);
  assert.match(source, /forbidden_submission/);
  assert.match(source, /app_can_make_user_request/);
  assert.match(source, /rate_limited/);
  assert.match(source, /\.in\("ocr_status", \["pending", "failed"\]\)/);
  assert.match(source, /INGEST_MENU_PHOTO_ALLOWED_ORIGINS/);
  assert.doesNotMatch(source, /"Access-Control-Allow-Origin": "\*"/);
});

test("app security hardening migration restricts ops RPCs and verification evidence metadata", () => {
  const migration = readRepoFile("supabase/migrations/0038_app_security_hardening.sql");
  const opsFunction = readRepoFile("supabase/functions/ops-dishes-draft/index.ts");
  const service = readRepoFile("src/lib/services/supabase/supabaseService.ts");

  assert.match(migration, /app_ops_admins/);
  assert.match(migration, /app_ops_audit_events/);
  assert.match(migration, /app_ops_rate_limits/);
  assert.match(migration, /revoke all on function public\.app_can_make_ops_request/);
  assert.match(
    migration,
    /grant execute on function public\.app_can_make_ops_request[\s\S]*to service_role/,
  );
  assert.match(migration, /enforce_merchant_verification_evidence_guard/);
  assert.match(migration, /new\.uploaded_by is distinct from auth\.uid\(\)/);
  assert.match(migration, /supabase:\/\/merchant-verification-evidence/);
  assert.match(migration, /create or replace view public\.public_profiles/);
  assert.match(migration, /where public\.can_read_author_content\(up\.id\)/);
  assert.match(migration, /grant select on public\.public_profiles to anon, authenticated/);
  assert.doesNotMatch(migration, /up\.email/);
  assert.match(opsFunction, /auth\.getUser\(\)/);
  assert.match(opsFunction, /app_can_make_ops_request/);
  assert.doesNotMatch(opsFunction, /x-ops-api-key/);
  assert.doesNotMatch(service, /EXPO_PUBLIC_OPS_DISHES_DRAFT_API_KEY/);
  assert.match(service, /from\("public_profiles"\)/);
});

test("OAuth flow validates callback URL and rejects implicit token fragments", () => {
  const service = readRepoFile("src/lib/services/supabase/supabaseService.ts");

  assert.match(service, /callbackBaseMatches/);
  assert.match(service, /OAuth callback URL was not trusted/);
  assert.match(service, /OAuth callback state did not match/);
  assert.match(service, /OAuth callback token fragments are not accepted/);
  assert.match(service, /exchangeCodeForSession\(code\)/);
  assert.doesNotMatch(service, /setSession\(\{\s*access_token/);
});

test("store policy controls cover account deletion, UGC moderation, and location disclosure", () => {
  const migration = readRepoFile("supabase/migrations/0017_store_policy_safety_controls.sql");
  const hardening = readRepoFile(
    "supabase/migrations/0040_release_hardening_account_deletion_merchant_rpcs.sql",
  );
  const worker = readRepoFile("supabase/functions/process-account-deletions/index.ts");
  const serviceTypes = readRepoFile("src/lib/services/types.ts");
  const supabaseService = readRepoFile("src/lib/services/supabase/supabaseService.ts");
  const safetyHelper = readRepoFile("src/lib/security/communitySafety.ts");
  const settingsScreen = readRepoFile("src/app/screens/profile/SettingsScreen.tsx");
  const webV2Footer = readRepoFile("marketing/website/web-v2/src/content/site.ts");
  const webFooter = readRepoFile("marketing/web/app/_components/footerData.ts");
  const webV2DeletePage = readRepoFile("marketing/website/web-v2/src/app/account/delete/page.tsx");
  const webDeletePage = readRepoFile("marketing/web/app/account/delete/page.tsx");
  const locationScreen = readRepoFile("src/app/screens/onboarding/LocationPermissionScreen.tsx");
  const appConfig = readRepoFile("app.json");

  assert.match(migration, /account_deletion_requests/);
  assert.match(migration, /content_reports/);
  assert.match(migration, /user_blocks/);
  assert.match(migration, /enable row level security/);
  assert.match(serviceTypes, /communitySafety/);
  assert.match(supabaseService, /account_deletion_requests/);
  assert.match(supabaseService, /content_reports/);
  assert.match(supabaseService, /user_blocks/);
  assert.match(safetyHelper, /promptReportReview/);
  assert.match(safetyHelper, /promptBlockReviewAuthor/);
  assert.match(
    locationScreen,
    /Hungry collects your approximate device location only while you use the app/,
  );
  assert.match(hardening, /account_deletion_processing_events/);
  assert.match(hardening, /claim_account_deletion_requests/);
  assert.match(hardening, /anonymize_account_deletion_request/);
  assert.match(hardening, /complete_account_deletion_request/);
  assert.match(hardening, /legal_hold boolean not null default false/);
  assert.match(hardening, /preserved_tables/);
  assert.match(hardening, /content_reports/);
  assert.match(hardening, /post_reports/);
  assert.match(hardening, /moderation_actions/);
  assert.match(hardening, /app_ops_audit_events/);
  assert.match(hardening, /revoke all on function public\.anonymize_account_deletion_request/);
  assert.match(
    hardening,
    /grant execute on function public\.anonymize_account_deletion_request[\s\S]*to service_role/,
  );
  assert.match(worker, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(worker, /ACCOUNT_DELETION_WORKER_TOKEN/);
  assert.match(worker, /claim_account_deletion_requests/);
  assert.match(worker, /anonymize_account_deletion_request/);
  assert.match(worker, /auth\.admin\.deleteUser/);
  assert.match(worker, /complete_account_deletion_request/);
  assert.match(settingsScreen, /getHungryService\(\)\.auth\.requestAccountDeletion/);
  assert.match(settingsScreen, /https:\/\/hungry\.sg\/account\/delete/);
  assert.match(webV2Footer, /Account Deletion/);
  assert.match(webFooter, /Account Deletion/);
  assert.match(webV2DeletePage, /Delete your Hungry account/);
  assert.match(webDeletePage, /Delete your Hungry account/);
  assert.doesNotMatch(appConfig, /NSLocalNetworkUsageDescription/);
  assert.doesNotMatch(appConfig, /NSBonjourServices/);
});

test("password reset uses redirect URL and supports recovery code exchange", () => {
  const supabaseService = readRepoFile("src/lib/services/supabase/supabaseService.ts");
  const resetScreen = readRepoFile("src/app/screens/auth/ResetPasswordScreen.tsx");
  const forgotScreen = readRepoFile("src/app/screens/auth/ForgotPasswordScreen.tsx");
  const linking = readRepoFile("src/app/navigation/linking.ts");

  assert.match(supabaseService, /resetPasswordForEmail\(email,\s*\{/);
  assert.match(supabaseService, /redirectTo: getAuthEmailRedirectTo\(\)/);
  assert.match(supabaseService, /exchangeRecoveryCodeIfPresent/);
  assert.match(supabaseService, /Password recovery callback URL was not trusted/);
  assert.match(supabaseService, /Password recovery token fragments are not accepted/);
  assert.match(supabaseService, /exchangeCodeForSession\(code\)/);
  assert.match(resetScreen, /route\.params\?\.code \?\? ""/);
  assert.match(forgotScreen, /navigation\.navigate\("Login"\)/);
  assert.match(linking, /ResetPassword: "auth\/callback"/);
});

test("UGC surfaces expose report, hide, and block safety actions", () => {
  const helper = readRepoFile("src/lib/security/communitySafety.ts");
  const home = readRepoFile("src/app/screens/home/HomeFeedScreen.tsx");
  const activity = readRepoFile("src/app/screens/home/ActivityPostDetailScreen.tsx");
  const socialPost = readRepoFile("src/app/screens/profile/SocialPostDetailScreen.tsx");
  const comments = readRepoFile("src/components/social/ReviewCommentsSheet.tsx");

  assert.match(helper, /promptPostSafetyActions/);
  assert.match(helper, /promptCommentSafetyActions/);
  assert.match(helper, /communitySafety\.reportContent/);
  assert.match(helper, /communitySafety\.blockUser/);
  assert.match(helper, /communitySafety\.hidePost/);
  assert.match(home, /promptPostSafetyActions/);
  assert.match(home, /promptCommentSafetyActions/);
  assert.match(activity, /promptPostSafetyActions/);
  assert.match(socialPost, /promptPostSafetyActions/);
  assert.match(comments, /promptCommentSafetyActions/);
});

test("merchant portal RLS hardening protects merchant-only surfaces", () => {
  const migration = readRepoFile("supabase/migrations/0020_merchant_rls_hardening.sql");
  const authorGuard = readRepoFile("supabase/migrations/0021_review_author_update_guard.sql");
  const catalogGuard = readRepoFile("supabase/migrations/0022_merchant_catalog_column_guards.sql");

  assert.match(migration, /merchant_can_manage_venue/);
  assert.match(migration, /enforce_merchant_review_reply_update/);
  assert.match(migration, /interaction_reports_insert_merchant_owner_or_manager/);
  assert.match(migration, /notification_prefs_select_member/);
  assert.match(migration, /notification_prefs_update_owner_or_manager/);
  assert.match(migration, /merchant review updates are limited to reply fields/);
  assert.match(authorGuard, /review authors cannot change identity or merchant reply fields/);
  assert.match(authorGuard, /new\.merchant_replied_at is distinct from old\.merchant_replied_at/);
  assert.match(catalogGuard, /enforce_merchant_venue_update_guard/);
  assert.match(catalogGuard, /enforce_merchant_dish_write_guard/);
  assert.match(catalogGuard, /merchant venue updates are limited to profile fields/);
  assert.match(
    catalogGuard,
    /merchant dish updates cannot change identity, aggregate, or live fields/,
  );
});
