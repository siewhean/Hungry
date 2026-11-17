import { formatTimeAgo } from "@/lib/date/formatTimeAgo";

/** "Updated 3d ago" for a dish, or undefined when the catalog has no usable timestamp. */
export function formatDishUpdated(updatedAt: string | undefined): string | undefined {
  if (!updatedAt || Number.isNaN(new Date(updatedAt).getTime())) return undefined;
  return `Updated ${formatTimeAgo(updatedAt)}`;
}
