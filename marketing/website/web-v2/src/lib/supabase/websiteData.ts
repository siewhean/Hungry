import {
  getSupabaseConfigStatus,
  getUserFromAccessToken,
  isSupabasePublicConfigured,
  isSupabaseServiceConfigured,
  supabaseCount,
  supabaseFetchOnDemand,
  type SupabaseUser,
} from "./server";
import { redactEmail } from "@/lib/console/redaction";

export type WaitlistAudience = "foodie" | "merchant" | "both";

export type WebsiteWaitlistInput = {
  audience: WaitlistAudience;
  businessName?: string;
  email: string;
  establishmentType?: string;
  metadata?: Record<string, unknown>;
  name?: string;
  source: "web_v2" | "marketing_web" | "merchant_portal" | "console" | "unknown";
};

export type ConsoleWaitlistEntry = {
  audience: WaitlistAudience | "both";
  businessName?: string;
  email: string;
  establishmentType?: string;
  id: string;
  metadata?: Record<string, unknown> | null;
  submittedAt: string;
  name?: string;
  source: "web_v2" | "marketing_web" | "merchant_portal" | "console" | "unknown";
  updatedAt: string;
};

export type ConsoleMerchant = {
  accountStatus: "active" | "warned" | "suspended";
  cuisine: string;
  dishCount: number;
  id: string;
  joinedDate: string;
  lastActive: string;
  location: string;
  name: string;
  rating: number;
  registeredEntity?: string;
  teamSize: number;
  type: string;
  uen?: string;
  verificationStatus: "verified" | "in_review" | "rejected" | "not_started" | "more_info_needed";
};

export type MerchantPortalDish = {
  category: string;
  description: string;
  id: string;
  imageUrl: string;
  isFeatured: boolean;
  isSoldOut: boolean;
  name: string;
  price: string;
};

export type MerchantPortalOverview = {
  account: {
    displayName: string;
    email: string;
    id: string;
  };
  analytics: {
    menuClicks: number;
    profileViews: number;
    reviewCount: number;
  };
  configured: boolean;
  dishes: MerchantPortalDish[];
  outlet: {
    buildingId?: string;
    businessType: string;
    contactEmail?: string;
    contactPhone?: string;
    coverPhotoUrl?: string;
    description: string;
    floor?: string;
    id: string;
    isLive: boolean;
    name: string;
    operatingHours: string;
    profilePhotoUrl?: string;
    unitNumber?: string;
    venueId?: string;
  };
  reviews: {
    author: string;
    date: string;
    id: string;
    rating: number;
    replied: boolean;
    replyText?: string;
    text: string;
  }[];
  user: SupabaseUser;
  verificationStatus:
    | "verified"
    | "in_review"
    | "rejected"
    | "not_started"
    | "more_info_needed"
    | "draft"
    | "submitted";
};

type Row = Record<string, unknown>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizeText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 240) : undefined;
}

function sanitizeConsoleMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const metadata: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("email") ||
      normalizedKey.includes("phone") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("secret")
    ) {
      metadata[key] = "[redacted]";
      continue;
    }

    if (typeof rawValue === "string") {
      metadata[key] = EMAIL_REGEX.test(rawValue.trim()) ? redactEmail(rawValue) : rawValue;
      continue;
    }

    metadata[key] = rawValue;
  }

  return metadata;
}

function money(value?: number) {
  return `S$${(value ?? 0).toFixed(2)}`;
}

function hasFlag(row: Row, flag: string) {
  const flags = Array.isArray(row.availability_flags) ? row.availability_flags : [];
  return flags.some((item) => String(item).toLowerCase() === flag);
}

function normalizeBusinessType(value?: string) {
  if (!value) return "Hawker Stall";
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function toConsoleVerificationStatus(value?: string): ConsoleMerchant["verificationStatus"] {
  if (value === "verified") return "verified";
  if (value === "submitted" || value === "in_review" || value === "draft") return "in_review";
  if (value === "rejected") return "rejected";
  if (value === "more_info_needed") return "more_info_needed";
  return "not_started";
}

function formatJoinedDate(value?: string) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-SG", {
    month: "short",
    year: "numeric",
  });
}

