import { trackAnalyticsEvent } from "@/lib/analytics";
import type { HungryService } from "@/lib/services/types";

export interface SubmitClaimFromStallInput {
  profileId: string;
  venueId: string;
  buildingId: string;
  displayName: string;
  email?: string;
  isAuthenticated: boolean;
  service: HungryService;
  localSingleClaimGuardEnabled?: boolean;
  devFallbackEnabled?: boolean;
}

export type SubmitClaimFromStallResult =
  | { status: "needs_auth" }
  | { status: "created" }
  | { status: "already_exists" }
  | { status: "error" };

const claimedVenueByProfileId = new Map<string, string>();

export function hasPendingClaimForProfile(profileId: string): boolean {
  return claimedVenueByProfileId.has(profileId);
}

function shouldUseDevClaimFallback(error: unknown): boolean {
  if (typeof __DEV__ === "undefined" || __DEV__ !== true) {
    return false;
  }
  return Boolean(error);
}

function isAuthSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("must be signed in") ||
    message.includes("not authenticated") ||
    message.includes("jwt") ||
    message.includes("auth session missing")
  );
}

export async function submitClaimFromStall(
  input: SubmitClaimFromStallInput,
): Promise<SubmitClaimFromStallResult> {
  trackAnalyticsEvent("claim_this_stall_tapped", {
    venue_id: input.venueId,
    building_id: input.buildingId,
    source: "stall_detail",
  });

  if (!input.isAuthenticated) {
    return { status: "needs_auth" };
  }

  const existingClaimVenueId = claimedVenueByProfileId.get(input.profileId);
  const localSingleClaimGuardEnabled = input.localSingleClaimGuardEnabled ?? true;
  if (localSingleClaimGuardEnabled && existingClaimVenueId) {
    return { status: "already_exists" };
  }

  try {
    const result = await input.service.supply.submitMerchantClaimInterest({
      venueId: input.venueId,
      contactName: input.displayName,
      contactEmail: input.email || undefined,
    });
    if (result.status === "created") {
      claimedVenueByProfileId.set(input.profileId, input.venueId);
    }
    if (result.status === "already_exists" && !existingClaimVenueId) {
      claimedVenueByProfileId.set(input.profileId, input.venueId);
    }
    return { status: result.status };
  } catch (error) {
    if (isAuthSessionError(error)) {
      return { status: "needs_auth" };
    }
    const devFallbackEnabled = input.devFallbackEnabled ?? true;
    if (devFallbackEnabled && shouldUseDevClaimFallback(error)) {
      claimedVenueByProfileId.set(input.profileId, input.venueId);
      return { status: "created" };
    }
    return { status: "error" };
  }
}
