import { NextRequest, NextResponse } from "next/server";

import { writeMerchantAuditLog } from "@/lib/merchantPortal/audit";
import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import { supabaseFetch } from "@/lib/supabase/server";
import { getMerchantPortalOverview } from "@/lib/supabase/websiteData";
import { requireMerchantAccessToken, requireMerchantMutationProtection } from "../_session";

export async function POST(request: NextRequest) {
  const blocked = requireMerchantMutationProtection(request);
  if (blocked) return blocked;
  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "merchant-verification-submit"),
    limit: 12,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const accessToken = await requireMerchantAccessToken();
    const overview = await getMerchantPortalOverview(accessToken);
    const body = await readJsonObject(request);
    const verificationMethod = getStringField(body, "method", { max: 80 });
    const method =
      verificationMethod === "singpass_myinfo" ||
      verificationMethod === "video_walkaround" ||
      verificationMethod === "home_based_declaration"
        ? verificationMethod
        : "licence_upload";

    await supabaseFetch("rest/v1/merchant_verifications", {
      accessToken,
      body: {
        method,
        outlet_id: overview.outlet.id,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      method: "POST",
      params: { on_conflict: "outlet_id" },
      prefer: "resolution=merge-duplicates,return=minimal",
    });

    await writeMerchantAuditLog({
      action: "merchant_verification_submitted",
      metadata: { method },
      overview,
      targetId: overview.outlet.id,
      targetType: "merchant_verification",
    });

    return NextResponse.json(await getMerchantPortalOverview(accessToken));
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;

    console.error("Merchant verification submit failed", error);
    return jsonError("Unable to submit verification.", 400);
  }
}
