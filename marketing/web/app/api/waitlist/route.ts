import { NextRequest, NextResponse } from "next/server";

// In-memory store for development (replace with Supabase in production)
const waitlist: {
  email: string;
  name?: string;
  joining_as: "diner" | "hawker" | "both";
  created_at: string;
}[] = [];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, joining_as } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Check duplicate
    const existing = waitlist.find((w) => w.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      // Return success (idempotent — user is already on the list)
      return NextResponse.json({ success: true, already_exists: true });
    }

    // Add to list
    waitlist.push({
      email: email.toLowerCase().trim(),
      name: name?.trim() ?? undefined,
      joining_as: joining_as ?? "diner",
      created_at: new Date().toISOString(),
    });

    console.log(`[waitlist] New signup: ${email} (${joining_as})`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[waitlist] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  // Simple health check / count endpoint
  return NextResponse.json({ count: waitlist.length });
}
