import type { NextRequest } from "next/server";

import { stitchResponse } from "../../_stitch/stitchResponse";

export async function GET(request: NextRequest) {
  return stitchResponse("11-stall-profile-editor-dab9af68b47d4835866c29bca8ccd535.html", request);
}
