import { NextRequest, NextResponse } from "next/server";

type JoiningAs = "diner" | "hawker" | "both";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  "";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ||
  "";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.HUNGRY_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  "";

function normalizeJoiningAs(value: unknown): JoiningAs {
  if (value === "hawker" || value === "merchant") {
    return "hawker";
  }

  if (value === "both") {
    return "both";
  }

  return "diner";
}

function toWaitlistAudience(joiningAs: JoiningAs) {
  if (joiningAs === "hawker") return "merchant";
  if (joiningAs === "both") return "both";
  return "foodie";
}

function getSupabaseRestUrl(path: string, params?: Record<string, string>) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured for the Hungry waitlist.");
  }
  const url = new URL(`${SUPABASE_URL.replace(/\/$/, "")}/${path}`);
  Object.entries(params ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

async function saveWaitlistSubmission(input: {
  email: string;
  establishmentType?: string;
  joiningAs: JoiningAs;
  name?: string;
  req: NextRequest;
}) {
  const requestKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  const response = await fetch(getSupabaseRestUrl("rest/v1/website_waitlist_entries", { on_conflict: "email" }), {
    body: JSON.stringify({
      audience: toWaitlistAudience(input.joiningAs),
      email: input.email,
      establishment_type: input.establishmentType ?? null,
      metadata: {
        referrer: input.req.headers.get("referer") ?? undefined,
        userAgent: input.req.headers.get("user-agent") ?? undefined,
      },
      name: input.name ?? null,
      source: "marketing_web",
      submitted_at: new Date().toISOString(),
    }),
    cache: "no-store",
    headers: {
      apikey: requestKey,
      Authorization: `Bearer ${requestKey}`,
      "Content-Type": "application/json",
      Prefer: SUPABASE_SERVICE_ROLE_KEY
        ? "resolution=merge-duplicates,return=minimal"
        : "return=minimal",
    },
    method: "POST",
  });

  if (!response.ok && response.status !== 409) {
    throw new Error(await response.text());
  }

  return { alreadyExists: response.status === 409 };
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

    const result = await saveWaitlistSubmission({
      email: email.toLowerCase().trim(),
      establishmentType:
        typeof establishment_type === "string" && establishment_type.trim()
          ? establishment_type.trim()
          : undefined,
      joiningAs,
      name: typeof name === "string" && name.trim() ? name.trim() : undefined,
      req,
    });

    if (mode === "form") {
      return redirectToWaitlist(req, "submitted", joiningAs);
    }

    return NextResponse.json({ success: true, already_exists: result.alreadyExists });
  } catch (err) {
    console.error("[waitlist] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ configured: false, count: 0 });
  }

  const response = await fetch(getSupabaseRestUrl("rest/v1/website_waitlist_entries", { select: "id" }), {
    cache: "no-store",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });

  if (!response.ok) {
    return NextResponse.json(
      { configured: true, count: 0, error: "Unable to load waitlist count." },
      { status: 502 },
    );
  }

  const contentRange = response.headers.get("content-range") ?? "";
  const count = Number(contentRange.split("/").at(-1));
  return NextResponse.json({ configured: true, count: Number.isFinite(count) ? count : 0 });
}
