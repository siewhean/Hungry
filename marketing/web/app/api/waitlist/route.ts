import { NextResponse } from "next/server";

const retiredResponse = {
  error: "retired_surface",
  message: "This legacy waitlist endpoint is disabled. Use marketing/website/web-v2.",
};

export async function POST() {
  return NextResponse.json(retiredResponse, { status: 410 });
}

export async function GET() {
  return NextResponse.json(retiredResponse, { status: 410 });
}
