import assert from "node:assert/strict";
import test from "node:test";

import {
  getVenueLogoCandidates,
  getVenueLogoDomain,
  getVenueLogoInitials,
} from "@/features/search/venueLogo";

test("getVenueLogoDomain reads represented domains from Clearbit logo URLs", () => {
  assert.equal(
    getVenueLogoDomain("https://logo.clearbit.com/starbucks.com.sg"),
    "starbucks.com.sg",
  );
});

test("getVenueLogoCandidates retries non-food favicon logo sources", () => {
  assert.deepEqual(getVenueLogoCandidates("https://logo.clearbit.com/starbucks.com.sg"), [
    "https://logo.clearbit.com/starbucks.com.sg",
    "https://icons.duckduckgo.com/ip3/starbucks.com.sg.ico",
    "https://www.google.com/s2/favicons?domain=starbucks.com.sg&sz=128",
  ]);
});

test("getVenueLogoCandidates rejects malformed comma-joined URLs", () => {
  assert.deepEqual(
    getVenueLogoCandidates("https://example.com/a.png,https://example.com/b.png"),
    [],
  );
});

test("getVenueLogoInitials builds a non-food stall identity fallback", () => {
  assert.equal(getVenueLogoInitials("STARBUCKS COFFEE SINGAPORE PTE. LTD."), "SC");
  assert.equal(getVenueLogoInitials("KFC"), "KF");
  assert.equal(getVenueLogoInitials(undefined), "?");
  assert.equal(getVenueLogoInitials(""), "?");
});

test("getVenueLogoCandidates skips favicon fallbacks for stored brand logos", () => {
  const stored =
    "https://yrlxjeovwslirseajomz.supabase.co/storage/v1/object/public/brand-logos/subway-1a2b3c4d.jpg";
  assert.deepEqual(getVenueLogoCandidates(stored), [stored]);
});
