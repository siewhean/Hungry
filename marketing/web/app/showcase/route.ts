import type { NextRequest } from "next/server";

import { stitchResponse } from "../_stitch/stitchResponse";

export async function GET(request: NextRequest) {
  return stitchResponse("06-app-mockup-showcase-81475fc2ccb74916a02d59864f7ce1cd.html", request);
}