function postgrestValue(value: string) {
  return value.replace(/"/g, '\\"');
}

function eq(value: string) {
  return `eq.${postgrestValue(value)}`;
}

export const WAITLIST_NOT_CONFIGURED = "The Hungry website waitlist database is not configured.";

export async function submitWebsiteWaitlist(input: WebsiteWaitlistInput) {
  if (!isSupabasePublicConfigured()) {
    throw new Error(WAITLIST_NOT_CONFIGURED);
  }

  const normalizedEmail = normalizeEmail(input.email);
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new Error("Enter a valid email address.");
  }

  const payload = {
    audience: input.audience,
    business_name: sanitizeText(input.businessName) ?? null,
    email: normalizedEmail,
    establishment_type: sanitizeText(input.establishmentType) ?? null,
    metadata: input.metadata ?? {},
    name: sanitizeText(input.name) ?? null,
    source: input.source,
    submitted_at: new Date().toISOString(),
  };

  if (isSupabaseServiceConfigured()) {
    await supabaseFetchOnDemand<unknown>("rest/v1/website_waitlist_entries", {
      body: payload,
      method: "POST",
      params: { on_conflict: "email" },
      prefer: "resolution=merge-duplicates,return=minimal",
      serviceRole: true,
    });
    return { alreadyExists: false };
  }

  try {
    await supabaseFetchOnDemand<unknown>("rest/v1/website_waitlist_entries", {
      body: payload,
      method: "POST",
      prefer: "return=minimal",
    });
    return { alreadyExists: false };
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return { alreadyExists: true };
    }
    throw error;
  }
}

export async function getConsoleSummary() {
  if (!isSupabaseServiceConfigured()) {
    return {
      configured: false,
      config: getSupabaseConfigStatus(),
      counts: {
        activeMerchants: 0,
        merchantWaitlist: 0,
        openReports: 0,
        pendingVerifications: 0,
        totalWaitlist: 0,
        users: 0,
      },
    };
  }

  const [
    totalWaitlist,
    merchantWaitlist,
    users,
    activeMerchants,
    pendingVerifications,
    openReports,
  ] = await Promise.all([
    supabaseCount("website_waitlist_entries", {}, { serviceRole: true }),
    supabaseCount(
      "website_waitlist_entries",
      { audience: "in.(merchant,both)" },
      { serviceRole: true },
    ),
    supabaseCount("user_profiles", {}, { serviceRole: true }),
    supabaseCount("merchant_accounts", {}, { serviceRole: true }),
    supabaseCount(
      "merchant_verifications",
      { status: "in.(submitted,in_review,more_info_needed,draft)" },
      { serviceRole: true },
    ),
    supabaseCount("content_reports", {}, { serviceRole: true }).catch(() => 0),
  ]);

  return {
    configured: true,
    config: getSupabaseConfigStatus(),
    counts: {
      activeMerchants,
      merchantWaitlist,
      openReports,
      pendingVerifications,
      totalWaitlist,
      users,
    },
  };
}

export async function listConsoleWaitlistEntries(): Promise<{
  configured: boolean;
  entries: ConsoleWaitlistEntry[];
}> {
  if (!isSupabaseServiceConfigured()) {
    return { configured: false, entries: [] };
  }

  const { data: rows } = await supabaseFetchOnDemand<Row[]>("rest/v1/website_waitlist_entries", {
    params: {
      order: "submitted_at.desc",
      select:
        "id,audience,business_name,email,establishment_type,metadata,name,source,submitted_at,updated_at",
      limit: 500,
    },
    serviceRole: true,
  });
  const safeRows = rows ?? [];

  return {
    configured: true,
    entries: safeRows.map((row) => ({
      audience: (asString(row.audience) as WaitlistAudience | "both") ?? "foodie",
      businessName: asString(row.business_name),
      email: asString(row.email) ?? "",
      establishmentType: asString(row.establishment_type),
      id: asString(row.id) ?? "",
      metadata: sanitizeConsoleMetadata(row.metadata),
      name: asString(row.name),
      source: (asString(row.source) as ConsoleWaitlistEntry["source"]) ?? "web_v2",
      submittedAt: asString(row.submitted_at) ?? new Date().toISOString(),
      updatedAt: asString(row.updated_at) ?? "",
    })),
  };
}

export async function clearConsoleWaitlistEntries(): Promise<{ deleted: number }> {
  if (!isSupabaseServiceConfigured()) {
    return { deleted: 0 };
  }

  const preCount = await supabaseCount("website_waitlist_entries", {}, { serviceRole: true });

  await supabaseFetchOnDemand<unknown>("rest/v1/website_waitlist_entries", {
    method: "DELETE",
    params: {
      id: "is.not.null",
    },
    prefer: "return=minimal",
    serviceRole: true,
  });

  const postCount = await supabaseCount("website_waitlist_entries", {}, { serviceRole: true });
  return { deleted: Math.max(0, preCount - postCount) };
}

