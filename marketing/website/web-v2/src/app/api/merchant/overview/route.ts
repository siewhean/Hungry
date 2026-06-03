import { NextResponse } from "next/server";

import { jsonError } from "@/lib/security/api";
import { getMerchantPortalOverview } from "@/lib/supabase/websiteData";
import { requireMerchantAccessToken } from "../_session";

export async function GET() {
  try {
    const accessToken = await requireMerchantAccessToken();
    return NextResponse.json(await getMerchantPortalOverview(accessToken));
  } catch {
    return jsonError("Merchant sign-in is required.", 401);
  }
}
