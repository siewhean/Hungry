import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireJsonRequest, requireRateLimit } from "@/lib/security/api";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import {
  submitWebsiteWaitlist,
  WAITLIST_NOT_CONFIGURED,
  type WaitlistAudience,
} from "@/lib/supabase/websiteData";

function normalizeAudience(value: unknown): WaitlistAudience {
  if (value === "merchant" || value === "hawker") return "merchant";
  if (value === "both") return "both";
  return "foodie";
}

export async function POST(request: NextRequest) {
  const blockedContentType = requireJsonRequest(request);
  if (blockedContentType) return blockedContentType;

  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "waitlist"),
    limit: 8,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const body = await readJsonObject(request);
    const audience = normalizeAudience(body.audience ?? body.joining_as);
    const businessName =
      getStringField(body, "businessName", { max: 160 }) ??
      getStringField(body, "business_name", { max: 160 });
    const establishmentType =
      getStringField(body, "establishmentType", { max: 80 }) ??
      getStringField(body, "establishment_type", { max: 80 });

    if (audience === "merchant" && !businessName) {
      return jsonError("Enter your business name.", 400);
    }

    if (audience === "merchant" && !establishmentType) {
      return jsonError("Select your food business type.", 400);
    }

    if (audience === "merchant" && establishmentType?.toLowerCase() === "other") {
      return jsonError("Specify your food business type.", 400);
    }

    const result = await submitWebsiteWaitlist({
      audience,
      businessName,
      email: getStringField(body, "email", { max: 254, required: true, transform: "lower-trim" }) ?? "",
      establishmentType,
      metadata: {
        referrer: request.headers.get("referer") ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
      name: getStringField(body, "name", { max: 120 }),
      source: "web_v2",
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;

    if (error instanceof Error && error.message === "Enter a valid email address.") {
      return jsonError(error.message, 400);
    }

    console.error("Waitlist signup failed", error);

    if (error instanceof Error && error.message === WAITLIST_NOT_CONFIGURED) {
      return jsonError("Sign-ups are temporarily unavailable. Please try again soon.", 503);
    }

    return jsonError("Unable to join waitlist.", 500);
  }
}
