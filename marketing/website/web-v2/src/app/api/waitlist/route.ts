import { NextRequest, NextResponse } from "next/server";

import {
  clientRequestKey,
  jsonError,
  requireJsonRequest,
  requireRateLimit,
} from "@/lib/security/api";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import { submitWebsiteWaitlist, type WaitlistAudience } from "@/lib/supabase/websiteData";

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
    if (body.ageConfirmed !== true || body.updatesRequested !== true) {
      return jsonError(
        "Confirm you are 18 or older and request emails for your selected list.",
        400,
      );
    }
    const audience = normalizeAudience(body.audience ?? body.joining_as);
    const businessName =
      getStringField(body, "businessName", { max: 160 }) ??
      getStringField(body, "business_name", { max: 160 });
    const establishmentType =
      getStringField(body, "establishmentType", { max: 80 }) ??
      getStringField(body, "establishment_type", { max: 80 });

    if (audience === "merchant" && establishmentType?.toLowerCase() === "other") {
      return jsonError("Specify your food business type.", 400);
    }

    const result = await submitWebsiteWaitlist({
      audience,
      businessName: audience === "merchant" || audience === "both" ? businessName : undefined,
      email:
        getStringField(body, "email", { max: 254, required: true, transform: "lower-trim" }) ?? "",
      establishmentType:
        audience === "merchant" || audience === "both" ? establishmentType : undefined,
      metadata: {
        ageConfirmed: true,
        selectedListUpdatesRequested: true,
        consentVersion: "2026-10-25",
        consentRecordedAt: new Date().toISOString(),
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

    return jsonError("Unable to join waitlist.", 400);
  }
}
