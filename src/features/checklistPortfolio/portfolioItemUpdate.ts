import type { PortfolioItemCreateInput } from "@/lib/services/types";
import type { PortfolioItem } from "@/types/domain";

/**
 * The fields of a list item edit that actually changed. A note the sheet showed as empty
 * because it never loaded (privateNotes undefined) stays out of the update unless the owner
 * typed one, so saving a score can never wipe it ("" would clear it on the server).
 */
export function buildPortfolioItemUpdate(
  item: Pick<PortfolioItem, "score" | "publicNotes" | "privateNotes">,
  next: { score?: number; publicNotes: string; privateNotes: string },
): Partial<PortfolioItemCreateInput> {
  const updates: Partial<PortfolioItemCreateInput> = {};
  if (next.score !== undefined && next.score !== item.score) updates.score = next.score;
  const publicNotes = next.publicNotes.trim();
  if (publicNotes !== (item.publicNotes ?? "").trim()) updates.publicNotes = publicNotes;
  const privateNotes = next.privateNotes.trim();
  if (privateNotes !== (item.privateNotes ?? "").trim()) updates.privateNotes = privateNotes;
  return updates;
}
