import { NextRequest, NextResponse } from "next/server";

import { writeMerchantAuditLog } from "@/lib/merchantPortal/audit";
import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { getBooleanField, getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import { supabaseFetch } from "@/lib/supabase/server";
import { getMerchantPortalOverview } from "@/lib/supabase/websiteData";
import { requireMerchantAccessToken, requireMerchantMutationProtection } from "../_session";

function priceToNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function flagsFromBody(body: Record<string, unknown>) {
  const flags: string[] = [];
  if (getBooleanField(body, "isSoldOut") === true) flags.push("sold_out");
  if (getBooleanField(body, "isFeatured") === true) flags.push("featured");
  return flags;
}

export async function GET() {
  try {
    const accessToken = await requireMerchantAccessToken();
    const overview = await getMerchantPortalOverview(accessToken);
    return NextResponse.json({ dishes: overview.dishes });
  } catch {
    return jsonError("Merchant sign-in is required.", 401);
  }
}

export async function POST(request: NextRequest) {
  const blocked = requireMerchantMutationProtection(request);
  if (blocked) return blocked;
  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "merchant-menu-create"),
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const accessToken = await requireMerchantAccessToken();
    const overview = await getMerchantPortalOverview(accessToken);
    const body = await readJsonObject(request, 32_768);
    const name = getStringField(body, "name", { max: 120, min: 1, required: true });
    const category = getStringField(body, "category", { max: 80 });
    if (!name) throw new Error("Dish name is required.");
    if (!overview.outlet.venueId || !overview.outlet.buildingId) {
      throw new Error("Merchant outlet is not linked to an app venue/building.");
    }
    const dishId = `web-${crypto.randomUUID()}`;

    await supabaseFetch("rest/v1/dishes", {
      accessToken,
      body: {
        availability_flags: flagsFromBody(body),
        building_id: overview.outlet.buildingId,
        description: getStringField(body, "description", { max: 1_200 }) ?? "",
        id: dishId,
        image_url: getStringField(body, "imageUrl", { max: 2_048 }) ?? null,
        name,
        price: priceToNumber(body.price),
        price_range: getStringField(body, "price", { max: 40 }) ?? "",
        taste_tags: category ? [category] : [],
        venue_id: overview.outlet.venueId,
      },
      method: "POST",
      prefer: "return=minimal",
    });

    await writeMerchantAuditLog({
      action: "menu_dish_created",
      metadata: { hasImage: Boolean(getStringField(body, "imageUrl", { max: 2_048 })), name },
      overview,
      targetId: dishId,
      targetType: "dish",
    });

    return NextResponse.json(await getMerchantPortalOverview(accessToken), { status: 201 });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;

    if (error instanceof Error && error.message === "Dish name is required.") {
      return jsonError(error.message, 400);
    }

    console.error("Merchant dish create failed", error);
    return jsonError("Unable to add dish.", 400);
  }
}
