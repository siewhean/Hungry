/**
 * Words for how two diners are connected: "Follows you", "Follow back", "Followed by Mei and 2
 * others you follow", a Vivino-style taste match band, and why someone was suggested. Pure, so
 * the profile header, the Followers and Following lists and the suggestions share one wording.
 */
import type { PeopleSuggestion, ProfileRelationship } from "@/lib/services/types";

/** Vivino's bands: 70+ is a great match, under 40 a low one. */
export const GREAT_MATCH_FROM = 70;
export const LOW_MATCH_BELOW = 40;

export type TasteMatchBand = "great" | "good" | "low";

export function tasteMatchBand(score: number): TasteMatchBand {
  if (score >= GREAT_MATCH_FROM) return "great";
  if (score < LOW_MATCH_BELOW) return "low";
  return "good";
}

const BAND_WORDS: Record<TasteMatchBand, string> = {
  great: "Great match",
  good: "Good match",
  low: "Low match",
};

/** "92% · Great match": the number first, then the band in words. */
export function tasteMatchLabel(score: number): string {
  return `${score}% · ${BAND_WORDS[tasteMatchBand(score)]}`;
}

/** The follow button's words, from the viewer's side first. */
export function followButtonLabel({
  isFollowing,
  isRequested,
  followsYou,
}: {
  isFollowing: boolean;
  isRequested: boolean;
  followsYou: boolean;
}): "Following" | "Requested" | "Follow back" | "Follow" {
  if (isRequested) return "Requested";
  if (isFollowing) return "Following";
  return followsYou ? "Follow back" : "Follow";
}

/**
 * "Followed by Mei", "Followed by Mei and Sam", "Followed by Mei, Sam and 3 others you follow".
 * Empty when nobody the viewer follows follows them.
 */
export function followedByLine(relationship: ProfileRelationship | null | undefined): string {
  if (!relationship || relationship.mutualCount <= 0) return "";
  const names = relationship.mutuals.map((person) => person.displayName).slice(0, 2);
  if (names.length === 0) {
    const count = relationship.mutualCount;
    return `Followed by ${count} ${count === 1 ? "person" : "people"} you follow`;
  }
  const others = Math.max(0, relationship.mutualCount - names.length);
  if (others === 0) {
    return names.length === 1
      ? `Followed by ${names[0]}`
      : `Followed by ${names[0]} and ${names[1]}`;
  }
  return `Followed by ${names.join(", ")} and ${others} ${others === 1 ? "other" : "others"} you follow`;
}

/** One short line under a suggested person: why they are there. */
export function suggestionReason(suggestion: PeopleSuggestion): string {
  if (suggestion.reason === "mutual" && suggestion.mutualCount > 0) {
    const count = suggestion.mutualCount;
    return `Followed by ${count} ${count === 1 ? "person" : "people"} you follow`;
  }
  if (suggestion.tasteMatch !== undefined && suggestion.tasteMatch >= GREAT_MATCH_FROM) {
    return `${suggestion.tasteMatch}% taste match`;
  }
  if (suggestion.recentActivity > 0) return "Reviewing and posting lately";
  return "New on Hungry";
}
