import { type NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { getMerchantPortalOverview } from "@/lib/supabase/websiteData";
import { requireMerchantAccessToken } from "../_session";

export async function GET(request: NextRequest) {
  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "merchant-overview"),
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const accessToken = await requireMerchantAccessToken();
    return NextResponse.json(await getMerchantPortalOverview(accessToken));
  } catch {
    return jsonError("Merchant sign-in is required.", 401);
  }
}
