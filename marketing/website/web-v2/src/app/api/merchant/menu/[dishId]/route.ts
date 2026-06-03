import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { getBooleanField, getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import { supabaseFetch } from "@/lib/supabase/server";
import { getMerchantPortalOverview } from "@/lib/supabase/websiteData";
import { requireMerchantAccessToken, requireMerchantMutationProtection } from "../../_session";

type RouteContext = {
  params: Promise<{ dishId: string }>;
};

function priceToNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function flagsFromBody(body: Record<string, unknown>) {
  const flags: string[] = [];
  if (getBooleanField(body, "isSoldOut") === true) flags.push("sold_out");
  if (getBooleanField(body, "isFeatured") === true) flags.push("featured");
  return flags;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const blocked = requireMerchantMutationProtection(request);
  if (blocked) return blocked;
  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "merchant-menu-update"),
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const accessToken = await requireMerchantAccessToken();
    const overview = await getMerchantPortalOverview(accessToken);
    const { dishId } = await context.params;
    const body = await readJsonObject(request, 32_768);
    const payload: Record<string, unknown> = {};

    if (body.name !== undefined) payload.name = getStringField(body, "name", { max: 120 });
    if (body.description !== undefined) payload.description = getStringField(body, "description", { max: 1_200 }) ?? "";
    if (body.imageUrl !== undefined) payload.image_url = getStringField(body, "imageUrl", { max: 2_048 }) ?? null;
    if (body.price !== undefined) {
      payload.price = priceToNumber(body.price) ?? 0;
      payload.price_range = getStringField(body, "price", { max: 40 }) ?? "";
    }
    if (body.category !== undefined) {
      const category = getStringField(body, "category", { max: 80 });
      payload.taste_tags = category ? [category] : [];
    }
    if (body.isSoldOut !== undefined || body.isFeatured !== undefined) {
      payload.availability_flags = flagsFromBody(body);
    }

    await supabaseFetch("rest/v1/dishes", {
      accessToken,
      body: payload,
      method: "PATCH",
      params: {
        id: `eq.${dishId}`,
        venue_id: overview.outlet.venueId ? `eq.${overview.outlet.venueId}` : undefined,
      },
      prefer: "return=minimal",
    });

    return NextResponse.json(await getMerchantPortalOverview(accessToken));
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;

    console.error("Merchant dish update failed", error);
    return jsonError("Unable to update dish.", 400);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const blocked = requireMerchantMutationProtection(request);
  if (blocked) return blocked;
  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "merchant-menu-delete"),
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const accessToken = await requireMerchantAccessToken();
    const overview = await getMerchantPortalOverview(accessToken);
    const { dishId } = await context.params;
    await supabaseFetch("rest/v1/dishes", {
      accessToken,
      method: "DELETE",
      params: {
        id: `eq.${dishId}`,
        venue_id: overview.outlet.venueId ? `eq.${overview.outlet.venueId}` : undefined,
      },
      prefer: "return=minimal",
    });
    return NextResponse.json(await getMerchantPortalOverview(accessToken));
  } catch (error) {
    console.error("Merchant dish delete failed", error);
    return jsonError("Unable to delete dish.", 400);
  }
}