export async function listConsoleMerchants(): Promise<{
  configured: boolean;
  merchants: ConsoleMerchant[];
}> {
  if (!isSupabaseServiceConfigured()) {
    return { configured: false, merchants: [] };
  }

  const { data: outlets } = await supabaseFetchOnDemand<Row[]>("rest/v1/merchant_outlets", {
    params: {
      order: "created_at.desc",
      select:
        "id,merchant_account_id,venue_id,name,business_type,unit_number,floor,description,is_live,created_at,updated_at",
      limit: 100,
    },
    serviceRole: true,
  });
  const outletRows = Array.isArray(outlets) ? outlets : [];

  const accountIds = Array.from(
    new Set(outletRows.map((outlet) => asString(outlet.merchant_account_id)).filter(Boolean)),
  ) as string[];
  const venueIds = Array.from(
    new Set(outletRows.map((outlet) => asString(outlet.venue_id)).filter(Boolean)),
  ) as string[];
  const outletIds = Array.from(new Set(outletRows.map((outlet) => asString(outlet.id)).filter(Boolean))) as string[];

  const [accountsResult, venuesResult, verificationsResult, dishCounts] = await Promise.all([
    accountIds.length
      ? supabaseFetchOnDemand<Row[]>("rest/v1/merchant_accounts", {
          params: {
            id: `in.(${accountIds.join(",")})`,
            select: "id,display_name,email,created_at,updated_at",
          },
          serviceRole: true,
        })
      : Promise.resolve({ data: [] as Row[], response: new Response() }),
    venueIds.length
      ? supabaseFetchOnDemand<Row[]>("rest/v1/venues", {
          params: {
            id: `in.(${venueIds.map((id) => `"${postgrestValue(id)}"`).join(",")})`,
            select: "id,name,unit_number,floor,rating_avg,review_count",
          },
          serviceRole: true,
        })
      : Promise.resolve({ data: [] as Row[], response: new Response() }),
    outletIds.length
      ? supabaseFetchOnDemand<Row[]>("rest/v1/merchant_verifications", {
          params: {
            outlet_id: `in.(${outletIds.join(",")})`,
            select: "outlet_id,status,verified_at,submitted_at,updated_at",
          },
          serviceRole: true,
        })
      : Promise.resolve({ data: [] as Row[], response: new Response() }),
    Promise.all(
      venueIds.map(async (venueId) => [
        venueId,
        await supabaseCount("dishes", { venue_id: eq(venueId) }, { serviceRole: true }),
      ] as const),
    ),
  ]);

  const accountRows = Array.isArray(accountsResult.data) ? accountsResult.data : [];
  const venueRows = Array.isArray(venuesResult.data) ? venuesResult.data : [];
  const verificationRows = Array.isArray(verificationsResult.data) ? verificationsResult.data : [];
  const accountsById = new Map(accountRows.map((row) => [asString(row.id), row]));
  const venuesById = new Map(venueRows.map((row) => [asString(row.id), row]));
  const verificationsByOutletId = new Map(
    verificationRows.map((row) => [asString(row.outlet_id), row]),
  );
  const dishCountByVenueId = new Map(dishCounts);

  return {
    configured: true,
    merchants: outletRows.map((outlet) => {
      const account = accountsById.get(asString(outlet.merchant_account_id));
      const venue = venuesById.get(asString(outlet.venue_id));
      const verification = verificationsByOutletId.get(asString(outlet.id));
      return {
        accountStatus: "active",
        cuisine: "Listed in Hungry",
        dishCount: dishCountByVenueId.get(asString(outlet.venue_id) ?? "") ?? 0,
        id: asString(outlet.id) ?? "",
        joinedDate: formatJoinedDate(asString(account?.created_at) ?? asString(outlet.created_at)),
        lastActive: "Database synced",
        location: [
          asString(venue?.name),
          asString(outlet.floor) || asString(venue?.floor),
          asString(outlet.unit_number) || asString(venue?.unit_number),
        ]
          .filter(Boolean)
          .join(", "),
        name: asString(outlet.name) ?? asString(account?.display_name) ?? "Hungry merchant",
        rating: asNumber(venue?.rating_avg) ?? 0,
        teamSize: 1,
        type: normalizeBusinessType(asString(outlet.business_type)),
        verificationStatus: toConsoleVerificationStatus(asString(verification?.status)),
      };
    }),
  };
}

