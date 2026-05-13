import type { NextRequest } from "next/server";

import { stitchResponse } from "../../_stitch/stitchResponse";

export async function GET(request: NextRequest) {
  return stitchResponse("09-menu-management-f0505749325f4fc18f177058b88c6573.html", request);
}
