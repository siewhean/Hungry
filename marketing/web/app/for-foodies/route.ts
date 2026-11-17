import type { NextRequest } from "next/server";

import { stitchForFoodiesWithVisualHeroResponse } from "../_stitch/stitchResponse";

export async function GET(request: NextRequest) {
  return stitchForFoodiesWithVisualHeroResponse(request);
}
