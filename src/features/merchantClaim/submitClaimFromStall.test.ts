import test from "node:test";
import assert from "node:assert/strict";

import {
  clearTrackedAnalyticsEvents,
  getTrackedAnalyticsEvents,
  setAnalyticsSink,
} from "@/lib/analytics/mockAnalytics";
import { submitClaimFromStall } from "./submitClaimFromStall";

test("submitClaimFromStall tracks telemetry and returns needs_auth for signed-out users", async () => {
  clearTrackedAnalyticsEvents();
  setAnalyticsSink(null);

  const result = await submitClaimFromStall({
    profileId: "user-guest",
    venueId: "venue-1",
    buildingId: "building-1",
    displayName: "Guest",
    isAuthenticated: false,
    service: {
      supply: {
        submitMerchantClaimInterest: async () => ({ claimId: "x", status: "created" as const }),
      },
    } as any,
  });

  assert.equal(result.status, "needs_auth");
  const events = getTrackedAnalyticsEvents();
  const last = events.at(-1);
  assert.ok(last);
  assert.equal(last?.event, "claim_this_stall_tapped");
});

test("submitClaimFromStall submits merchant claim and returns created", async () => {
  clearTrackedAnalyticsEvents();
  setAnalyticsSink(null);

  let callCount = 0;
  const result = await submitClaimFromStall({
    profileId: "user-owner",
    venueId: "venue-2",
    buildingId: "building-2",
    displayName: "Owner",
    email: "owner@example.com",
    isAuthenticated: true,
    service: {
      supply: {
        submitMerchantClaimInterest: async () => {
          callCount += 1;
          return { claimId: "claim-1", status: "created" as const };
        },
      },
    } as any,
  });

  assert.equal(result.status, "created");
  assert.equal(callCount, 1);
});

test("submitClaimFromStall falls back in __DEV__ for non-auth backend errors", async () => {
  clearTrackedAnalyticsEvents();
  setAnalyticsSink(null);

  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;

  try {
    const first = await submitClaimFromStall({
      profileId: "user-fallback",
      venueId: "venue-3",
      buildingId: "building-3",
      displayName: "Owner",
      email: "owner@example.com",
      isAuthenticated: true,
      service: {
        supply: {
          submitMerchantClaimInterest: async () => {
            throw new Error("Network timeout");
          },
        },
      } as any,
    });
    assert.equal(first.status, "created");

    const second = await submitClaimFromStall({
      profileId: "user-fallback",
      venueId: "venue-3",
      buildingId: "building-3",
      displayName: "Owner",
      email: "owner@example.com",
      isAuthenticated: true,
      service: {
        supply: {
          submitMerchantClaimInterest: async () => {
            throw new Error("Network timeout");
          },
        },
      } as any,
    });
    assert.equal(second.status, "already_exists");
  } finally {
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

test("submitClaimFromStall blocks claiming a second different stall for the same profile", async () => {
  clearTrackedAnalyticsEvents();
  setAnalyticsSink(null);

  let callCount = 0;
  const first = await submitClaimFromStall({
    profileId: "user-single-claim",
    venueId: "venue-first",
    buildingId: "building-1",
    displayName: "Owner",
    email: "owner@example.com",
    isAuthenticated: true,
    service: {
      supply: {
        submitMerchantClaimInterest: async () => {
          callCount += 1;
          return { claimId: "claim-1", status: "created" as const };
        },
      },
    } as any,
  });
  assert.equal(first.status, "created");
  assert.equal(callCount, 1);

  const second = await submitClaimFromStall({
    profileId: "user-single-claim",
    venueId: "venue-second",
    buildingId: "building-2",
    displayName: "Owner",
    email: "owner@example.com",
    isAuthenticated: true,
    service: {
      supply: {
        submitMerchantClaimInterest: async () => {
          callCount += 1;
          return { claimId: "claim-2", status: "created" as const };
        },
      },
    } as any,
  });
  assert.equal(second.status, "already_exists");
  assert.equal(callCount, 1);
});

test("submitClaimFromStall maps backend auth-session errors to needs_auth", async () => {
  clearTrackedAnalyticsEvents();
  setAnalyticsSink(null);

  const result = await submitClaimFromStall({
    profileId: "user-auth-session-missing",
    venueId: "venue-auth",
    buildingId: "building-auth",
    displayName: "Owner",
    email: "owner@example.com",
    isAuthenticated: true,
    devFallbackEnabled: false,
    service: {
      supply: {
        submitMerchantClaimInterest: async () => {
          throw new Error("Auth session missing");
        },
      },
    } as any,
  });

  assert.equal(result.status, "needs_auth");
});
