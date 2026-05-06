import type { NextRequest } from "next/server";

import { stitchResponse } from "./_stitch/stitchResponse";

export async function GET(request: NextRequest) {
  return stitchResponse("05-for-foodies-81f90fcdc4734ad2829458ba7829af64.html", request);
}
