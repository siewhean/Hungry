/**
 * Row mappers for the social graph RPCs (migration 20261107180000): the relationship line on a
 * profile, taste matches for a page of people, suggested people and network stall picks, and the
 * people at a stall or dish (20261109090000).
 * Pure, so the shapes are tested without a database.
 */
import type { TasteVector } from "@/types/domain";
import type {
  NetworkStallPick,
  PeopleSuggestion,
  PlacePeople,
  PlacePerson,
  ProfileRelationship,
} from "@/lib/services/types";

type Row = Record<string, unknown>;

const FALLBACK_NAME = "Hungry User";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function count(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => (typeof item === "string" ? item : "")) : [];
}

/** Pairs ids with names by position; rows with no id are dropped. */
function people(ids: unknown, names: unknown): { userId: string; displayName: string }[] {
  const nameList = textArray(names);
  return textArray(ids).flatMap((userId, index) =>
    userId ? [{ userId, displayName: text(nameList[index]) ?? FALLBACK_NAME }] : [],
  );
}

export function mapProfileRelationship(data: unknown): ProfileRelationship | null {
  const row = (Array.isArray(data) ? data[0] : data) as Row | undefined;
  if (!row || typeof row !== "object") return null;
  const mutuals = people(row.mutual_user_ids, row.mutual_names);
  return {
    followsYou: row.follows_you === true,
    mutualCount: Math.max(count(row.mutual_count), mutuals.length),
    mutuals,
  };
}

export function mapTasteMatches(data: unknown): Record<string, number> {
  if (!Array.isArray(data)) return {};
  const scores: Record<string, number> = {};
  for (const row of data as Row[]) {
    const userId = text(row?.user_id);
    if (!userId || row.score === null || row.score === undefined) continue;
    const score = typeof row.score === "number" ? row.score : Number(row.score);
    if (!Number.isFinite(score)) continue;
    scores[userId] = Math.max(0, Math.min(100, Math.round(score)));
  }
  return scores;
}

const REASONS = new Set<PeopleSuggestion["reason"]>(["mutual", "taste", "active"]);

export function mapPeopleSuggestions(data: unknown): PeopleSuggestion[] {
  if (!Array.isArray(data)) return [];
  return (data as Row[]).flatMap((row): PeopleSuggestion[] => {
    const userId = text(row?.user_id);
    if (!userId) return [];
    const match = typeof row.taste_match === "number" ? row.taste_match : Number(row.taste_match);
    const reason = text(row.reason) as PeopleSuggestion["reason"] | undefined;
    return [
      {
        userId,
        displayName: text(row.display_name) ?? FALLBACK_NAME,
        avatarUrl: text(row.avatar_url),
        tasteMatch:
          row.taste_match === null || row.taste_match === undefined || !Number.isFinite(match)
            ? undefined
            : Math.max(0, Math.min(100, Math.round(match))),
        mutualCount: count(row.mutual_count),
        recentActivity: count(row.recent_activity),
        reason: reason && REASONS.has(reason) ? reason : "active",
      },
    ];
  });
}

export function mapPlacePeople(data: unknown): PlacePeople {
  if (!Array.isArray(data)) return { people: [], totalPeople: 0 };
  const people = (data as Row[]).flatMap((row): PlacePerson[] => {
    const userId = text(row?.user_id);
    if (!userId) return [];
    return [
      {
        userId,
        displayName: text(row.display_name) ?? FALLBACK_NAME,
        avatarUrl: text(row.avatar_url),
        isFollowed: row.is_followed === true,
        contributions: Math.max(1, count(row.contributions)),
      },
    ];
  });
  const total = (data as Row[]).reduce((most, row) => Math.max(most, count(row?.total_people)), 0);
  return { people, totalPeople: Math.max(total, people.length) };
}

export function mapNetworkStallPicks(data: unknown): NetworkStallPick[] {
  if (!Array.isArray(data)) return [];
  return (data as Row[]).flatMap((row): NetworkStallPick[] => {
    const venueId = text(row?.venue_id);
    if (!venueId) return [];
    const picked = people(row.sample_user_ids, row.sample_names);
    return [
      {
        venueId,
        source: row.source === "taste_twin" ? "taste_twin" : "following",
        peopleCount: Math.max(count(row.people_count), picked.length),
        people: picked,
        lastAt: text(row.last_at),
      },
    ];
  });
}

const AXES = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"] as const;

function level(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(10, parsed)) : undefined;
}

export function mapTasteComparison(
  data: unknown,
): { score: number; mine: TasteVector; theirs: TasteVector } | null {
  const row = (Array.isArray(data) ? data[0] : data) as Row | undefined;
  if (!row || typeof row !== "object") return null;
  const score = typeof row.score === "number" ? row.score : Number(row.score);
  if (row.score === null || row.score === undefined || !Number.isFinite(score)) return null;
  const theirs = {} as TasteVector;
  const mine = {} as TasteVector;
  for (const axis of AXES) {
    const their = level(row[axis]);
    const my = level(row[`my_${axis}`]);
    if (their === undefined || my === undefined) return null;
    theirs[axis] = their;
    mine[axis] = my;
  }
  return { score: Math.max(0, Math.min(100, Math.round(score))), mine, theirs };
}
