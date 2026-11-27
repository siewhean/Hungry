import {
  getConsoleRouteBySection,
  isConsoleRole,
  roleCanAccess,
  type ConsoleRole,
  type ConsoleRouteStatus,
} from "@/lib/console/routeRegistry";
import { redactEmail } from "@/lib/console/redaction";
import { sendClaimNotApprovedEmail, sendMerchantApprovalEmail } from "@/lib/email/merchantApprovalEmail";
import {
  createStorageSignedUrls,
  getSupabaseConfigStatus,
  getUserFromAccessToken,
  isSupabaseServiceConfigured,
  supabaseFetchOnDemand,
} from "./server";
import {
  getConsoleSummary,
  listConsoleMerchants,
  listConsoleWaitlistEntries,
} from "./websiteData";

type Row = Record<string, unknown>;

export type ConsoleActor = {
  adminId?: string;
  authMode: "supabase" | "basic";
  email: string;
  id: string;
  role: ConsoleRole;
  status: "active" | "suspended";
  userId?: string;
};

export type ConsoleRecord = {
  id: string;
  metadata?: Record<string, string | number | boolean | null>;
  status?: string;
  subtitle?: string;
  title: string;
  updatedAt?: string;
};

export type ConsoleMetric = {
  detail?: string;
  label: string;
  value: string;
};

export type ConsoleRouteDataset = {
  actor?: Pick<ConsoleActor, "authMode" | "email" | "role" | "status">;
  canMutate: boolean;
  configured: boolean;
  dataSources: string[];
  emptyMessage: string;
  emptyTitle: string;
  metrics: ConsoleMetric[];
  purpose: string;
  records: ConsoleRecord[];
  routeStatus: Exclude<ConsoleRouteStatus, "hidden">;
  section: string;
  title: string;
  warnings: string[];
};

type AuditInput = {
  action: string;
  metadata?: Record<string, unknown>;
  targetId?: string;
  targetType: string;
};

const READ_LIMIT = 30;

function asRowArray(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((row): row is Row => Boolean(row) && typeof row === "object" && !Array.isArray(row)) : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asRedactedEmail(value: unknown): string | undefined {
  const email = asString(value);
  return email ? redactEmail(email) : undefined;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-SG").format(value);
}

function postgrestValue(value: string) {
  return value.replace(/"/g, '\\"');
}

function eq(value: string) {
  return `eq.${postgrestValue(value)}`;
}

function cleanMetadata(row: Row, keys: string[]) {
  const metadata: Record<string, string | number | boolean | null> = {};
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      metadata[key] = key.toLowerCase().includes("email") ? redactEmail(value) : value.slice(0, 160);
    } else if (typeof value === "number" || typeof value === "boolean") {
      metadata[key] = value;
    }
  }
  return Object.keys(metadata).length ? metadata : undefined;
}

function recordFromRow(row: Row, options: {
  idKeys?: string[];
  metadataKeys?: string[];
  statusKeys?: string[];
  subtitleKeys?: string[];
  titleKeys?: string[];
  updatedKeys?: string[];
} = {}): ConsoleRecord {
  const id =
    options.idKeys?.map((key) => asString(row[key])).find(Boolean) ??
    asString(row.id) ??
    asString(row.user_id) ??
    "unknown";
  const title =
    options.titleKeys?.map((key) => asString(row[key])).find(Boolean) ??
    asString(row.name) ??
    asString(row.display_name) ??
    asRedactedEmail(row.email) ??
    id;
  const subtitle =
    options.subtitleKeys?.map((key) => asString(row[key])).find(Boolean) ??
    asString(row.description) ??
    asString(row.reason);
  const status =
    options.statusKeys?.map((key) => asString(row[key])).find(Boolean) ??
    asString(row.status);
  const updatedAt =
    options.updatedKeys?.map((key) => asString(row[key])).find(Boolean) ??
    asString(row.updated_at) ??
    asString(row.created_at);

  return {
    id,
    metadata: cleanMetadata(row, options.metadataKeys ?? ["email", "audience", "source", "role", "status"]),
    status,
    subtitle,
    title,
    updatedAt,
  };
}

async function fetchRows(
  table: string,
  select = "*",
  params: Record<string, string | number> = {},
): Promise<{ records: ConsoleRecord[]; warning?: string }> {
  if (!isSupabaseServiceConfigured()) return { records: [] };

  try {
    const { data } = await supabaseFetchOnDemand<Row[]>(`rest/v1/${table}`, {
      params: {
        limit: READ_LIMIT,
        order: "created_at.desc",
        select,
        ...params,
      },
      serviceRole: true,
    });
    return { records: asRowArray(data).map((row) => recordFromRow(row)) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Supabase error";
    return { records: [], warning: `${table}: ${message}` };
  }
}

export function createBasicConsoleActor(): ConsoleActor {
  return {
    authMode: "basic",
    email: "basic-auth-console@hungry.local",
    id: "basic-auth-console",
    role: "admin",
    status: "active",
  };
}

export async function resolveConsoleActorFromBearer(accessToken: string): Promise<ConsoleActor> {
  if (!isSupabaseServiceConfigured()) {
    throw new Error("Console Supabase service role is not configured.");
  }

  const user = await getUserFromAccessToken(accessToken);
  const { data } = await supabaseFetchOnDemand<Row[]>("rest/v1/website_console_admins", {
    params: {
      limit: 1,
      select: "id,user_id,email,role,status",
      user_id: eq(user.id),
    },
    serviceRole: true,
  });
  const admin = asRowArray(data)[0];
  const role = asString(admin?.role);
  const status = asString(admin?.status);

  if (!admin || !isConsoleRole(role)) {
    throw new Error("This Supabase user is not a Hungry console admin.");
  }
  if (status !== "active") {
    throw new Error("This Hungry console admin is not active.");
  }

  return {
    adminId: asString(admin.id),
    authMode: "supabase",
    email: asString(admin.email) ?? asString(user.email) ?? "console-user@hungry.local",
    id: asString(admin.id) ?? user.id,
    role,
    status,
    userId: user.id,
  };
}

export async function recordConsoleAuditEvent(actor: ConsoleActor, input: AuditInput) {
  if (!isSupabaseServiceConfigured()) return;

  await supabaseFetchOnDemand<unknown>("rest/v1/website_console_audit_events", {
    body: {
      action: input.action,
      actor_email: actor.email,
      actor_user_id: actor.userId ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        actorRole: actor.role,
        authMode: actor.authMode,
      },
      target_id: input.targetId ?? null,
      target_type: input.targetType,
    },
    method: "POST",
    prefer: "return=minimal",
    serviceRole: true,
  });
}

