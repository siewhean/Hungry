import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { isOwnMerchantDishImageUrl } from "./merchantDishImageUrl";

const owner = {
  supabaseUrl: "https://proj.supabase.co",
  userId: "user-1",
  venueId: "venue-9",
};
const base = "https://proj.supabase.co/storage/v1/object/public/merchant-dish-images";

test("accepts this project's merchant dish photos for the edited venue", () => {
  assert.equal(isOwnMerchantDishImageUrl(`${base}/user-1/venue-9/dish-1/image-0.jpg`, owner), true);
  // A co-manager's upload for the same venue is kept.
  assert.equal(isOwnMerchantDishImageUrl(`${base}/user-2/venue-9/dish-1/image-0.jpg`, owner), true);
  // Configured URL with a trailing slash still matches by origin.
  assert.equal(
    isOwnMerchantDishImageUrl(`${base}/user-1/venue-9/dish-1/a.jpg`, {
      ...owner,
      supabaseUrl: "https://proj.supabase.co/",
    }),
    true,
  );
});

test("rejects other hosts, schemes, buckets, and credentials", () => {
  for (const url of [
    "https://evil.example/storage/v1/object/public/merchant-dish-images/user-1/venue-9/d/a.jpg",
    "https://proj.supabase.co.evil.example/storage/v1/object/public/merchant-dish-images/user-1/venue-9/d/a.jpg",
    "https://other.supabase.co/storage/v1/object/public/merchant-dish-images/user-1/venue-9/d/a.jpg",
    "http://proj.supabase.co/storage/v1/object/public/merchant-dish-images/user-1/venue-9/d/a.jpg",
    "https://x@proj.supabase.co/storage/v1/object/public/merchant-dish-images/user-1/venue-9/d/a.jpg",
    "https://proj.supabase.co:8443/storage/v1/object/public/merchant-dish-images/user-1/venue-9/d/a.jpg",
    `https://proj.supabase.co/storage/v1/object/public/merchant-stall-images/user-1/venue-9/d/a.jpg`,
    "javascript:alert(1)",
    "not a url",
  ]) {
    assert.equal(isOwnMerchantDishImageUrl(url, owner), false, url);
  }
});

test("rejects objects outside the edited venue's folder or with odd paths", () => {
  assert.equal(isOwnMerchantDishImageUrl(`${base}/user-1/venue-other/d/a.jpg`, owner), false);
  assert.equal(isOwnMerchantDishImageUrl(`${base}/user-1/a.jpg`, owner), false);
  assert.equal(isOwnMerchantDishImageUrl(`${base}/user-1//d/a.jpg`, owner), false);
  assert.equal(isOwnMerchantDishImageUrl(`${base}/user-1/venue-9/%2e%2e/a.jpg`, owner), false);
  assert.equal(isOwnMerchantDishImageUrl(`${base}/user-1/venue-9/%E0%A4%A/a.jpg`, owner), false);
});

test("unlinked outlets only trust the caller's own prefix", () => {
  const unlinked = { ...owner, venueId: null };
  assert.equal(isOwnMerchantDishImageUrl(`${base}/user-1/unlinked/d/a.jpg`, unlinked), true);
  assert.equal(isOwnMerchantDishImageUrl(`${base}/user-2/unlinked/d/a.jpg`, unlinked), false);
  assert.equal(
    isOwnMerchantDishImageUrl(`${base}/user-1/unlinked/d/a.jpg`, { ...unlinked, userId: null }),
    false,
  );
});

test("rejects everything when the Supabase URL is missing or not https", () => {
  const url = `${base}/user-1/venue-9/d/a.jpg`;
  assert.equal(isOwnMerchantDishImageUrl(url, { ...owner, supabaseUrl: "" }), false);
  assert.equal(
    isOwnMerchantDishImageUrl(url.replace("https:", "http:"), {
      ...owner,
      supabaseUrl: "http://proj.supabase.co",
    }),
    false,
  );
});

test("supabaseService uses the origin- and prefix-checked helper, not a host-agnostic regex", () => {
  const service = readFileSync(
    resolve(process.cwd(), "src/lib/services/supabase/supabaseService.ts"),
    "utf8",
  );
  assert.match(service, /isOwnMerchantDishImageUrl\(url, imageOwner\)/);
  assert.match(service, /supabaseUrl: getConfiguredSupabaseUrl\(\)/);
  assert.doesNotMatch(service, /\[\^\/\]\+\\\/storage\\\/v1/);
});
