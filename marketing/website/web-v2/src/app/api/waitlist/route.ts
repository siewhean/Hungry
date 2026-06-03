import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import { submitWebsiteWaitlist, type WaitlistAudience } from "@/lib/supabase/websiteData";

function normalizeAudience(value: unknown): WaitlistAudience {
  if (value === "merchant" || value === "hawker") return "merchant";
  if (value === "both") return "both";
  return "foodie";
}

export async function POST(request: NextRequest) {
  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "waitlist"),
    limit: 8,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const body = await readJsonObject(request);
    const result = await submitWebsiteWaitlist({
      audience: normalizeAudience(body.audience ?? body.joining_as),
      businessName:
        getStringField(body, "businessName", { max: 160 }) ??
        getStringField(body, "business_name", { max: 160 }),
      email: getStringField(body, "email", { max: 254, required: true, transform: "lower-trim" }) ?? "",
      establishmentType:
        getStringField(body, "establishmentType", { max: 80 }) ??
        getStringField(body, "establishment_type", { max: 80 }),
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

    return jsonError("Unable to join waitlist.", 400);
  }
}
