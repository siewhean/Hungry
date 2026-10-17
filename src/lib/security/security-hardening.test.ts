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

test("PostHog identity properties do not include precise coordinates", () => {
  const sessionStore = readRepoFile("src/store/useSessionStore.ts");
  const identityBuilder = sessionStore.slice(
    sessionStore.indexOf("function buildPostHogIdentityProperties"),
    sessionStore.indexOf("export const useSessionStore"),
  );

  assert.doesNotMatch(identityBuilder, /latitude/);
  assert.doesNotMatch(identityBuilder, /longitude/);
  assert.match(identityBuilder, /has_precise_location/);
  assert.match(identityBuilder, /location_source/);
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
    () => assertValidMenuPhotoUpload({ mimeType: "image/svg+xml", fileSizeBytes: 1024 }),
    /image\/jpeg/,
  );
  assert.doesNotThrow(() =>
    assertValidMenuPhotoUpload({ mimeType: "image/webp", fileSizeBytes: 1024 }),
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

  assert.match(source, /ALLOWED_OCR_IMAGE_TYPES/);
  assert.match(source, /assertValidOcrImageType\(imageResponse\)/);
  assert.match(source, /Processing failed\. Please try again\./);
  assert.match(source, /console\.error\("OCR pipeline error"/);
  assert.doesNotMatch(source, /ocr_error: message\.slice/);
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

test("guest session function rate-limits by device and client IP with generic server errors", () => {
  const source = readRepoFile("supabase/functions/guest-sessions/index.ts");

  assert.match(source, /MAX_SESSIONS_PER_DEVICE_PER_HOUR/);
  assert.match(source, /MAX_SESSIONS_PER_IP_PER_HOUR/);
  assert.match(source, /function getClientIp\(request: Request\)/);
  assert.match(source, /cf-connecting-ip/);
  assert.match(source, /\.eq\("client_ip", clientIp\)/);
  assert.match(source, /client_ip: clientIp/);
  assert.match(source, /server_misconfigured/);
  assert.doesNotMatch(source, /message: countError\.message/);
  assert.doesNotMatch(source, /message: error\?\.message/);
});

test("security audit migration privatizes review media and adds owner-scoped policies", () => {
  const migration = readRepoFile(
    "supabase/migrations/20260607090000_security_audit_remediation.sql",
  );

  assert.match(migration, /add column if not exists client_ip text/);
  assert.match(migration, /idx_guest_sessions_client_ip_created_at/);
  assert.match(migration, /add column if not exists storage_bucket text/);
  assert.match(migration, /add column if not exists storage_path text/);
  assert.match(migration, /public = false/);
  assert.match(migration, /where id in \('menu-photos', 'review-media'\)/);
  assert.match(migration, /drop policy if exists "public_select_review_photos"/);
  assert.match(migration, /review_photos_insert_own_review/);
  assert.match(migration, /r\.user_id = auth\.uid\(\)/);
  assert.match(migration, /user_profiles_anon_deny/);
  assert.match(migration, /using \(false\)/);
  assert.match(migration, /review_media_select_signed_public_reviews/);
  assert.match(migration, /rp\.storage_path = storage\.objects\.name/);
});

test("review photo writes persist storage paths and reads resolve signed URLs", () => {
  const service = readRepoFile("src/lib/services/supabase/supabaseService.ts");

  assert.match(service, /bucket: "review-media"/);
  assert.match(service, /storage_bucket: "review-media"/);
  assert.match(service, /storage_path: asset\.path/);
  assert.match(service, /\.select\("review_id,url,storage_bucket,storage_path,sort_order"\)/);
  assert.match(service, /createSignedStorageUrl\(client, bucket, path\)/);
  assert.doesNotMatch(service, /uploadedPhotoUrls/);
});

test("marketing website ships a content security policy header", () => {
  const config = readRepoFile("marketing/website/web-v2/next.config.ts");

  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /default-src 'self'/);
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(config, /object-src 'none'/);
  assert.match(config, /upgrade-insecure-requests/);
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

test("security advisor migration replaces public_profiles view with RLS table", () => {
  const advisorFix = readRepoFile(
    "supabase/migrations/20260522124728_security_advisor_rls_view_fixes.sql",
  );

  assert.match(advisorFix, /public_profiles_kind/);
  assert.match(advisorFix, /drop view public\.public_profiles/);
  assert.doesNotMatch(advisorFix, /drop view if exists public\.public_profiles/);
  assert.match(advisorFix, /create table if not exists public\.public_profiles/);
  assert.match(advisorFix, /alter table public\.public_profiles enable row level security/);
  assert.match(advisorFix, /create policy public_profiles_select_visible/);
  assert.match(advisorFix, /using \(public\.can_read_author_content\(id\)\)/);
  assert.match(advisorFix, /create schema if not exists app_private/);
  assert.match(advisorFix, /create or replace function app_private\.sync_public_profile/);
  assert.match(advisorFix, /security definer/);
  assert.match(
    advisorFix,
    /revoke all on function app_private\.sync_public_profile\(\) from public, anon, authenticated/,
  );
  assert.match(advisorFix, /alter table public\.spatial_ref_sys enable row level security/);
  assert.doesNotMatch(advisorFix, /email/);
});

test("advisor warning hardening pins app-owned functions and removes anon RPC execution", () => {
  const hardening = readRepoFile(
    "supabase/migrations/20260522131215_advisor_security_warning_hardening.sql",
  );
  const grantFix = readRepoFile(
    "supabase/migrations/20260522132749_advisor_public_profile_anon_grant_fix.sql",
  );
  const rlsAutoEnableFix = readRepoFile(
    "supabase/migrations/20260522134703_advisor_rls_auto_enable_execute_fix.sql",
  );
  const triggerFunctionFix = readRepoFile(
    "supabase/migrations/20260522134944_advisor_trigger_function_execute_fix.sql",
  );
  const extensionSchemaFix = readRepoFile(
    "supabase/migrations/20260522135336_advisor_non_postgis_extension_schema_fix.sql",
  );
  const postgisRpcGrantFix = readRepoFile(
    "supabase/migrations/20260522135654_advisor_postgis_rpc_grant_fix.sql",
  );
  const privateRpcWrappers = readRepoFile(
    "supabase/migrations/20260522142004_advisor_private_rpc_wrappers.sql",
  );

  assert.match(hardening, /alter function public\.food_cred_level_index\(integer\)/);
  assert.match(hardening, /alter function public\.food_cred_default_points\(text\)/);
  assert.match(hardening, /alter function public\.food_cred_daily_cap\(text\)/);
  assert.match(hardening, /set search_path = public, pg_temp/);

  for (const functionName of [
    "app_user_block_exists",
    "can_access_conversation",
    "can_read_author_content",
    "can_read_post",
    "report_post",
    "send_chat_message",
    "submit_menu_photo",
    "submit_merchant_claim_interest",
    "sync_home_feed_item_for_post",
    "sync_post_engagement_counts",
  ]) {
    assert.match(
      hardening,
      new RegExp(`revoke execute on function public\\.${functionName}\\(`),
      `${functionName} should no longer be anon-executable by default`,
    );
  }

  assert.doesNotMatch(hardening, /alter extension postgis/i);
  assert.doesNotMatch(hardening, /drop extension postgis/i);
  assert.doesNotMatch(hardening, /alter table public\.spatial_ref_sys/i);
  assert.doesNotMatch(hardening, /rls_auto_enable/);
  assert.match(
    grantFix,
    /grant execute on function public\.can_read_author_content\(uuid\) to anon/,
  );
  assert.match(rlsAutoEnableFix, /to_regprocedure\('public\.rls_auto_enable\(\)'\)/);
  assert.match(
    rlsAutoEnableFix,
    /revoke execute on function public\.rls_auto_enable\(\) from authenticated/,
  );
  assert.match(
    triggerFunctionFix,
    /revoke execute on function public\.sync_home_feed_item_for_post\(\)/,
  );
  assert.match(
    triggerFunctionFix,
    /revoke execute on function public\.sync_post_engagement_counts\(\)/,
  );
  assert.match(triggerFunctionFix, /from public, anon, authenticated/);
  for (const extensionName of ["vector", "pg_trgm", "btree_gist", "citext"]) {
    assert.match(extensionSchemaFix, new RegExp(`'${extensionName}'`));
  }
  assert.match(extensionSchemaFix, /alter extension %I set schema extensions/);
  assert.doesNotMatch(extensionSchemaFix, /postgis/);
  assert.match(
    postgisRpcGrantFix,
    /revoke execute on function public\.st_estimatedextent\(text, text\)/,
  );
  assert.match(
    postgisRpcGrantFix,
    /revoke execute on function public\.st_estimatedextent\(text, text, text\)/,
  );
  assert.match(
    postgisRpcGrantFix,
    /revoke execute on function public\.st_estimatedextent\(text, text, text, boolean\)/,
  );
  assert.match(privateRpcWrappers, /create schema if not exists app_private/);
  assert.match(privateRpcWrappers, /alter function %s set schema app_private/);
  assert.match(privateRpcWrappers, /security invoker/);
  assert.match(privateRpcWrappers, /app_private\.%I/);
  for (const functionName of [
    "send_chat_message",
    "report_content",
    "award_food_cred",
    "upsert_stall_interaction",
    "increment_mission_progress",
    "submit_menu_photo",
  ]) {
    assert.match(privateRpcWrappers, new RegExp(`'${functionName}'`));
  }
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
  const gracePeriod = readRepoFile(
    "supabase/migrations/20261017120000_account_deletion_grace_period.sql",
  );
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
  assert.match(supabaseService, /report_content/);
  assert.match(supabaseService, /user_blocks/);
  assert.match(safetyHelper, /promptReportReview/);
  assert.match(safetyHelper, /promptBlockReviewAuthor/);
  assert.match(locationScreen, /Allowing location helps Hungry curate/);
  assert.doesNotMatch(
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
  assert.match(settingsScreen, /WEB_LINKS\.accountDeletion/);
  assert.match(settingsScreen, /ACCOUNT_DELETION_GRACE_DAYS/);
  assert.match(gracePeriod, /scheduled_for <= now\(\)/);
  assert.match(gracePeriod, /cancel_my_account_deletion/);
  assert.match(supabaseService, /cancel_my_account_deletion/);
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
  assert.match(supabaseService, /redirectTo: AUTH_REDIRECTS\.passwordReset/);
  assert.match(supabaseService, /emailRedirectTo: AUTH_REDIRECTS\.emailConfirm/);
  assert.match(supabaseService, /const redirectTo = AUTH_REDIRECTS\.oauth/);
  assert.match(supabaseService, /exchangeRecoveryCodeIfPresent/);
  assert.match(supabaseService, /Password recovery callback URL was not trusted/);
  assert.match(supabaseService, /Password recovery token fragments are not accepted/);
  assert.match(supabaseService, /exchangeCodeForSession\(code\)/);
  assert.match(resetScreen, /route\.params\?\.code \?\? ""/);
  assert.match(forgotScreen, /navigation\.navigate\("Login"\)/);
  assert.match(linking, /ResetPassword: "auth\/reset"/);
});

test("UGC surfaces expose report, hide, and block safety actions", () => {
  const helper = readRepoFile("src/lib/security/communitySafety.ts");
  const home = readRepoFile("src/app/screens/home/HomeFeedScreen.tsx");
  const activity = readRepoFile("src/app/screens/home/ActivityPostDetailScreen.tsx");
  const socialPost = readRepoFile("src/app/screens/profile/SocialPostDetailScreen.tsx");
  const comments = readRepoFile("src/components/social/ReviewCommentsSheet.tsx");

  assert.match(helper, /promptPostSafetyActions/);
  assert.match(helper, /promptCommentSafetyActions/);
  assert.match(helper, /getHiddenPostIdsForSession/);
  assert.match(helper, /getBlockedAuthorKeysForSession/);
  assert.match(helper, /isContentHiddenForSession/);
  assert.match(helper, /communitySafety\.reportContent/);
  assert.match(helper, /communitySafety\.blockUser/);
  assert.match(helper, /communitySafety\.hidePost/);
  assert.match(helper, /blockedAuthorKeys\.add\(targetAuthorKey\(target\.authorName\)\)/);
  assert.match(helper, /hiddenPostIds\.add\(postId\)/);
  assert.match(home, /promptPostSafetyActions/);
  assert.match(home, /promptCommentSafetyActions/);
  assert.match(home, /\{commentsEnabled \? \(\s*<Pressable[\s\S]*Read comments for/);
  assert.match(activity, /promptPostSafetyActions/);
  assert.match(socialPost, /promptPostSafetyActions/);
  assert.match(comments, /promptCommentSafetyActions/);
});

test("shared post reads apply session hide and block filters before rendering", () => {
  const sharedPosts = readRepoFile("src/features/social/sharedStallPosts.ts");

  assert.match(sharedPosts, /isContentHiddenForSession/);
  assert.match(
    sharedPosts,
    /if \(isContentHiddenForSession\(\{ id: post\.id, authorName: post\.authorName \}\)\) return false;/,
  );
  assert.match(sharedPosts, /return mergeStallPosts\(localPublishedPosts, bitePosts, servicePosts/);
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

test("trusted external links stay on usehungry.com and allow only the support inbox", () => {
  const source = readRepoFile("src/lib/security/safeLinking.ts");
  const links = readRepoFile("src/constants/links.ts");

  assert.match(links, /WEB_HOST = "usehungry\.com"/);
  assert.match(source, /ALLOWED_HOSTS = new Set\(\[WEB_HOST, `www\.\$\{WEB_HOST\}`\]\)/);
  assert.match(source, /ALLOWED_MAILTO_ADDRESSES = new Set\(\[SUPPORT_EMAIL\]\)/);
  assert.match(links, /SUPPORT_EMAIL = "usehungrysingapore@gmail\.com"/);
  assert.doesNotMatch(source, /hungry\.sg/);
});