async function getAuditRecords() {
  const { records, warning } = await fetchRows(
    "website_console_audit_events",
    "id,actor_email,action,target_type,target_id,metadata,created_at",
    { order: "created_at.desc" },
  );
  return { records, warning };
}

async function getTeamRecords() {
  const { records, warning } = await fetchRows(
    "website_console_admins",
    "id,user_id,email,role,status,created_at,updated_at",
    { order: "updated_at.desc" },
  );
  return { records, warning };
}

async function getUserRecords() {
  const { records, warning } = await fetchRows(
    "user_profiles",
    "id,user_id,email,display_name,username,created_at,updated_at",
    { order: "updated_at.desc" },
  );
  return { records, warning };
}

const CLAIM_SELECT =
  "id,venue_id,contact_name,contact_email,contact_phone,uen,notes,status,created_at,updated_at";

/** Stall claims with the stall's name, so ops can see what is being claimed. */
async function getMerchantClaimRecords(): Promise<{ records: ConsoleRecord[]; warning?: string }> {
  if (!isSupabaseServiceConfigured()) return { records: [] };

  try {
    const { data } = await supabaseFetchOnDemand<Row[]>("rest/v1/merchant_claim_interests", {
      params: { limit: READ_LIMIT, order: "created_at.desc", select: CLAIM_SELECT },
      serviceRole: true,
    });
    const claims = asRowArray(data);
    const venueIds = Array.from(
      new Set(claims.map((row) => asString(row.venue_id)).filter((id): id is string => Boolean(id))),
    );
    const names = new Map<string, string>();
    if (venueIds.length > 0) {
      // One read for every stall name, not one per claim.
      const { data: venues } = await supabaseFetchOnDemand<Row[]>("rest/v1/venues", {
        params: {
          id: `in.(${venueIds.map((id) => `"${postgrestValue(id)}"`).join(",")})`,
          select: "id,name,unit_number",
        },
        serviceRole: true,
      });
      for (const venue of asRowArray(venues)) {
        const id = asString(venue.id);
        if (id) {
          names.set(id, [asString(venue.name), asString(venue.unit_number)].filter(Boolean).join(" "));
        }
      }
    }
    return {
      records: claims.map((row) => {
        const venueId = asString(row.venue_id) ?? "";
        const contact = [asString(row.contact_name), asRedactedEmail(row.contact_email)]
          .filter(Boolean)
          .join(" • ");
        return {
          id: asString(row.id) ?? "unknown",
          metadata: {
            kind: "claim",
            ...cleanMetadata(row, ["contact_email", "contact_phone", "uen", "notes"]),
          },
          status: asString(row.status),
          subtitle: contact || undefined,
          title: names.get(venueId) || venueId || "Unknown stall",
          updatedAt: asString(row.updated_at) ?? asString(row.created_at),
        };
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Supabase error";
    return { records: [], warning: `merchant_claim_interests: ${message}` };
  }
}

async function getMerchantApplicationRecords() {
  const [verifications, claims] = await Promise.all([
    fetchRows(
      "merchant_verifications",
      "id,outlet_id,status,method,submitted_at,updated_at,verified_at",
      { order: "updated_at.desc" },
    ),
    getMerchantClaimRecords(),
  ]);

  return {
    records: [...claims.records, ...verifications.records].slice(0, READ_LIMIT * 2),
    warnings: [verifications.warning, claims.warning].filter(Boolean) as string[],
  };
}

/** Emails (where the claim has one) of the open claims the approval just rejected. */
async function rejectedRivals(rivals: Row[]): Promise<string[]> {
  const ids = rivals.map((row) => row.id).filter((id): id is string => typeof id === "string");
  if (ids.length === 0) return [];
  const { data } = await supabaseFetchOnDemand<Row[]>("rest/v1/merchant_claim_interests", {
    params: { id: `in.(${ids.join(",")})`, select: "id", status: eq("rejected") },
    serviceRole: true,
  });
  const rejected = new Set((data ?? []).map((row) => row.id));
  return rivals
    .filter((row) => rejected.has(row.id))
    .map((row) => (typeof row.contact_email === "string" ? row.contact_email.trim() : ""))
    .filter(Boolean);
}

export type MerchantClaimAction = "approve" | "reject" | "contacted";

/** A claim could not be changed because it is already approved (the route answers 409). */
export class MerchantClaimConflictError extends Error {}

/**
 * Ops decide a claim by hand. Approving runs approve_merchant_claim, which creates the merchant
 * account, owner role and outlet in one transaction (and is safe to repeat), then emails the
 * claimant once. The other actions only move the status, and never touch a claim that is
 * already approved.
 */
export async function reviewMerchantClaim(
  actor: ConsoleActor,
  claimId: string,
  action: MerchantClaimAction,
) {
  if (action === "approve") {
    // Other people's open claims on this stall are rejected by the approval. Note them first so
    // each can be told (two reads for the whole stall, not one per claimant).
    const { data: thisClaim } = await supabaseFetchOnDemand<Row[]>("rest/v1/merchant_claim_interests", {
      params: { id: eq(claimId), select: "venue_id" },
      serviceRole: true,
    });
    const venueId = typeof thisClaim?.[0]?.venue_id === "string" ? thisClaim[0].venue_id : undefined;
    const { data: rivals } = venueId
      ? await supabaseFetchOnDemand<Row[]>("rest/v1/merchant_claim_interests", {
          params: {
            id: `neq.${claimId}`,
            select: "id,contact_email",
            status: "in.(new,contacted,qualified)",
            venue_id: eq(venueId),
          },
          serviceRole: true,
        })
      : { data: [] as Row[] };

    const { data } = await supabaseFetchOnDemand<unknown>("rest/v1/rpc/approve_merchant_claim", {
      body: { p_claim_id: claimId },
      method: "POST",
      serviceRole: true,
    });
    const { email, venueName, ...approval } =
      data && typeof data === "object" ? (data as Record<string, unknown>) : ({} as Record<string, unknown>);
    // The claimant's email goes to the claimant only: it stays out of the audit log and the reply.
    await recordConsoleAuditEvent(actor, {
      action: "merchant_claim_approved",
      metadata: approval,
      targetId: claimId,
      targetType: "merchant_claim",
    });
    const alreadyApproved = approval.alreadyApproved === true;
    const emailSent =
      !alreadyApproved &&
      typeof email === "string" &&
      (await sendMerchantApprovalEmail({
        stallName: typeof venueName === "string" ? venueName : undefined,
        to: email,
      }));
    const rivalsToTell = alreadyApproved ? [] : await rejectedRivals(rivals ?? []);
    const rivalEmailsSent = (
      await Promise.all(
        rivalsToTell.map((to) =>
          sendClaimNotApprovedEmail({ stallName: typeof venueName === "string" ? venueName : undefined, to }),
        ),
      )
    ).filter(Boolean).length;
    return { ...approval, emailSent, rivalEmailsSent, rivalsRejected: rivalsToTell.length };
  }

  const status = action === "reject" ? "rejected" : "contacted";
  const { data: changed } = await supabaseFetchOnDemand<unknown[]>("rest/v1/merchant_claim_interests", {
    body: { status, status_updated_at: new Date().toISOString() },
    method: "PATCH",
    params: { id: eq(claimId), select: "id", status: "neq.converted" },
    prefer: "return=representation",
    serviceRole: true,
  });
  if (!Array.isArray(changed) || changed.length === 0) {
    throw new MerchantClaimConflictError(
      "This claim is already approved or no longer exists, so it was not changed.",
    );
  }
  await recordConsoleAuditEvent(actor, {
    action: `merchant_claim_${status}`,
    metadata: { status },
    targetId: claimId,
    targetType: "merchant_claim",
  });
  return { status };
}

export type DishDraftDecision = "edit" | "accepted" | "rejected" | "duplicate";
export type DishDraftPriceBasis = "counter" | "menu" | "delivery";
export type DishDraftHalalStatus = "yes" | "no" | "unknown";

export class DishDraftConflictError extends Error {}

const DRAFT_SELECT =
  "id,venue_id,building_id,source_photo_id,name,price_cents,currency,modifiers,extraction_confidence,review_status,review_notes,promoted_dish_id,created_at,updated_at";
const OPEN_DRAFT_PAGE_SIZE = 40;
const STALE_DRAFT_CLAIM_MS = 60_000;

interface StoredOpsDraftMeta {
  __ops_edit: 1;
  description?: string | null;
  halalStatus?: DishDraftHalalStatus;
  priceBasis?: DishDraftPriceBasis | null;
}

function extractOpsMeta(modifiers: unknown): {
  meta: StoredOpsDraftMeta | null;
  stringModifiers: string[];
} {
  if (!Array.isArray(modifiers)) return { meta: null, stringModifiers: [] };
  const stringModifiers: string[] = [];
  let meta: StoredOpsDraftMeta | null = null;
  for (const item of modifiers) {
    if (typeof item === "string") {
      stringModifiers.push(item);
    } else if (
      item &&
      typeof item === "object" &&
      (item as Record<string, unknown>).__ops_edit === 1
    ) {
      meta = item as StoredOpsDraftMeta;
    }
  }
  return { meta, stringModifiers };
}

function mergeOpsMeta(
  existingModifiers: unknown,
  input: {
    description?: string | null;
    halalStatus?: DishDraftHalalStatus;
    priceBasis?: DishDraftPriceBasis;
  },
): unknown[] {
  const { meta, stringModifiers } = extractOpsMeta(existingModifiers);
  const nextMeta: StoredOpsDraftMeta = {
    __ops_edit: 1,
    description:
      input.description !== undefined ? input.description : (meta?.description ?? null),
    halalStatus:
      input.halalStatus !== undefined ? input.halalStatus : (meta?.halalStatus ?? "unknown"),
    priceBasis:
      input.priceBasis !== undefined ? input.priceBasis : (meta?.priceBasis ?? null),
  };
  return [...stringModifiers, nextMeta];
}

function mapPriceBasisToConfidence(basis?: DishDraftPriceBasis | null): string | null {
  if (basis === "counter") return "counter_price";
  if (basis === "delivery") return "delivery_price";
  if (basis === "menu") return "listed_price";
  return null;
}

async function getStallSubmissionRecords(offset = 0): Promise<{
  hasMoreOpenDrafts: boolean;
  openDraftsLoaded: number;
  records: ConsoleRecord[];
  warnings: string[];
}> {
  if (!isSupabaseServiceConfigured()) {
    return { hasMoreOpenDrafts: false, openDraftsLoaded: 0, records: [], warnings: [] };
  }

  const warnings: string[] = [];
  const safeOffset = Math.max(0, Math.min(10_000, offset));

  const [openResult, closedResult, changeRequestsResult] = await Promise.all([
    supabaseFetchOnDemand<Row[]>("rest/v1/dishes_draft", {
      params: {
        limit: OPEN_DRAFT_PAGE_SIZE + 1,
        offset: safeOffset,
        order: "created_at.asc,id.asc",
        review_status: "in.(pending,edited,accepted)",
        select: DRAFT_SELECT,
      },
      serviceRole: true,
    }).catch((error: unknown) => {
      warnings.push(
        `dishes_draft (open): ${error instanceof Error ? error.message : "Unknown Supabase error"}`,
      );
      return { data: [] as Row[] };
    }),
    safeOffset === 0
      ? supabaseFetchOnDemand<Row[]>("rest/v1/dishes_draft", {
          params: {
            limit: 15,
            order: "updated_at.desc,id.desc",
            review_status: "in.(promoted,rejected,duplicate)",
            select: DRAFT_SELECT,
          },
          serviceRole: true,
        }).catch(() => ({ data: [] as Row[] }))
      : Promise.resolve({ data: [] as Row[] }),
    safeOffset === 0
      ? fetchRows("merchant_change_requests")
      : Promise.resolve<{ records: ConsoleRecord[]; warning?: string }>({ records: [] }),
  ]);

  if (changeRequestsResult.warning) warnings.push(changeRequestsResult.warning);

  const rawOpen = asRowArray(openResult.data);
  const hasMoreOpenDrafts = rawOpen.length > OPEN_DRAFT_PAGE_SIZE;
  const openDrafts = rawOpen.slice(0, OPEN_DRAFT_PAGE_SIZE);
  const closedDrafts = asRowArray(closedResult.data);
  const drafts = [...openDrafts, ...closedDrafts];

  const venueIds = Array.from(
    new Set(drafts.map((row) => asString(row.venue_id)).filter((id): id is string => Boolean(id))),
  );
  const photoIds = Array.from(
    new Set(
      drafts.map((row) => asString(row.source_photo_id)).filter((id): id is string => Boolean(id)),
    ),
  );

  const venueLabels = new Map<string, string>();
  if (venueIds.length > 0) {
    try {
      const { data: venues } = await supabaseFetchOnDemand<Row[]>("rest/v1/venues", {
        params: {
          id: `in.(${venueIds.map((id) => `"${postgrestValue(id)}"`).join(",")})`,
          select: "id,name,unit_number",
        },
        serviceRole: true,
      });
      for (const venue of asRowArray(venues)) {
        const id = asString(venue.id);
        if (id) {
          venueLabels.set(
            id,
            [asString(venue.name), asString(venue.unit_number)].filter(Boolean).join(" "),
          );
        }
      }
    } catch (error) {
      warnings.push(`venues: ${error instanceof Error ? error.message : "Unknown Supabase error"}`);
    }
  }

  const signedPhotoBySubmissionId = new Map<string, string>();
  if (photoIds.length > 0) {
    try {
      const { data: submissions } = await supabaseFetchOnDemand<Row[]>(
        "rest/v1/menu_photo_submissions",
        {
          params: {
            id: `in.(${photoIds.map((id) => `"${postgrestValue(id)}"`).join(",")})`,
            select: "id,storage_bucket,storage_path",
          },
          serviceRole: true,
        },
      );
      const byBucket = new Map<string, Array<{ id: string; path: string }>>();
      for (const sub of asRowArray(submissions)) {
        const id = asString(sub.id);
        const bucket = asString(sub.storage_bucket) ?? "menu-photos";
        const path = asString(sub.storage_path);
        if (!id || !path) continue;
        const list = byBucket.get(bucket) ?? [];
        list.push({ id, path });
        byBucket.set(bucket, list);
      }
      for (const [bucket, items] of byBucket.entries()) {
        const urls = await createStorageSignedUrls(
          bucket,
          items.map((item) => item.path),
          3600,
        );
        for (const item of items) {
          const url = urls.get(item.path);
          if (url) signedPhotoBySubmissionId.set(item.id, url);
        }
      }
    } catch (error) {
      warnings.push(
        `menu_photo_submissions: ${error instanceof Error ? error.message : "Unknown Supabase error"}`,
      );
    }
  }

  const draftRecords: ConsoleRecord[] = drafts.map((row) => {
    const id = asString(row.id) ?? "unknown";
    const venueId = asString(row.venue_id) ?? "";
    const photoId = asString(row.source_photo_id) ?? "";
    const priceCents = typeof row.price_cents === "number" ? row.price_cents : null;
    const priceLabel =
      priceCents !== null && priceCents > 0
        ? `S$${(priceCents / 100).toFixed(2)}`
        : "Price not listed";
    const stallLabel = venueLabels.get(venueId) || venueId || "Unknown stall";
    const signedUrl = photoId ? signedPhotoBySubmissionId.get(photoId) : undefined;
    const { meta } = extractOpsMeta(row.modifiers);
    const fullNotes = asString(row.review_notes)?.slice(0, 2000) ?? null;

    return {
      id,
      metadata: {
        kind: "dish_draft",
        venue_id: venueId || null,
        price_cents: priceCents,
        price_basis: meta?.priceBasis ?? null,
        halal_status: meta?.halalStatus ?? null,
        draft_description: meta?.description ?? null,
        confidence:
          typeof row.extraction_confidence === "number" ||
          typeof row.extraction_confidence === "string"
            ? String(row.extraction_confidence)
            : null,
        promoted_dish_id: asString(row.promoted_dish_id) ?? null,
        review_notes: fullNotes,
        source_photo_url: signedUrl ?? null,
      },
      status: asString(row.review_status) ?? "pending",
      subtitle: `${stallLabel} • ${priceLabel}`,
      title: asString(row.name) ?? id,
      updatedAt: asString(row.updated_at) ?? asString(row.created_at),
    };
  });

  return {
    hasMoreOpenDrafts,
    openDraftsLoaded: openDrafts.length,
    records: [...draftRecords, ...changeRequestsResult.records],
    warnings,
  };
}

export async function reviewDishDraft(
  actor: ConsoleActor,
  draftId: string,
  input: {
    decision: DishDraftDecision;
    description?: string | null;
    halalStatus?: DishDraftHalalStatus;
    name?: string;
    notes?: string;
    priceBasis?: DishDraftPriceBasis;
    priceCents?: number | null;
  },
) {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const trimmedName = input.name?.trim();
  const normalizedName = trimmedName ? trimmedName.toLowerCase().replace(/\s+/g, " ") : undefined;
  const trimmedNotes = input.notes?.trim() ? input.notes.trim().slice(0, 2000) : undefined;

  if (input.decision === "edit") {
    const { data: currentRows } = await supabaseFetchOnDemand<Row[]>("rest/v1/dishes_draft", {
      params: {
        id: eq(draftId),
        review_status: "in.(pending,edited)",
        select: "id,modifiers,updated_at",
      },
      serviceRole: true,
    });
    const current = asRowArray(currentRows)[0];
    if (!current) {
      throw new DishDraftConflictError("This draft has already been finalised or no longer exists.");
    }

    const patch: Row = {
      modifiers: mergeOpsMeta(current.modifiers, {
        description: input.description,
        halalStatus: input.halalStatus,
        priceBasis: input.priceBasis,
      }),
      review_status: "edited",
      updated_at: nowIso,
    };
    if (trimmedName) {
      patch.name = trimmedName;
      patch.name_normalized = normalizedName;
    }
    if (input.priceCents !== undefined) patch.price_cents = input.priceCents;
    if (trimmedNotes !== undefined) patch.review_notes = trimmedNotes;

    const patchParams: Record<string, string> = {
      id: eq(draftId),
      review_status: "in.(pending,edited)",
      select: "id",
    };
    const priorUpdatedAt = asString(current.updated_at);
    if (priorUpdatedAt) patchParams.updated_at = eq(priorUpdatedAt);

    const { data: updated } = await supabaseFetchOnDemand<Row[]>("rest/v1/dishes_draft", {
      body: patch,
      method: "PATCH",
      params: patchParams,
      prefer: "return=representation",
      serviceRole: true,
    });
    if (!Array.isArray(updated) || updated.length === 0) {
      throw new DishDraftConflictError("This draft was modified concurrently or already finalised.");
    }
    await recordConsoleAuditEvent(actor, {
      action: "dish_draft_edited",
      metadata: { editedName: Boolean(trimmedName), editedPrice: input.priceCents !== undefined },
      targetId: draftId,
      targetType: "dishes_draft",
    }).catch((err) => console.error("Console audit write failed after draft edit", err));
    return { status: "edited" };
  }

  if (input.decision === "rejected" || input.decision === "duplicate") {
    const { data: updated } = await supabaseFetchOnDemand<Row[]>("rest/v1/dishes_draft", {
      body: {
        review_notes: trimmedNotes,
        review_status: input.decision,
        reviewed_at: nowIso,
      },
      method: "PATCH",
      params: { id: eq(draftId), review_status: "in.(pending,edited)", select: "id" },
      prefer: "return=representation",
      serviceRole: true,
    });
    if (!Array.isArray(updated) || updated.length === 0) {
      throw new DishDraftConflictError("This draft has already been finalised or no longer exists.");
    }
    await recordConsoleAuditEvent(actor, {
      action: `dish_draft_${input.decision}`,
      metadata: { decision: input.decision },
      targetId: draftId,
      targetType: "dishes_draft",
    }).catch((err) => console.error("Console audit write failed after draft rejection", err));
    return { status: input.decision };
  }

  // Exclusive claim: only pending/edited (or a crashed accepted claim older than 60s) can be claimed,
  // preventing two concurrent operators from racing on the same draft.
  const staleCutoffIso = new Date(nowMs - STALE_DRAFT_CLAIM_MS).toISOString();
  const claimPatch: Row = {
    review_status: "accepted",
    reviewed_at: nowIso,
  };
  if (trimmedName) {
    claimPatch.name = trimmedName;
    claimPatch.name_normalized = normalizedName;
  }
  if (input.priceCents !== undefined) claimPatch.price_cents = input.priceCents;
  if (trimmedNotes !== undefined) claimPatch.review_notes = trimmedNotes;

  const { data: claimedRows } = await supabaseFetchOnDemand<Row[]>("rest/v1/dishes_draft", {
    body: claimPatch,
    method: "PATCH",
    params: {
      id: eq(draftId),
      or: `(review_status.in.(pending,edited),and(review_status.eq.accepted,reviewed_at.lt.${staleCutoffIso}))`,
      select: "id,venue_id,building_id,name,price_cents,modifiers,promoted_dish_id",
    },
    prefer: "return=representation",
    serviceRole: true,
  });
  const claimed = asRowArray(claimedRows)[0];
  if (!claimed) {
    throw new DishDraftConflictError(
      "This draft is already being published or has already been finalised.",
    );
  }

  const releaseClaim = async () => {
    await supabaseFetchOnDemand<unknown>("rest/v1/dishes_draft", {
      body: { review_status: "edited", updated_at: new Date().toISOString() },
      method: "PATCH",
      params: { id: eq(draftId), review_status: eq("accepted"), reviewed_at: eq(nowIso) },
      prefer: "return=minimal",
      serviceRole: true,
    }).catch(() => undefined);
  };

  let dishId = "";
  let venueId = "";
  let finalPrice = 0;
  let finalConfidence: string | null = null;
  let halalStatus: DishDraftHalalStatus = "unknown";

  try {
    const { meta: savedMeta } = extractOpsMeta(claimed.modifiers);
    venueId = asString(claimed.venue_id)?.trim() ?? "";
    const buildingId = asString(claimed.building_id)?.trim() ?? "";
    const finalName = trimmedName ?? asString(claimed.name)?.trim() ?? "";
    if (!venueId || !buildingId || !finalName) {
      throw new Error("Draft is missing required venue, building, or dish name.");
    }

    const effectiveCents =
      input.priceCents !== undefined
        ? input.priceCents
        : typeof claimed.price_cents === "number"
          ? claimed.price_cents
          : null;
    const hasRealPrice = typeof effectiveCents === "number" && effectiveCents > 0;
    finalPrice = hasRealPrice ? Number((effectiveCents / 100).toFixed(2)) : 0;
    const effectiveBasis =
      input.priceBasis !== undefined ? input.priceBasis : (savedMeta?.priceBasis ?? undefined);
    finalConfidence = hasRealPrice
      ? (mapPriceBasisToConfidence(effectiveBasis) ?? "listed_price")
      : null;
    halalStatus =
      input.halalStatus !== undefined ? input.halalStatus : (savedMeta?.halalStatus ?? "unknown");
    const effectiveDescription =
      input.description !== undefined ? input.description : savedMeta?.description;
    dishId = asString(claimed.promoted_dish_id)?.trim() || `draft:${draftId}`;

    const dishBody: Row = {
      archived_at: null,
      building_id: buildingId,
      dietary_status: { flags: { halal: halalStatus } },
      id: dishId,
      menu_approved_for_display: true,
      menu_rights_status: "operator_owned",
      name: finalName,
      price: finalPrice,
      price_checked_at: hasRealPrice ? nowIso : null,
      price_confidence: finalConfidence,
      venue_id: venueId,
    };
    if (effectiveDescription !== undefined) {
      dishBody.description = effectiveDescription?.trim() ? effectiveDescription.trim() : null;
    }

    await supabaseFetchOnDemand<unknown>("rest/v1/dishes", {
      body: dishBody,
      method: "POST",
      params: { on_conflict: "id" },
      prefer: "resolution=merge-duplicates,return=minimal",
      serviceRole: true,
    });

    await supabaseFetchOnDemand<unknown>("rest/v1/venues", {
      body: { menu_approved_for_display: true, menu_rights_status: "operator_owned" },
      method: "PATCH",
      params: { id: eq(venueId), menu_rights_status: eq("unverified") },
      prefer: "return=minimal",
      serviceRole: true,
    });

    const { data: halalFlags } = await supabaseFetchOnDemand<Row[]>("rest/v1/dietary_flags", {
      params: { limit: 1, select: "id", slug: eq("halal") },
      serviceRole: true,
    });
    const halalFlagId = asString(asRowArray(halalFlags)[0]?.id);
    if (halalFlagId) {
      if (halalStatus === "yes") {
        await supabaseFetchOnDemand<unknown>("rest/v1/dish_dietary_flags", {
          body: { dietary_flag_id: halalFlagId, dish_id: dishId },
          method: "POST",
          params: { on_conflict: "dish_id,dietary_flag_id" },
          prefer: "resolution=merge-duplicates,return=minimal",
          serviceRole: true,
        });
      } else {
        await supabaseFetchOnDemand<unknown>("rest/v1/dish_dietary_flags", {
          method: "DELETE",
          params: { dietary_flag_id: eq(halalFlagId), dish_id: eq(dishId) },
          prefer: "return=minimal",
          serviceRole: true,
        });
      }
    }

    await supabaseFetchOnDemand<unknown>("rest/v1/rpc/catalog_raw_refresh_venue", {
      body: { p_venue_id: venueId },
      method: "POST",
      serviceRole: true,
    });

    await supabaseFetchOnDemand<unknown>("rest/v1/dishes_draft", {
      body: { promoted_dish_id: dishId, review_status: "promoted", reviewed_at: nowIso },
      method: "PATCH",
      params: { id: eq(draftId), review_status: eq("accepted"), reviewed_at: eq(nowIso) },
      prefer: "return=minimal",
      serviceRole: true,
    });
  } catch (promotionError) {
    await releaseClaim();
    throw promotionError;
  }

  // Audit failure after successful promotion must never report the promotion as failed.
  await recordConsoleAuditEvent(actor, {
    action: "dish_draft_promoted",
    metadata: {
      halalStatus,
      price: finalPrice,
      priceConfidence: finalConfidence,
      promotedDishId: dishId,
      venueId,
    },
    targetId: draftId,
    targetType: "dishes_draft",
  }).catch((auditErr) => console.error("Console audit write failed after draft promotion", auditErr));

  return { promotedDishId: dishId, status: "promoted" };
}

async function getReportsRecords() {
  const { records, warning } = await fetchRows(
    "content_reports",
    "id,status,reason,target_type,target_id,created_at,updated_at",
    { order: "created_at.desc" },
  );
  return { records, warning };
}

async function getWaitlistDatasetRecords() {
  const result = await listConsoleWaitlistEntries();
  return {
    configured: result.configured,
    records: result.entries.map((entry) => ({
      id: entry.id,
      metadata: {
        audience: entry.audience,
        email: redactEmail(entry.email),
        source: entry.source,
      },
      status: entry.establishmentType ?? entry.audience,
      subtitle: entry.businessName ?? redactEmail(entry.email),
      title: entry.name ?? entry.businessName ?? redactEmail(entry.email),
      updatedAt: entry.submittedAt,
    })),
  };
}

async function getMerchantDatasetRecords() {
  const result = await listConsoleMerchants();
  return {
    configured: result.configured,
    records: result.merchants.map((merchant) => ({
      id: merchant.id,
      metadata: {
        dishCount: merchant.dishCount,
        location: merchant.location,
        type: merchant.type,
      },
      status: merchant.verificationStatus,
      subtitle: merchant.location || merchant.type,
      title: merchant.name,
      updatedAt: merchant.joinedDate,
    })),
  };
}

async function getSearchRecords(query: string) {
  if (!query.trim()) return [];
  const lower = query.trim().toLowerCase();
  const [waitlist, merchants, audit] = await Promise.all([
    getWaitlistDatasetRecords(),
    getMerchantDatasetRecords(),
    getAuditRecords(),
  ]);
  return [...waitlist.records, ...merchants.records, ...audit.records]
    .filter((record) => JSON.stringify(record).toLowerCase().includes(lower))
    .slice(0, READ_LIMIT);
}

function configWarning() {
  return isSupabaseServiceConfigured() ? [] : [`Supabase service role not configured: ${JSON.stringify(getSupabaseConfigStatus())}`];
}

export async function getConsoleRouteDataset(
  section: string,
  searchParams: Record<string, string | string[] | undefined> = {},
  actor?: ConsoleActor,
): Promise<ConsoleRouteDataset> {
  const normalizedSection = section === "overview" ? "overview" : section;
  const route = getConsoleRouteBySection(normalizedSection);
  if (!route || route.status === "hidden") {
    throw new Error("Console route is not visible.");
  }
  if (actor && !roleCanAccess(actor.role, route.minRole)) {
    throw new Error("This console role cannot access the requested route.");
  }

  const warnings = configWarning();
  let configured = isSupabaseServiceConfigured();
  let records: ConsoleRecord[] = [];
  let metrics: ConsoleMetric[] = [];

  if (normalizedSection === "overview") {
    const [summary, audit] = await Promise.all([getConsoleSummary(), getAuditRecords()]);
    configured = summary.configured;
    if (audit.warning) warnings.push(audit.warning);
    records = audit.records;
    metrics = [
      { label: "Waitlist", value: formatCount(summary.counts.totalWaitlist), detail: "Total website submissions" },
      { label: "Merchant waitlist", value: formatCount(summary.counts.merchantWaitlist), detail: "Merchant or both audience" },
      { label: "Users", value: formatCount(summary.counts.users), detail: "Profiles in Supabase" },
      { label: "Merchants", value: formatCount(summary.counts.activeMerchants), detail: "Merchant accounts" },
      { label: "Claims", value: formatCount(summary.counts.pendingVerifications), detail: "Pending verification states" },
      { label: "Reports", value: formatCount(summary.counts.openReports), detail: "Content reports" },
    ];
  } else if (normalizedSection === "waitlist") {
    const waitlist = await getWaitlistDatasetRecords();
    configured = waitlist.configured;
    records = waitlist.records;
    metrics = [
      { label: "Rows loaded", value: formatCount(records.length), detail: "Most recent submissions" },
      { label: "Merchant leads", value: formatCount(records.filter((record) => record.metadata?.audience !== "foodie").length) },
    ];
  } else if (normalizedSection === "merchants") {
    const merchants = await getMerchantDatasetRecords();
    configured = merchants.configured;
    records = merchants.records;
    metrics = [
      { label: "Outlets", value: formatCount(records.length) },
      { label: "Verified", value: formatCount(records.filter((record) => record.status === "verified").length) },
      { label: "Needs review", value: formatCount(records.filter((record) => record.status !== "verified").length) },
    ];
  } else if (normalizedSection === "search") {
    const query = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q;
    records = await getSearchRecords(query ?? "");
    metrics = [{ label: "Results", value: formatCount(records.length), detail: query ? `For "${query}"` : "Enter a query" }];
  } else if (normalizedSection === "team") {
    const team = await getTeamRecords();
    if (team.warning) warnings.push(team.warning);
    records = team.records;
    metrics = [
      { label: "Members", value: formatCount(records.length) },
      { label: "Active", value: formatCount(records.filter((record) => record.status === "active").length) },
      { label: "Suspended", value: formatCount(records.filter((record) => record.status === "suspended").length) },
    ];
  } else if (normalizedSection === "audit-log" || normalizedSection === "activity") {
    const audit = await getAuditRecords();
    if (audit.warning) warnings.push(audit.warning);
    records = audit.records;
    metrics = [{ label: "Events", value: formatCount(records.length), detail: "Latest audit events" }];
  } else if (normalizedSection === "users") {
    const users = await getUserRecords();
    if (users.warning) warnings.push(users.warning);
    records = users.records;
    metrics = [
      { label: "Profiles", value: formatCount(records.length), detail: "User profile records" },
      { label: "Source tables", value: "3", detail: "Profiles, reports, audit" },
    ];
  } else if (normalizedSection === "merchant-applications") {
    const applications = await getMerchantApplicationRecords();
    warnings.push(...applications.warnings);
    records = applications.records;
    metrics = [
      { label: "Applications", value: formatCount(records.length), detail: "Verification and claim rows" },
      {
        label: "Needs action",
        value: formatCount(
          records.filter((record) => !["verified", "converted", "rejected"].includes(record.status ?? "")).length,
        ),
      },
    ];
  } else if (normalizedSection === "stall-submissions") {
    const rawOffset = Array.isArray(searchParams.offset) ? searchParams.offset[0] : searchParams.offset;
    const parsedOffset = rawOffset ? Number.parseInt(rawOffset, 10) : 0;
    const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;
    const submissions = await getStallSubmissionRecords(offset);
    warnings.push(...submissions.warnings);
    records = submissions.records;
    metrics = [
      {
        label: "Open drafts",
        value: formatCount(submissions.openDraftsLoaded),
        detail: submissions.hasMoreOpenDrafts
          ? `Offset ${offset} (more pending)`
          : `Offset ${offset} (oldest first)`,
      },
      {
        label: "Published (recent)",
        value: formatCount(records.filter((r) => r.status === "promoted").length),
        detail: "Live on stall pages",
      },
      {
        label: "Merchant edits",
        value: formatCount(records.filter((r) => r.metadata?.kind !== "dish_draft").length),
        detail: "From merchant_change_requests",
      },
    ];
  } else if (normalizedSection === "reports") {
    const reports = await getReportsRecords();
    if (reports.warning) warnings.push(reports.warning);
    records = reports.records;
    metrics = [
      { label: "Reports", value: formatCount(records.length), detail: "Latest moderation reports" },
      { label: "Open", value: formatCount(records.filter((record) => record.status !== "resolved").length) },
    ];
  } else {
    const source = route.dataSources[0];
    const fetched = source ? await fetchRows(source) : { records: [] };
    if (fetched.warning) warnings.push(fetched.warning);
    records = fetched.records;
    metrics = [
      { label: "Rows loaded", value: formatCount(records.length), detail: source ? `From ${source}` : "No backed table configured" },
      { label: "Source tables", value: formatCount(route.dataSources.length) },
    ];
  }

  return {
    actor: actor ? { authMode: actor.authMode, email: actor.email, role: actor.role, status: actor.status } : undefined,
    canMutate: actor ? actor.role !== "viewer" : false,
    configured,
    dataSources: route.dataSources,
    emptyMessage: route.status === "partial"
      ? "This route is visible because a backing table exists or is being introduced. No production records are available yet."
      : "No production records were returned for this route.",
    emptyTitle: "No records yet",
    metrics,
    purpose: route.purpose,
    records,
    routeStatus: route.status as Exclude<ConsoleRouteStatus, "hidden">,
    section: normalizedSection,
    title: route.label,
    warnings,
  };
}

export async function addConsoleAdminMember(actor: ConsoleActor, input: {
  email: string;
  role: ConsoleRole;
  userId: string;
}) {
  if (actor.role !== "admin") throw new Error("Only admins can manage console team members.");
  if (!isConsoleRole(input.role)) throw new Error("Invalid console role.");
  const email = input.email.trim().toLowerCase();
  const userId = input.userId.trim();
  if (!email || !userId) throw new Error("Supabase Auth user ID and email are required.");

  const { data } = await supabaseFetchOnDemand<Row[]>("rest/v1/website_console_admins", {
    body: {
      email,
      role: input.role,
      status: "active",
      user_id: userId,
    },
    method: "POST",
    params: { on_conflict: "user_id" },
    prefer: "resolution=merge-duplicates,return=representation",
    serviceRole: true,
  });
  const member = asRowArray(data)[0];
  await recordConsoleAuditEvent(actor, {
    action: "console.team.upsert",
    metadata: { email: redactEmail(email), role: input.role },
    targetId: asString(member?.id) ?? userId,
    targetType: "website_console_admin",
  });
  return member;
}

export async function updateConsoleAdminMember(actor: ConsoleActor, memberId: string, input: {
  role?: ConsoleRole;
  status?: "active" | "suspended";
}) {
  if (actor.role !== "admin") throw new Error("Only admins can manage console team members.");
  const payload: Row = { updated_at: new Date().toISOString() };
  if (input.role) {
    if (!isConsoleRole(input.role)) throw new Error("Invalid console role.");
    payload.role = input.role;
  }
  if (input.status) payload.status = input.status;

  const { data } = await supabaseFetchOnDemand<Row[]>("rest/v1/website_console_admins", {
    body: payload,
    method: "PATCH",
    params: { id: eq(memberId) },
    prefer: "return=representation",
    serviceRole: true,
  });
  await recordConsoleAuditEvent(actor, {
    action: "console.team.update",
    metadata: payload,
    targetId: memberId,
    targetType: "website_console_admin",
  });
  return asRowArray(data)[0];
}
