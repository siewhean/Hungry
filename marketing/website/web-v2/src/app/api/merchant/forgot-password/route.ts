import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import { sendPasswordResetEmail } from "@/lib/supabase/server";
import { requireMerchantJsonRequest, requireMerchantSameOriginRequest } from "../_session";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const blockedOrigin = requireMerchantSameOriginRequest(request);
  if (blockedOrigin) return blockedOrigin;
  const blockedContentType = requireMerchantJsonRequest(request);
  if (blockedContentType) return blockedContentType;

  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "merchant-forgot-password"),
    limit: 5,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const body = await readJsonObject(request);
    const email = getStringField(body, "email", { max: 254, required: true, transform: "lower-trim" }) ?? "";

    if (!EMAIL_REGEX.test(email)) {
      return jsonError("Enter a valid email address.", 400);
    }

    await sendPasswordResetEmail(email, `${request.nextUrl.origin}/merchant/login`);

    return NextResponse.json({
      ok: true,
      message: "If this email has portal access, reset instructions will arrive shortly.",
    });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;

    if (error instanceof Error && error.message.includes("not configured")) {
      return jsonError("Merchant password reset is not configured.", 503);
    }

    return NextResponse.json({
      ok: true,
      message: "If this email has portal access, reset instructions will arrive shortly.",
    });
  }
}
