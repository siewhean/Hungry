import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import { signInWithPassword } from "@/lib/supabase/server";
import { getMerchantPortalOverview } from "@/lib/supabase/websiteData";
import {
  MERCHANT_ACCESS_COOKIE,
  MERCHANT_REFRESH_COOKIE,
  requireMerchantJsonRequest,
  requireMerchantSameOriginRequest,
  setMerchantCsrfCookie,
} from "../_session";

export async function POST(request: NextRequest) {
  const blockedOrigin = requireMerchantSameOriginRequest(request);
  if (blockedOrigin) return blockedOrigin;
  const blockedContentType = requireMerchantJsonRequest(request);
  if (blockedContentType) return blockedContentType;

  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "merchant-login"),
    limit: 6,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const body = await readJsonObject(request);
    const email = getStringField(body, "email", { max: 254, required: true, transform: "lower-trim" }) ?? "";
    const password = getStringField(body, "password", { max: 1024, min: 1, required: true, transform: "none" }) ?? "";
    const auth = await signInWithPassword(email, password);
    const overview = await getMerchantPortalOverview(auth.access_token);
    const response = NextResponse.json({ ok: true, overview });
    const maxAge = Math.max(60, Number(auth.expires_in) || 3600);

    response.cookies.set(MERCHANT_ACCESS_COOKIE, auth.access_token, {
      httpOnly: true,
      maxAge,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    if (auth.refresh_token) {
      response.cookies.set(MERCHANT_REFRESH_COOKIE, auth.refresh_token, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    setMerchantCsrfCookie(response);

    return response;
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;

    return jsonError("Invalid merchant email or password.", 401);
  }
}
