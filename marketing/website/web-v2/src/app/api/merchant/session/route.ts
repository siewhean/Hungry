import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/security/api";
import { getMerchantPortalOverview } from "@/lib/supabase/websiteData";
import { ensureMerchantCsrfCookie, requireMerchantAccessToken } from "../_session";

export async function GET(request: NextRequest) {
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
