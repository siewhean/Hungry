import { NextRequest, NextResponse } from "next/server";

import { writeMerchantAuditLog } from "@/lib/merchantPortal/audit";
import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import { supabaseFetch } from "@/lib/supabase/server";
import { getMerchantPortalOverview } from "@/lib/supabase/websiteData";
import { requireMerchantAccessToken, requireMerchantMutationProtection } from "../_session";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function normalizeBusinessType(value: unknown) {
  const raw = text(value);
  if (!raw) return undefined;
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (
    normalized === "hawker_stall" ||
    normalized === "food_court_stall" ||
    normalized === "home_based" ||
    normalized === "restaurant" ||
    normalized === "cafe" ||
    normalized === "bakery" ||
    normalized === "food_truck"
  ) {
    return normalized;
  }
  return "hawker_stall";
}

export async function PATCH(request: NextRequest) {
  const blocked = requireMerchantMutationProtection(request);
  if (blocked) return blocked;
  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "merchant-profile-update"),
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const accessToken = await requireMerchantAccessToken();
    const overview = await getMerchantPortalOverview(accessToken);
    const body = await readJsonObject(request, 32_768);
    // Only the outlet is written: a verified outlet's name and hours sync to its venue in the
    // database (merchants cannot write venues directly).
    const outletPayload: Record<string, unknown> = {};

    if (body.name !== undefined) {
      outletPayload.name = getStringField(body, "name", { max: 120 });
    }
    if (body.description !== undefined) {
      outletPayload.description = getStringField(body, "description", { max: 2_000 }) ?? "";
    }
    if (body.businessType !== undefined) {
      outletPayload.business_type = normalizeBusinessType(getStringField(body, "businessType", { max: 80 }));
    }
    if (body.phone !== undefined) outletPayload.contact_phone = getStringField(body, "phone", { max: 40 }) ?? null;
    if (body.email !== undefined) {
      outletPayload.contact_email = getStringField(body, "email", { max: 254, transform: "lower-trim" }) ?? null;
    }
    if (body.operatingHours !== undefined) {
      outletPayload.operating_hours = getStringField(body, "operatingHours", { max: 4_000 }) ?? "";
    }
    if (body.profilePhotoUrl !== undefined) {
      outletPayload.profile_photo_url = getStringField(body, "profilePhotoUrl", { max: 2_048 }) ?? null;
    }
    if (body.coverPhotoUrl !== undefined) {
      outletPayload.cover_photo_url = getStringField(body, "coverPhotoUrl", { max: 2_048 }) ?? null;
    }

    if (Object.keys(outletPayload).length > 0) {
      await supabaseFetch("rest/v1/merchant_outlets", {
        accessToken,
        body: outletPayload,
        method: "PATCH",
        params: { id: `eq.${overview.outlet.id}` },
        prefer: "return=minimal",
      });
    }

    await writeMerchantAuditLog({
      action: "merchant_profile_updated",
      metadata: {
        outletFields: Object.keys(outletPayload).sort(),
      },
      overview,
      targetId: overview.outlet.id,
      targetType: "merchant_outlet",
    });

    return NextResponse.json(await getMerchantPortalOverview(accessToken));
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;

    console.error("Merchant profile update failed", error);
    return jsonError("Unable to update merchant profile.", 400);
  }
}
