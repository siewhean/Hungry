import type { NextRequest } from "next/server";

import { stitchResponse } from "../../_stitch/stitchResponse";

export async function GET(request: NextRequest) {
  return stitchResponse("10-opening-hours-editor-a8aefac410fb476f9b072cddbe8e0192.html", request);
}
