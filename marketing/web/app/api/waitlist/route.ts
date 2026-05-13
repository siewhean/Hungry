import { NextRequest, NextResponse } from "next/server";

type JoiningAs = "diner" | "hawker" | "both";

const waitlist: {
  email: string;
  name?: string;
  establishment_type?: string;
  joining_as: JoiningAs;
  created_at: string;
}[] = [];

function normalizeJoiningAs(value: unknown): JoiningAs {
  if (value === "hawker" || value === "merchant") {
    return "hawker";
  }

  if (value === "both") {
    return "both";
  }

  return "diner";
}

async function parseSubmission(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await req.formData();

    return {
      email: formData.get("email"),
      name: formData.get("name"),
      establishment_type: formData.get("establishment_type"),
      joining_as: formData.get("joining_as"),
      mode: "form" as const,
    };
  }

  const body = await req.json();

  return {
    email: body.email,
    name: body.name,
    establishment_type: body.establishment_type,
    joining_as: body.joining_as,
    mode: "json" as const,
  };
}

function redirectToWaitlist(
  req: NextRequest,
  status: "submitted" | ("name" | "email" | "establishment")[],
  joiningAs?: JoiningAs,
) {
  const url = new URL("/join-waitlist", req.url);
  if (joiningAs === "hawker" || joiningAs === "both") {
    url.searchParams.set("joining_as", joiningAs);
  }

  if (status === "submitted") {
    url.searchParams.set("submitted", "1");
  } else {
    url.searchParams.set("error", status.join(","));
  }

  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(req: NextRequest) {
  try {
    const submission = await parseSubmission(req);
    const { email, name, establishment_type, mode } = submission;
    const joiningAs = normalizeJoiningAs(submission.joining_as);
    const errors: ("name" | "email" | "establishment")[] = [];

    if (typeof name !== "string" || !name.trim()) {
      errors.push("name");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || !emailRegex.test(email)) {
      errors.push("email");
    }

    const needsEstablishment = joiningAs === "hawker" || joiningAs === "both";
    if (
      needsEstablishment &&
      (typeof establishment_type !== "string" || !establishment_type.trim())
    ) {
      errors.push("establishment");
    }

    if (errors.length > 0) {
      return mode === "form"
        ? redirectToWaitlist(req, errors, joiningAs)
        : NextResponse.json({ errors }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = waitlist.find((entry) => entry.email === normalizedEmail);

    if (!existing) {
      waitlist.push({
        email: normalizedEmail,
        name: typeof name === "string" && name.trim() ? name.trim() : undefined,
        establishment_type:
          typeof establishment_type === "string" && establishment_type.trim()
            ? establishment_type.trim()
            : undefined,
        joining_as: joiningAs,
        created_at: new Date().toISOString(),
      });
    }

    if (mode === "form") {
      return redirectToWaitlist(req, "submitted", joiningAs);
    }

    return NextResponse.json({ success: true, already_exists: Boolean(existing) });
  } catch (err) {
    console.error("[waitlist] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ count: waitlist.length });
}
