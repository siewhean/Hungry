import {
  getConsoleRouteBySection,
  isConsoleRole,
  roleCanAccess,
  type ConsoleRole,
  type ConsoleRouteStatus,
} from "@/lib/console/routeRegistry";
import { redactEmail } from "@/lib/console/redaction";
import {
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

export type MerchantClaimAction = "approve" | "reject" | "contacted";

/**
 * Ops decide a claim by hand. Approving runs approve_merchant_claim, which creates the merchant
 * account, owner role and outlet in one transaction (and is safe to repeat). The other actions
 * only move the status, and never touch a claim that is already approved.
 */
export async function reviewMerchantClaim(
  actor: ConsoleActor,
  claimId: string,
  action: MerchantClaimAction,
) {
  if (action === "approve") {
    const { data } = await supabaseFetchOnDemand<unknown>("rest/v1/rpc/approve_merchant_claim", {
      body: { p_claim_id: claimId },
      method: "POST",
      serviceRole: true,
    });
    await recordConsoleAuditEvent(actor, {
      action: "merchant_claim_approved",
      metadata: data && typeof data === "object" ? (data as Record<string, unknown>) : {},
      targetId: claimId,
      targetType: "merchant_claim",
    });
    return data;
  }

  const status = action === "reject" ? "rejected" : "contacted";
  await supabaseFetchOnDemand<unknown>("rest/v1/merchant_claim_interests", {
    body: { status, status_updated_at: new Date().toISOString() },
    method: "PATCH",
    params: { id: eq(claimId), status: "neq.converted" },
    prefer: "return=minimal",
    serviceRole: true,
  });
  await recordConsoleAuditEvent(actor, {
    action: `merchant_claim_${status}`,
    metadata: { status },
    targetId: claimId,
    targetType: "merchant_claim",
  });
  return { status };
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
