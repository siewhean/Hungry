export type DeletionPendingStatus = { scheduledFor: string; status: "requested" | "processing" };
export function parseDeletionStatus(value: unknown): DeletionPendingStatus | null {
  if (value === null) return null;
  if (!value || typeof value !== "object")
    throw new Error("Could not confirm account deletion status.");
  const row = value as Record<string, unknown>;
  if (
    typeof row.scheduledFor !== "string" ||
    !Number.isFinite(Date.parse(row.scheduledFor)) ||
    (row.status !== "requested" && row.status !== "processing")
  ) {
    throw new Error("Could not confirm account deletion status.");
  }
  return { scheduledFor: row.scheduledFor, status: row.status };
}
export function isDeletionCancellationConfirmed(value: unknown) {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as Record<string, unknown>).outcome === "cancelled",
  );
}
