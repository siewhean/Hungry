import { NextRequest, NextResponse } from "next/server";

import { clearMerchantSessionCookies, requireMerchantMutationProtection } from "../_session";

export async function POST(request: NextRequest) {
  const blocked = requireMerchantMutationProtection(request);
  if (blocked) return blocked;

  const response = NextResponse.json({ ok: true });
  clearMerchantSessionCookies(response);
  return response;
}
