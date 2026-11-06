import assert from "node:assert/strict";
import test from "node:test";

import {
  getChainLogoDomain,
  getVenueLogoCandidates,
  getVenueLogoDomain,
  getVenueLogoInitials,
} from "@/features/search/venueLogo";

function withBrandfetchClientId(value: string | undefined, run: () => void) {
  const previous = process.env.EXPO_PUBLIC_BRANDFETCH_CLIENT_ID;
  if (value === undefined) delete process.env.EXPO_PUBLIC_BRANDFETCH_CLIENT_ID;
  else process.env.EXPO_PUBLIC_BRANDFETCH_CLIENT_ID = value;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_BRANDFETCH_CLIENT_ID;
    else process.env.EXPO_PUBLIC_BRANDFETCH_CLIENT_ID = previous;
  }
}

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

test("getChainLogoDomain matches verified chains by exact name or word-boundary prefix", () => {
  assert.equal(getChainLogoDomain("Nandos"), "nandos.com");
  assert.equal(getChainLogoDomain("Nando's - Bugis Junction"), "nandos.com");
  assert.equal(getChainLogoDomain("Soon Lee Fish Soup"), "soonlee.sg");
  assert.equal(getChainLogoDomain("Nandosa Kitchen"), undefined);
  assert.equal(getChainLogoDomain("Some Unknown Stall"), undefined);
  assert.equal(getChainLogoDomain(undefined), undefined);
  assert.equal(getChainLogoDomain(null), undefined);
});

test("getVenueLogoCandidates puts the chain logo first and keeps the favicon fallbacks", () => {
  withBrandfetchClientId("test-client", () => {
    assert.deepEqual(
      getVenueLogoCandidates("https://logo.clearbit.com/nandos.com", "Nandos - Bugis"),
      [
        "https://cdn.brandfetch.io/nandos.com?c=test-client",
        "https://logo.clearbit.com/nandos.com",
        "https://icons.duckduckgo.com/ip3/nandos.com.ico",
        "https://www.google.com/s2/favicons?domain=nandos.com&sz=128",
      ],
    );
    assert.deepEqual(getVenueLogoCandidates(undefined, "Nandos"), [
      "https://cdn.brandfetch.io/nandos.com?c=test-client",
    ]);
  });
});

test("getVenueLogoCandidates keeps our stored logo ahead of the chain logo", () => {
  withBrandfetchClientId("test-client", () => {
    const stored =
      "https://yrlxjeovwslirseajomz.supabase.co/storage/v1/object/public/brand-logos/nandos-1a2b3c4d.jpg";
    assert.deepEqual(getVenueLogoCandidates(stored, "Nandos"), [
      stored,
      "https://cdn.brandfetch.io/nandos.com?c=test-client",
    ]);
  });
});

test("getVenueLogoCandidates skips the chain logo without a client id or a chain match", () => {
  withBrandfetchClientId(undefined, () => {
    assert.deepEqual(getVenueLogoCandidates(undefined, "Nandos"), []);
  });
  withBrandfetchClientId("test-client", () => {
    assert.deepEqual(getVenueLogoCandidates(undefined, "Some Unknown Stall"), []);
  });
});
