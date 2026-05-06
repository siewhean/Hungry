import type { NextRequest } from "next/server";

import { stitchResponse } from "../_stitch/stitchResponse";

export async function GET(request: NextRequest) {
  return stitchResponse("03-about-hungry-448b7cd38b77430dbe06f68e169472fd.html", request);
}