export async function getMerchantPortalOverview(accessToken: string): Promise<MerchantPortalOverview> {
  const user = await getUserFromAccessToken(accessToken);

  const { data: directAccounts } = await supabaseFetchOnDemand<Row[]>("rest/v1/merchant_accounts", {
    accessToken,
    params: {
      limit: 1,
      select: "id,user_id,display_name,email,created_at",
      user_id: eq(user.id),
    },
  });

  let account = directAccounts[0];
  if (!account) {
    const { data: roles } = await supabaseFetchOnDemand<Row[]>("rest/v1/merchant_roles", {
      accessToken,
      params: {
        limit: 1,
        select: "merchant_account_id,role",
        user_id: eq(user.id),
      },
    });
    const accountId = asString(roles[0]?.merchant_account_id);
    if (accountId) {
      const { data: accounts } = await supabaseFetchOnDemand<Row[]>("rest/v1/merchant_accounts", {
        accessToken,
        params: {
          id: eq(accountId),
          limit: 1,
          select: "id,user_id,display_name,email,created_at",
        },
      });
      account = accounts[0];
    }
  }

  if (!account) {
    throw new Error("This Supabase user is not linked to a Hungry merchant account.");
  }

  const accountId = asString(account.id) ?? "";
  const { data: outlets } = await supabaseFetchOnDemand<Row[]>("rest/v1/merchant_outlets", {
    accessToken,
    params: {
      merchant_account_id: eq(accountId),
      order: "created_at.asc",
      select:
        "id,merchant_account_id,venue_id,building_id,name,business_type,unit_number,floor,description,operating_hours,is_live,contact_phone,contact_email,profile_photo_url,cover_photo_url,created_at,updated_at",
      limit: 1,
    },
  });
  const outlet = outlets[0];
  if (!outlet) {
    throw new Error("This merchant account does not have a linked outlet yet.");
  }

  const outletId = asString(outlet.id) ?? "";
  const venueId = asString(outlet.venue_id) ?? "";
  const { data: verificationRows } = await supabaseFetchOnDemand<Row[]>("rest/v1/merchant_verifications", {
    accessToken,
    params: {
      outlet_id: eq(outletId),
      select: "outlet_id,status,submitted_at,verified_at,updated_at",
      limit: 1,
    },
  });

  const { data: dishRows } = venueId
    ? await supabaseFetchOnDemand<Row[]>("rest/v1/dishes", {
        accessToken,
        params: {
          order: "created_at.desc",
          select: "id,name,description,image_url,price,taste_tags,availability_flags",
          venue_id: eq(venueId),
        },
      })
    : { data: [] as Row[] };

  const { data: reviewRows } = venueId
    ? await supabaseFetchOnDemand<Row[]>("rest/v1/reviews", {
        accessToken,
        params: {
          order: "created_at.desc",
          select: "id,author_name,rating,text,created_at,merchant_reply_text",
          venue_id: eq(venueId),
          limit: 10,
        },
      })
    : { data: [] as Row[] };

  const profileViews = await supabaseCount(
    "merchant_dish_view_events",
    { outlet_id: eq(outletId) },
    { accessToken },
  ).catch(() => 0);

  return {
    account: {
      displayName: asString(account.display_name) ?? "Hungry merchant",
      email: asString(account.email) ?? asString(user.email) ?? "",
      id: accountId,
    },
    analytics: {
      menuClicks: 0,
      profileViews,
      reviewCount: reviewRows.length,
    },
    configured: true,
    dishes: dishRows.map((row) => ({
      category: asStringArray(row.taste_tags)[0] ?? "Menu",
      description: asString(row.description) ?? "",
      id: asString(row.id) ?? "",
      imageUrl: asString(row.image_url) ?? "",
      isFeatured: hasFlag(row, "featured"),
      isSoldOut: hasFlag(row, "sold_out"),
      name: asString(row.name) ?? "Untitled dish",
      price: money(asNumber(row.price)),
    })),
    outlet: {
      buildingId: asString(outlet.building_id),
      businessType: asString(outlet.business_type) ?? "hawker_stall",
      contactEmail: asString(outlet.contact_email),
      contactPhone: asString(outlet.contact_phone),
      coverPhotoUrl: asString(outlet.cover_photo_url),
      description: asString(outlet.description) ?? "",
      floor: asString(outlet.floor),
      id: outletId,
      isLive: Boolean(outlet.is_live),
      name: asString(outlet.name) ?? asString(account.display_name) ?? "Hungry merchant",
      operatingHours: asString(outlet.operating_hours) ?? "",
      profilePhotoUrl: asString(outlet.profile_photo_url),
      unitNumber: asString(outlet.unit_number),
      venueId,
    },
    reviews: reviewRows.map((row) => ({
      author: asString(row.author_name) ?? "Hungry diner",
      date: asString(row.created_at) ?? new Date().toISOString(),
      id: asString(row.id) ?? "",
      rating: asNumber(row.rating) ?? 0,
      replied: Boolean(asString(row.merchant_reply_text)),
      replyText: asString(row.merchant_reply_text),
      text: asString(row.text) ?? "",
    })),
    user,
    verificationStatus: (asString(verificationRows[0]?.status) as MerchantPortalOverview["verificationStatus"]) ?? "not_started",
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}
