import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { sanitizeAnalyticsProperties } from "@/lib/analytics/privacy";
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
  globalThis.fetch = async () =>
    new Response(new Blob(["png"], { type: "image/png" }), {
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

  assert.match(source, /SUPABASE_ANON_KEY/);
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /submitted_by/);
  assert.match(source, /forbidden_submission/);
  assert.match(source, /INGEST_MENU_PHOTO_ALLOWED_ORIGINS/);
  assert.doesNotMatch(source, /"Access-Control-Allow-Origin": "\*"/);
});

test("store policy controls cover account deletion, UGC moderation, and location disclosure", () => {
  const migration = readRepoFile("supabase/migrations/0017_store_policy_safety_controls.sql");
  const serviceTypes = readRepoFile("src/lib/services/types.ts");
  const supabaseService = readRepoFile("src/lib/services/supabase/supabaseService.ts");
  const safetyHelper = readRepoFile("src/lib/security/communitySafety.ts");
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
  assert.doesNotMatch(appConfig, /NSLocalNetworkUsageDescription/);
  assert.doesNotMatch(appConfig, /NSBonjourServices/);
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
