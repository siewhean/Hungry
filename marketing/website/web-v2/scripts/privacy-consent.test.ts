import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  CONSENT_MAX_AGE_MS,
  CONSENT_STORAGE_KEY,
  analyticsAllowed,
  consentSnapshot,
  filterAnalyticsEvent,
  parseConsent,
  saveConsent,
  subscribeConsent,
} from "../src/lib/privacy/consent";

test("consent parser rejects malformed, expired, wrong-version and unbounded records", () => {
  const now = 1000;
  for (const raw of [
    null,
    "broken",
    "{}",
    JSON.stringify({ version: 2, analytics: true, expiresAt: now + 1 }),
    JSON.stringify({ version: 1, analytics: "true", expiresAt: now + 1 }),
    JSON.stringify({ version: 1, analytics: true, expiresAt: now }),
    JSON.stringify({ version: 1, analytics: true, expiresAt: now + CONSENT_MAX_AGE_MS + 1 }),
  ]) {
    assert.equal(parseConsent(raw, now), null);
  }
  assert.equal(
    parseConsent(JSON.stringify({ version: 1, analytics: false, expiresAt: now + 1 }), now)
      ?.analytics,
    false,
  );
});

test("analytics is off before choice, after rejection/withdrawal, on private paths and privacy signals", () => {
  const values = new Map<string, string>();
  const events = new EventTarget();
  const browser = {
    location: { pathname: "/" },
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    setInterval,
    clearInterval,
  };
  Object.defineProperty(globalThis, "window", { value: browser, configurable: true });
  const privacy = { doNotTrack: "0", globalPrivacyControl: false };
  Object.defineProperty(globalThis, "navigator", { value: privacy, configurable: true });
  const unsubscribe = subscribeConsent(() => undefined);
  try {
    assert.equal(consentSnapshot(), "unset");
    assert.equal(analyticsAllowed(), false);
    assert.equal(saveConsent(true), true);
    assert.equal(analyticsAllowed(), true);
    assert.equal(
      filterAnalyticsEvent({
        url: "https://usehungry.com/join-waitlist?email=private@example.com#token",
      })?.url,
      "https://usehungry.com/join-waitlist",
    );
    assert.equal(filterAnalyticsEvent({ url: "https://usehungry.com/merchant/signup" }), null);
    assert.ok(values.has(CONSENT_STORAGE_KEY));
    browser.location.pathname = "/merchant/signup";
    assert.equal(analyticsAllowed(), false);
    browser.location.pathname = "/";
    privacy.globalPrivacyControl = true;
    assert.equal(analyticsAllowed(), false);
    privacy.globalPrivacyControl = false;
    privacy.doNotTrack = "1";
    assert.equal(analyticsAllowed(), false);
    privacy.doNotTrack = "0";
    saveConsent(false);
    assert.equal(analyticsAllowed(), false);
    values.set(CONSENT_STORAGE_KEY, JSON.stringify({ version: 1, analytics: true, expiresAt: 1 }));
    browser.dispatchEvent(new Event("storage"));
    assert.equal(consentSnapshot(), "unset");
    browser.localStorage.setItem = () => {
      throw new Error("storage blocked");
    };
    assert.equal(saveConsent(false), false);
    assert.equal(analyticsAllowed(), false);
    assert.equal(saveConsent(true), false);
    assert.equal(
      analyticsAllowed(),
      true,
      "explicit choice may apply to this tab when storage is blocked",
    );
    saveConsent(false);
  } finally {
    unsubscribe();
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "navigator");
  }
});

test("personal-data routes require attestations and do not silently add merchant accounts to marketing", () => {
  const source = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
  const waitlist = source("app/api/waitlist/route.ts");
  assert.match(waitlist, /body\.ageConfirmed !== true/);
  assert.match(waitlist, /body\.updatesRequested !== true/);
  assert.doesNotMatch(waitlist, /headers\.get\("(referer|user-agent)"\)/);
  const merchant = source("app/api/merchant/signup/route.ts");
  assert.match(merchant, /body\.termsAccepted !== true/);
  assert.match(merchant, /body\.ageConfirmed !== true/);
  assert.doesNotMatch(merchant, /submitWebsiteWaitlist/);
  assert.match(source("components/privacy/CookieConsent.tsx"), /beforeSend={filterAnalyticsEvent}/);
  assert.doesNotMatch(source("app/layout.tsx"), /<Analytics/);
});
