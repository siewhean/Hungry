import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { getMerchantPortalOverview } from "@/lib/supabase/websiteData";
import { ensureMerchantCsrfCookie, requireMerchantAccessToken } from "../_session";

export async function GET(request: NextRequest) {
  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "merchant-session"),
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const accessToken = await requireMerchantAccessToken();
    const overview = await getMerchantPortalOverview(accessToken);
    const response = NextResponse.json({ authenticated: true, overview });
    ensureMerchantCsrfCookie(request, response);
    return response;
  } catch {
    return jsonError("Merchant session is unavailable.", 401);
  }
}
