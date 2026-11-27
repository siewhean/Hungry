"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RefreshCcw, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import type { ConsoleRole } from "@/lib/console/routeRegistry";
import type {
  ConsoleRecord,
  ConsoleRouteDataset,
  DishDraftDecision,
  DishDraftHalalStatus,
  DishDraftPriceBasis,
} from "@/lib/supabase/consoleData";
import styles from "./console.module.css";

type ApiError = {
  error?: string;
  message?: string;
};

const roleOptions: ConsoleRole[] = ["viewer", "ops", "admin"];

function recordDate(record: ConsoleRecord) {
  if (!record.updatedAt) return "No timestamp";
  const date = new Date(record.updatedAt);
  if (Number.isNaN(date.getTime())) return record.updatedAt;
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function metadataEntries(record: ConsoleRecord) {
  const hiddenKeys = new Set(["source_photo_url", "draft_description"]);
  return Object.entries(record.metadata ?? {})
    .filter(([key, value]) => !hiddenKeys.has(key) && value !== null && value !== "")
    .map(([key, value]) => [
      key,
      typeof value === "string" && value.length > 160 ? `${value.slice(0, 160)}…` : value,
    ] as const);
}

async function readApiError(response: Response, fallback: string) {
  const data = await response.json().catch((): ApiError | null => null);
  return data?.error ?? data?.message ?? fallback;
}

type ClaimAction = "approve" | "reject" | "contacted";

type DraftReviewSubmission = {
  decision: DishDraftDecision;
  description?: string | null;
  halalStatus?: DishDraftHalalStatus;
  name?: string;
  notes?: string;
  priceBasis?: DishDraftPriceBasis;
  priceCents?: number | null;
};

const OPEN_CLAIM_STATUSES = new Set(["new", "contacted", "qualified"]);
const OPEN_DRAFT_STATUSES = new Set(["pending", "edited", "accepted"]);
const STALL_DRAFT_PAGE_SIZE = 40;

function RecordCard({
  canAdmin,
  canMutate,
  mutating,
  onClaimAction,
  onDraftAction,
  onTeamPatch,
  record,
  section,
}: {
  canAdmin: boolean;
  canMutate: boolean;
  mutating: boolean;
  onClaimAction: (claimId: string, action: ClaimAction, stall: string) => void;
  onDraftAction: (draftId: string, input: DraftReviewSubmission) => void;
  onTeamPatch: (memberId: string, input: { role?: ConsoleRole; status?: "active" | "suspended" }) => void;
  record: ConsoleRecord;
  section: string;
}) {
  const entries = metadataEntries(record);
  const isOpenClaim =
    section === "merchant-applications" &&
    record.metadata?.kind === "claim" &&
    OPEN_CLAIM_STATUSES.has(record.status ?? "");
  const isDishDraft =
    section === "stall-submissions" && record.metadata?.kind === "dish_draft";
  const isEditableDraft = isDishDraft && OPEN_DRAFT_STATUSES.has(record.status ?? "");
  const sourcePhotoUrl =
    typeof record.metadata?.source_photo_url === "string" ? record.metadata.source_photo_url : "";
  const initialPriceDollars =
    typeof record.metadata?.price_cents === "number" && record.metadata.price_cents > 0
      ? (record.metadata.price_cents / 100).toFixed(2)
      : "";
  const savedBasis: DishDraftPriceBasis =
    record.metadata?.price_basis === "menu" ||
    record.metadata?.price_basis === "delivery" ||
    record.metadata?.price_basis === "counter"
      ? record.metadata.price_basis
      : "counter";
  const savedHalal: DishDraftHalalStatus =
    record.metadata?.halal_status === "yes" ||
    record.metadata?.halal_status === "no" ||
    record.metadata?.halal_status === "unknown"
      ? record.metadata.halal_status
      : "unknown";
  const savedDescription =
    typeof record.metadata?.draft_description === "string" ? record.metadata.draft_description : "";

  const [draftName, setDraftName] = useState<string>(record.title);
  const [draftPrice, setDraftPrice] = useState<string>(initialPriceDollars);
  const [draftBasis, setDraftBasis] = useState<DishDraftPriceBasis>(savedBasis);
  const [draftHalal, setDraftHalal] = useState<DishDraftHalalStatus>(savedHalal);
  const [draftDescription, setDraftDescription] = useState<string>(savedDescription);
  const [draftNotes, setDraftNotes] = useState<string>(
    typeof record.metadata?.review_notes === "string" ? record.metadata.review_notes : "",
  );

  const parseEditedPriceCents = (): number | null | "invalid" => {
    const trimmed = draftPrice.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num < 0 || num > 10_000) return "invalid";
    return Math.round(num * 100);
  };

  const submitDraftDecision = (decision: DishDraftDecision) => {
    const parsedCents = parseEditedPriceCents();
    if (parsedCents === "invalid") {
      alert("Enter a valid non-negative SGD price (for example 4.50), or leave blank when unpriced.");
      return;
    }
    if ((decision === "edit" || decision === "accepted") && !draftName.trim()) {
      alert("Dish name cannot be blank.");
      return;
    }
    onDraftAction(record.id, {
      decision,
      description: draftDescription.trim() ? draftDescription.trim() : null,
      halalStatus: draftHalal,
      name: draftName.trim(),
      notes: draftNotes.trim() || undefined,
      priceBasis: draftBasis,
      priceCents: parsedCents,
    });
  };

  return (
    <article className={styles.routeRecordCard}>
      <div className={styles.routeRecordHeader}>
        <div>
          <h3 className={styles.routeRecordTitle}>{record.title}</h3>
          {record.subtitle ? <p className={styles.routeRecordSubtitle}>{record.subtitle}</p> : null}
        </div>
        {record.status ? <span className={styles.routeRecordStatus}>{record.status}</span> : null}
      </div>

      {sourcePhotoUrl ? (
        <a href={sourcePhotoUrl} rel="noreferrer" target="_blank">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={`Menu board for ${record.title}`}
            className={styles.draftPhotoPreview}
            loading="lazy"
            src={sourcePhotoUrl}
          />
        </a>
      ) : null}

      {entries.length > 0 ? (
        <dl className={styles.routeRecordMeta}>
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt>{key.replace(/_/g, " ")}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {isEditableDraft && canMutate ? (
        <>
          <div className={styles.draftEditGrid}>
            <label>
              Dish name
              <input
                className={styles.routeTextInput}
                onChange={(event) => setDraftName(event.target.value)}
                value={draftName}
              />
            </label>
            <label>
              Price SGD (blank if unpriced)
              <input
                className={styles.routeTextInput}
                inputMode="decimal"
                onChange={(event) => setDraftPrice(event.target.value)}
                placeholder="e.g. 4.50"
                value={draftPrice}
              />
            </label>
            <label>
              Price source
              <select
                className={styles.routeSelectInput}
                onChange={(event) => setDraftBasis(event.target.value as DishDraftPriceBasis)}
                value={draftBasis}
              >
                <option value="counter">Counter price</option>
                <option value="menu">Menu board</option>
                <option value="delivery">Delivery app</option>
              </select>
            </label>
            <label>
              Halal status
              <select
                className={styles.routeSelectInput}
                onChange={(event) => setDraftHalal(event.target.value as DishDraftHalalStatus)}
                value={draftHalal}
              >
                <option value="unknown">Not confirmed</option>
                <option value="yes">Halal certified</option>
                <option value="no">Not halal</option>
              </select>
            </label>
            <label>
              Description (optional)
              <input
                className={styles.routeTextInput}
                onChange={(event) => setDraftDescription(event.target.value)}
                placeholder="Only what is printed on board"
                value={draftDescription}
              />
            </label>
            <label>
              Review notes
              <input
                className={styles.routeTextInput}
                maxLength={2000}
                onChange={(event) => setDraftNotes(event.target.value)}
                placeholder="Optional operator note"
                value={draftNotes}
              />
            </label>
          </div>
          <div className={styles.routeInlineActions}>
            <button
              className={styles.routeSecondaryButton}
              disabled={mutating}
              onClick={() => submitDraftDecision("accepted")}
              type="button"
            >
              {record.status === "accepted" ? "Retry publish to stall" : "Accept & publish to stall"}
            </button>
            {record.status !== "accepted" ? (
              <>
                <button
                  className={styles.routeSecondaryButton}
                  disabled={mutating}
                  onClick={() => submitDraftDecision("edit")}
                  type="button"
                >
                  Save edits
                </button>
                <button
                  className={styles.routeSecondaryButton}
                  disabled={mutating}
                  onClick={() => submitDraftDecision("duplicate")}
                  type="button"
                >
                  Duplicate
                </button>
                <button
                  className={styles.routeDangerButton}
                  disabled={mutating}
                  onClick={() => submitDraftDecision("rejected")}
                  type="button"
                >
                  Reject
                </button>
              </>
            ) : null}
          </div>
        </>
      ) : null}

      <div className={styles.routeRecordFooter}>
        <span>{recordDate(record)}</span>
        <code>{record.id}</code>
      </div>

      {isOpenClaim && canMutate ? (
        <div className={styles.routeInlineActions}>
          <button
            className={styles.routeSecondaryButton}
            onClick={() => onClaimAction(record.id, "approve", record.title)}
            type="button"
          >
            Approve and create account
          </button>
          {record.status === "new" ? (
            <button
              className={styles.routeSecondaryButton}
              onClick={() => onClaimAction(record.id, "contacted", record.title)}
              type="button"
            >
              Mark contacted
            </button>
          ) : null}
          <button
            className={styles.routeDangerButton}
            onClick={() => onClaimAction(record.id, "reject", record.title)}
            type="button"
          >
            Reject
          </button>
        </div>
      ) : null}

      {section === "team" && canAdmin ? (
        <div className={styles.routeInlineActions}>
          <button
            className={styles.routeSecondaryButton}
            onClick={() => onTeamPatch(record.id, { role: record.metadata?.role === "admin" ? "ops" : "admin" })}
            type="button"
          >
            {record.metadata?.role === "admin" ? "Set ops" : "Set admin"}
          </button>
          <button
            className={styles.routeDangerButton}
            onClick={() => onTeamPatch(record.id, { status: record.status === "suspended" ? "active" : "suspended" })}
            type="button"
          >
            {record.status === "suspended" ? "Reactivate" : "Suspend"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default function ConsoleRouteClient({ initialSection }: { initialSection: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dataset, setDataset] = useState<ConsoleRouteDataset | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [mutating, setMutating] = useState<boolean>(false);
  const [teamEmail, setTeamEmail] = useState<string>("");
  const [teamRole, setTeamRole] = useState<ConsoleRole>("viewer");
  const [teamUserId, setTeamUserId] = useState<string>("");

  const queryString = searchParams.toString();
  const searchTerm = searchParams.get("q") ?? "";
  const currentOffset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  const navigateOffset = (nextOffset: number) => {
    const params = new URLSearchParams(queryString);
    if (nextOffset <= 0) params.delete("offset");
    else params.set("offset", String(nextOffset));
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "?");
  };

  const loadDataset = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(queryString);
      params.set("section", initialSection);
      const response = await fetch(`/api/console/dataset?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to load console route."));
      }
      setDataset(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load console route.");
      setDataset(null);
    } finally {
      setLoading(false);
    }
  }, [initialSection, queryString]);

  useEffect(() => {
    const reloadTimer = window.setTimeout(() => {
      void loadDataset();
    }, 0);
    return () => window.clearTimeout(reloadTimer);
  }, [loadDataset]);

  const canAdmin = dataset?.actor?.role === "admin";
  const canMutate = Boolean(dataset?.canMutate);

  const visibleRecords = useMemo(() => {
    const records = dataset?.records ?? [];
    if (!searchTerm.trim()) return records;
    const needle = searchTerm.trim().toLowerCase();
    return records.filter((record) => JSON.stringify(record).toLowerCase().includes(needle));
  }, [dataset?.records, searchTerm]);

  const statusClassName = useMemo(() => {
    if (dataset?.routeStatus === "ready") return styles.routeStatusReady;
    return styles.routeStatusPartial;
  }, [dataset?.routeStatus]);

  const handleTeamSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMutating(true);
    setError("");
    try {
      const response = await fetch("/api/console/team", {
        body: JSON.stringify({ email: teamEmail, role: teamRole, userId: teamUserId }),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-hungry-csrf": "same-origin",
        },
        method: "POST",
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to add team member."));
      setTeamEmail("");
      setTeamUserId("");
      setTeamRole("viewer");
      await loadDataset();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to add team member.");
    } finally {
      setMutating(false);
    }
  };

  const handleTeamPatch = async (
    memberId: string,
    input: { role?: ConsoleRole; status?: "active" | "suspended" },
  ) => {
    setMutating(true);
    setError("");
    try {
      const response = await fetch(`/api/console/team/${encodeURIComponent(memberId)}`, {
        body: JSON.stringify(input),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-hungry-csrf": "same-origin",
        },
        method: "PATCH",
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to update team member."));
      await loadDataset();
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Unable to update team member.");
    } finally {
      setMutating(false);
    }
  };

  const handleClaimAction = async (claimId: string, action: ClaimAction, stall: string) => {
    const question =
      action === "approve"
        ? `Approve the claim for ${stall}? This creates the claimant's merchant account and outlet.`
        : action === "reject"
          ? `Reject the claim for ${stall}?`
          : "";
    if (question && !confirm(question)) return;
    setMutating(true);
    setError("");
    try {
      const response = await fetch(`/api/console/claims/${encodeURIComponent(claimId)}`, {
        body: JSON.stringify({ action }),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-hungry-csrf": "same-origin",
        },
        method: "POST",
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to update this claim."));
      const payload = (await response.json().catch(() => null)) as {
        result?: { alreadyApproved?: boolean; emailSent?: boolean };
      } | null;
      await loadDataset();
      if (action === "approve" && payload?.result?.alreadyApproved !== true && payload?.result?.emailSent === false) {
        setError(`${stall} is approved, but the approval email did not send. Tell the claimant yourself.`);
      }
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Unable to update this claim.");
    } finally {
      setMutating(false);
    }
  };

  const handleDraftAction = async (draftId: string, input: DraftReviewSubmission) => {
    setMutating(true);
    setError("");
    try {
      const response = await fetch(`/api/console/dish-drafts/${encodeURIComponent(draftId)}`, {
        body: JSON.stringify(input),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-hungry-csrf": "same-origin",
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to update this dish draft."));
      }
      await loadDataset();
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "Unable to update this dish draft.");
    } finally {
      setMutating(false);
    }
  };

  const handleClearWaitlist = async () => {
    if (!confirm("Clear all waitlist entries? This is audited and cannot be undone.")) return;
    setMutating(true);
    setError("");
    try {
      const response = await fetch("/api/console/waitlist", {
        credentials: "include",
        headers: { "x-hungry-csrf": "same-origin" },
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to clear waitlist."));
      await loadDataset();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Unable to clear waitlist.");
    } finally {
      setMutating(false);
    }
  };

  if (loading && !dataset) {
    return <div className={styles.routeLoadingState}>Loading production console data...</div>;
  }

  return (
    <section className={styles.routeShell}>
      <div className={styles.routeHeader}>
        <div>
          <p className={styles.routeEyebrow}>Hungry Console</p>
          <div className={styles.routeTitleRow}>
            <h1>{dataset?.title ?? "Console route"}</h1>
            {dataset ? <span className={`${styles.routeStatus} ${statusClassName}`}>{dataset.routeStatus}</span> : null}
          </div>
          {dataset?.purpose ? <p className={styles.routePurpose}>{dataset.purpose}</p> : null}
        </div>
        <div className={styles.routeActions}>
          <button className={styles.routeSecondaryButton} onClick={loadDataset} disabled={loading || mutating} type="button">
            <RefreshCcw size={16} />
            Refresh
          </button>
          {initialSection === "waitlist" && canAdmin ? (
            <button className={styles.routeDangerButton} onClick={handleClearWaitlist} disabled={mutating} type="button">
              <Trash2 size={16} />
              Clear waitlist
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className={styles.routeErrorState}>{error}</div> : null}

      {dataset?.warnings.length ? (
        <div className={styles.routeWarningList}>
          {dataset.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {dataset ? (
        <>
          <div className={styles.routeSourceGrid}>
            <span className={styles.routeSourceChip}>
              <ShieldCheck size={14} />
              {dataset.actor?.role ?? "unknown"} access
            </span>
            <span className={styles.routeSourceChip}>{dataset.configured ? "Supabase configured" : "Supabase not configured"}</span>
            {dataset.dataSources.map((source) => (
              <span className={styles.routeSourceChip} key={source}>{source}</span>
            ))}
          </div>

          {dataset.metrics.length ? (
            <div className={styles.routeMetricGrid}>
              {dataset.metrics.map((metric) => (
                <article className={styles.routeMetricCard} key={`${metric.label}-${metric.value}`}>
                  <span className={styles.routeMetricLabel}>{metric.label}</span>
                  <strong className={styles.routeMetricValue}>{metric.value}</strong>
                  {metric.detail ? <p className={styles.routeMetricDetail}>{metric.detail}</p> : null}
                </article>
              ))}
            </div>
          ) : null}

          {initialSection === "team" && canAdmin ? (
            <form className={styles.routeAdminForm} onSubmit={handleTeamSubmit}>
              <div>
                <h2>Add console member</h2>
                <p>Invite an existing Supabase Auth user by user ID, then assign their console role.</p>
              </div>
              <div className={styles.routeFieldRow}>
                <label>
                  Email
                  <input
                    className={styles.routeTextInput}
                    onChange={(event) => setTeamEmail(event.target.value)}
                    placeholder="operator@hungry.sg"
                    required
                    type="email"
                    value={teamEmail}
                  />
                </label>
                <label>
                  Supabase user ID
                  <input
                    className={styles.routeTextInput}
                    onChange={(event) => setTeamUserId(event.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    required
                    value={teamUserId}
                  />
                </label>
                <label>
                  Role
                  <select
                    className={styles.routeSelectInput}
                    onChange={(event) => setTeamRole(event.target.value as ConsoleRole)}
                    value={teamRole}
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
                <button className={styles.routeSecondaryButton} disabled={mutating} type="submit">
                  <UserPlus size={16} />
                  Add member
                </button>
              </div>
            </form>
          ) : null}

          <div className={styles.routeToolbar}>
            <span>{visibleRecords.length} records</span>
            {searchTerm ? <span>Search: {searchTerm}</span> : null}
            {!canMutate ? <span>Read-only role</span> : null}
            {initialSection === "stall-submissions" &&
            (currentOffset > 0 ||
              dataset.records.filter(
                (r) => r.metadata?.kind === "dish_draft" && OPEN_DRAFT_STATUSES.has(r.status ?? ""),
              ).length >= STALL_DRAFT_PAGE_SIZE) ? (
              <div className={styles.routeInlineActions}>
                <button
                  className={styles.routeSecondaryButton}
                  disabled={currentOffset <= 0 || loading}
                  onClick={() => navigateOffset(Math.max(0, currentOffset - STALL_DRAFT_PAGE_SIZE))}
                  type="button"
                >
                  Previous batch
                </button>
                <button
                  className={styles.routeSecondaryButton}
                  disabled={
                    loading ||
                    dataset.records.filter(
                      (r) =>
                        r.metadata?.kind === "dish_draft" &&
                        OPEN_DRAFT_STATUSES.has(r.status ?? ""),
                    ).length < STALL_DRAFT_PAGE_SIZE
                  }
                  onClick={() => navigateOffset(currentOffset + STALL_DRAFT_PAGE_SIZE)}
                  type="button"
                >
                  Next batch
                </button>
              </div>
            ) : null}
          </div>

          {visibleRecords.length ? (
            <div className={styles.routeRecordsGrid}>
              {visibleRecords.map((record) => (
                <RecordCard
                  canAdmin={Boolean(canAdmin)}
                  canMutate={canMutate}
                  key={record.id}
                  mutating={mutating}
                  onClaimAction={handleClaimAction}
                  onDraftAction={handleDraftAction}
                  onTeamPatch={handleTeamPatch}
                  record={record}
                  section={initialSection}
                />
              ))}
            </div>
          ) : (
            <div className={styles.routeEmptyState}>
              <h2>{dataset.emptyTitle}</h2>
              <p>{dataset.emptyMessage}</p>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
