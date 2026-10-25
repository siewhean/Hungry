import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import { signUpWithPassword } from "@/lib/supabase/server";
import { requireMerchantJsonRequest, requireMerchantSameOriginRequest } from "../_session";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getRedirectUrl(request: NextRequest) {
  return `${request.nextUrl.origin}/merchant/login`;
}

export async function POST(request: NextRequest) {
  const blockedOrigin = requireMerchantSameOriginRequest(request);
  if (blockedOrigin) return blockedOrigin;
  const blockedContentType = requireMerchantJsonRequest(request);
  if (blockedContentType) return blockedContentType;

  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "merchant-signup"),
    limit: 4,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const body = await readJsonObject(request);
    if (body.ageConfirmed !== true || body.termsAccepted !== true) {
      return jsonError("Confirm you are 18 or older and accept the Terms of Service.", 400);
    }
    const email =
      getStringField(body, "email", { max: 254, required: true, transform: "lower-trim" }) ?? "";
    const password =
      getStringField(body, "password", { max: 1024, min: 1, required: true, transform: "none" }) ??
      "";
    const name = getStringField(body, "name", { max: 120, required: true }) ?? "";
    const businessName = getStringField(body, "businessName", { max: 160, required: true }) ?? "";

    if (!EMAIL_REGEX.test(email)) {
      return jsonError("Enter a valid email address.", 400);
    }
    if (password.length < 8) {
      return jsonError("Use at least 8 characters for your password.", 400);
    }
    if (!name || !businessName) {
      return jsonError("Enter your name and business name.", 400);
    }

    await signUpWithPassword({
      businessName,
      email,
      name,
      password,
      redirectTo: getRedirectUrl(request),
      consent: { version: "2026-10-25", recordedAt: new Date().toISOString() },
    });

    return NextResponse.json({
      ok: true,
      message:
        "Merchant account request received. Check your email, then Hungry will link your approved business profile.",
    });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    if (error instanceof Error && error.message.includes("not configured")) {
      return jsonError("Merchant account creation is not configured.", 503);
    }

    return jsonError("Unable to create merchant account.", 400);
  }
}
