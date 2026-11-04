/**
 * Home's sections below the main stall rail. They are about the diner and the moment, never about
 * a kind of food: "Just for you", what suits this hour (or "Late night"), "Popular in the area",
 * the dishes the diner pinned, a taste or two (spicy, rich...), and "New and worth a try". Each
 * section mixes food types. A stall sits in one section only. Pure: the screen passes the stalls
 * it holds and the diner's palate, and gets the sections back.
 */
import { isLateNightHour } from "@/features/discover/bites";
import {
  classifyHomeText,
  timeOfDayPriority,
  type BuildCategorySectionsOptions,
  type HomeCategoryId,
} from "@/features/discover/homeCategories";
import { FRESH_REVIEW_LIMIT } from "@/features/discover/rankingBalance";
import type { TasteKey, TasteVector } from "@/types/domain";

export type HomeSectionDish = {
  name: string;
  rating?: number;
  reviewCount?: number;
  tasteVector?: TasteVector;
  /** 0-1 trust in tasteVector; undefined = fully trusted. */
  tasteConfidence?: number;
};
export type HomeSectionCard = {
  venue: { id: string; name: string };
  topDish?: HomeSectionDish;
};

export type HomeSection<T> = {
  id: string;
  title: string;
  /** What the chevron searches for. */
  query: string;
  cards: T[];
  kind: "recommended" | "context" | "taste" | "favourite";
};

export const TASTE_SECTIONS: readonly {
  id: string;
  axis: TasteKey;
  title: string;
  query: string;
}[] = [
  { id: "spicy", axis: "spicy", title: "Bring the heat", query: "Spicy" },
  { id: "rich", axis: "rich", title: "Rich and comforting", query: "Rich" },
  { id: "sweet", axis: "sweet", title: "Something sweet", query: "Sweet" },
  { id: "sour", axis: "sour", title: "Tangy and fresh", query: "Sour" },
  { id: "aromatic", axis: "aromatic", title: "Fragrant and herby", query: "Aromatic" },
  { id: "salty", axis: "salty", title: "Savoury and bold", query: "Savoury" },
];

/** A dish is "of" a taste from this level (0-10) up. */
export const TASTE_SECTION_MIN_AXIS = 6.5;
/** A dish this hot is left out for someone who cannot take spice. */
const TOO_SPICY = 6;
const NEUTRAL_AXIS = 5;
const MIN_TASTE_CONFIDENCE = 0.5;
/** A taste section shows at most this many stalls of one food kind. */
const MAX_PER_KIND_IN_TASTE_SECTION = 2;
const MIN_KINDS = 2;
/** The tastes tried when the diner has no palate yet, in this order. */
const DEFAULT_TASTE_ORDER: readonly TasteKey[] = ["rich", "spicy", "sweet", "aromatic"];

const AXES = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"] as const;

export type HomeSectionOptions<T> = BuildCategorySectionsOptions<T> & {
  /** The palate to fit stalls to (saved one, nudged by this visit). */
  palate?: TasteVector;
  /** True once the palate is trusted (quiz taken or enough signals). */
  palateTrusted?: boolean;
  /** The diner cannot take spice: hot dishes stay out of the recommended and taste sections. */
  avoidSpicy?: boolean;
  /** True when the stall is open right now; the hour's section only holds such stalls. */
  isOpenNow?: (card: T) => boolean;
  maxSections?: number;
};

type Tasted = { vector: TasteVector };

function tastedDish(dish: HomeSectionDish | undefined): Tasted | undefined {
  if (!dish?.tasteVector) return undefined;
  if (dish.tasteConfidence !== undefined && dish.tasteConfidence < MIN_TASTE_CONFIDENCE) {
    return undefined;
  }
  const vector = dish.tasteVector;
  // All fives is the untagged default, not a taste.
  return AXES.some((axis) => vector[axis] !== NEUTRAL_AXIS) ? { vector } : undefined;
}

/** 0 to 1: how close the dish's taste is to the palate, averaged over the six tastes. */
export function palateFit(palate: TasteVector, dish: TasteVector): number {
  const gap =
    AXES.reduce((sum, axis) => sum + Math.abs(palate[axis] - dish[axis]), 0) / AXES.length;
  return Math.max(0, 1 - gap / 10);
}

const textOf = (card: HomeSectionCard) => `${card.venue.name} ${card.topDish?.name ?? ""}`;
const kindOf = (card: HomeSectionCard): HomeCategoryId | "other" =>
  classifyHomeText(textOf(card)) ?? "other";

/** One of each food kind in turn, best first, so the section is made of different foods. */
function roundRobinByKind<T extends HomeSectionCard>(
  scored: readonly { card: T; score: number }[],
  limit: number,
): T[] {
  const byKind = new Map<string, { card: T; score: number }[]>();
  for (const entry of [...scored].sort((a, b) => b.score - a.score)) {
    const kind = kindOf(entry.card);
    byKind.set(kind, [...(byKind.get(kind) ?? []), entry]);
  }
  const queues = [...byKind.values()].sort((a, b) => b[0].score - a[0].score);
  const picked: T[] = [];
  for (let round = 0; picked.length < limit; round += 1) {
    let tookAny = false;
    for (const queue of queues) {
      const entry = queue[round];
      if (!entry) continue;
      picked.push(entry.card);
      tookAny = true;
      if (picked.length >= limit) break;
    }
    if (!tookAny) break;
  }
  return picked;
}

/** The section for this hour: what people want now, and "Late night" once it is late. */
export function hourSectionTitle(hour: number): string {
  if (isLateNightHour(hour)) return "Late night";
  if (hour < 10) return "Breakfast nearby";
  if (hour < 14) return "Lunch nearby";
  if (hour < 17) return "Afternoon treats";
  return "Dinner tonight";
}

const POPULAR_PRIOR_RATING = 3.8;
const POPULAR_PRIOR_WEIGHT = 5;
const POPULAR_FULL_REVIEWS = 50;

/** 0 to 1: a rating shrunk toward the middle until enough reviews back it, plus how many. */
function popularity(dish: HomeSectionDish | undefined): number {
  const rating = dish?.rating ?? 0;
  if (rating <= 0) return 0;
  const reviews = dish?.reviewCount ?? 0;
  const shrunk =
    (rating * reviews + POPULAR_PRIOR_RATING * POPULAR_PRIOR_WEIGHT) /
    (reviews + POPULAR_PRIOR_WEIGHT);
  return (shrunk / 5) * 0.6 + Math.min(reviews / POPULAR_FULL_REVIEWS, 1) * 0.4;
}

function escapeForRegex(word: string) {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds Home's sections in the order they show: Just for you (or Popular in the area when the
 * palate is not known yet), this hour, Popular in the area, the diner's pinned dishes, up to two
 * tastes, then New and worth a try.
 */
export function buildHomeSections<T extends HomeSectionCard>(
  cards: readonly T[],
  options: HomeSectionOptions<T>,
): HomeSection<T>[] {
  const maxSections = options.maxSections ?? 8;
  const minItems = options.minItems ?? 3;
  const perSection = options.perSection ?? 10;
  const claimed = new Set<string>(options.excludeVenueIds ?? []);
  const palate = options.palate;
  const trusted = Boolean(palate && options.palateTrusted);
  const familiarKinds = new Set<HomeCategoryId>();
  for (const name of options.familiarNames ?? []) {
    const kind = classifyHomeText(name);
    if (kind) familiarKinds.add(kind);
  }
  const pinnedKinds = new Set<HomeCategoryId>();
  for (const favourite of options.favourites ?? []) {
    const kind = classifyHomeText(`${favourite.label} ${favourite.query}`);
    if (kind) pinnedKinds.add(kind);
  }
  const fit = (card: T) => {
    const taste = tastedDish(card.topDish);
    return trusted && palate && taste ? palateFit(palate, taste.vector) : 0.5;
  };
  const tooSpicy = (card: T) => {
    const taste = tastedDish(card.topDish);
    return Boolean(options.avoidSpicy && taste && taste.vector.spicy >= TOO_SPICY);
  };
  const kindBoost = (card: T) => {
    const kind = kindOf(card);
    if (kind === "other") return 0;
    return (pinnedKinds.has(kind) ? 0.3 : 0) + (familiarKinds.has(kind) ? 0.25 : 0);
  };
  const free = () =>
    cards.filter((card) => !claimed.has(card.venue.id) && card.topDish && !tooSpicy(card));
  const claim = (chosen: readonly T[]) => {
    for (const card of chosen) claimed.add(card.venue.id);
  };
  const best = (scored: readonly { card: T; score: number }[]) =>
    [...scored]
      .sort((a, b) => b.score - a.score)
      .slice(0, perSection)
      .map((entry) => entry.card);

  const sections: HomeSection<T>[] = [];
  const add = (section: Omit<HomeSection<T>, "cards"> & { cards: readonly T[] }) => {
    if (section.cards.length < minItems) return false;
    claim(section.cards);
    sections.push({ ...section, cards: [...section.cards] });
    return true;
  };
  const popularPick = () =>
    best(
      free().flatMap((card) => {
        const score = popularity(card.topDish);
        return score > 0 ? [{ card, score }] : [];
      }),
    );

  // 1. Just for you: the best fits, one food kind at a time. Without a palate this is the
  // popular stalls, so the page still leads with something worth opening.
  if (trusted) {
    const pool = free();
    const scored = pool.map((card, index) => ({
      card,
      // Cards arrive open-and-near first; that order counts a little.
      score:
        fit(card) * 0.45 +
        kindBoost(card) +
        ((card.topDish?.rating ?? 0) / 5) * 0.15 +
        (1 - index / Math.max(pool.length, 1)) * 0.15,
    }));
    add({
      id: "recommended",
      title: "Just for you",
      query: "",
      cards: roundRobinByKind(scored, perSection),
      kind: "recommended",
    });
  } else {
    add({
      id: "recommended",
      title: "Popular in the area",
      query: "",
      cards: popularPick(),
      kind: "recommended",
    });
  }

  // 2. The diner's pinned dishes, each as a reason rather than a food heading.
  for (const style of (options.favourites ?? []).slice(0, 2)) {
    const pattern = new RegExp(`\\b${escapeForRegex(style.label.toLowerCase())}\\b`, "i");
    const found = free().filter((card) => pattern.test(textOf(card)));
    const ordered = options.compare ? [...found].sort(options.compare) : found;
    add({
      id: `favourite-${style.id}`,
      title: `Because you like ${style.label}`,
      query: style.query,
      cards: ordered.slice(0, perSection),
      kind: "favourite",
    });
  }

  // 3. This hour: only stalls that are open now, the foods people reach for at this time first.
  const wanted = new Set<HomeCategoryId>(timeOfDayPriority(options.hour));
  const isOpen = options.isOpenNow ?? (() => true);
  add({
    id: "hour",
    title: hourSectionTitle(options.hour),
    query: "",
    cards: roundRobinByKind(
      free()
        .filter(isOpen)
        .map((card) => ({
          card,
          score:
            (wanted.has(kindOf(card) as HomeCategoryId) ? 0.4 : 0) +
            fit(card) * 0.3 +
            ((card.topDish?.rating ?? 0) / 5) * 0.3,
        })),
      perSection,
    ),
    kind: "context",
  });

  // 4. Taste sections: stalls whose top dish has the taste, mixed across food kinds.
  const user = palate;
  const tasteOrder: readonly TasteKey[] =
    trusted && user
      ? [...AXES].filter((axis) => user[axis] >= 6).sort((a, b) => user[b] - user[a])
      : DEFAULT_TASTE_ORDER;
  let tasteCount = 0;
  for (const axis of tasteOrder) {
    if (tasteCount >= 2) break;
    if (axis === "spicy" && options.avoidSpicy) continue;
    const meta = TASTE_SECTIONS.find((section) => section.axis === axis);
    if (!meta) continue;
    const scored = free().flatMap((card) => {
      const taste = tastedDish(card.topDish);
      if (!taste || taste.vector[axis] < TASTE_SECTION_MIN_AXIS) return [];
      return [
        {
          card,
          score:
            (taste.vector[axis] / 10) * 0.5 +
            fit(card) * 0.35 +
            ((card.topDish?.rating ?? 0) / 5) * 0.15 +
            kindBoost(card) * 0.2,
        },
      ];
    });
    // At most two of one food kind, so the section is not one dish done many ways.
    const perKind = new Map<string, number>();
    const picked: T[] = [];
    for (const entry of [...scored].sort((a, b) => b.score - a.score)) {
      const kind = kindOf(entry.card);
      if ((perKind.get(kind) ?? 0) >= MAX_PER_KIND_IN_TASTE_SECTION) continue;
      perKind.set(kind, (perKind.get(kind) ?? 0) + 1);
      picked.push(entry.card);
      if (picked.length >= perSection) break;
    }
    if (new Set(picked.map(kindOf)).size < MIN_KINDS) continue;
    if (
      add({
        id: `taste-${meta.id}`,
        title: meta.title,
        query: meta.query,
        cards: picked,
        kind: "taste",
      })
    ) {
      tasteCount += 1;
    }
  }

  // 5. Popular in the area with what is left (already the lead section for someone with no
  // palate yet). It shows right after the hour's section, whenever it was claimed.
  if (trusted) {
    add({
      id: "popular",
      title: "Popular in the area",
      query: "",
      cards: popularPick(),
      kind: "context",
    });
  }

  // 6. New and worth a try: stalls too new to have many reviews, in the feed's own order.
  add({
    id: "new",
    title: "New and worth a try",
    query: "",
    cards: free()
      .filter((card) => (card.topDish?.reviewCount ?? 0) < FRESH_REVIEW_LIMIT)
      .slice(0, perSection),
    kind: "context",
  });

  // Shown in this order, whatever order they were claimed in: the pinned dishes and tastes
  // claim their stalls before the general Popular section does.
  const rank = (section: HomeSection<T>) => {
    if (section.id === "recommended") return 0;
    if (section.id === "hour") return 1;
    if (section.id === "popular") return 2;
    if (section.kind === "favourite") return 3;
    if (section.kind === "taste") return 4;
    return 5;
  };
  return [...sections].sort((a, b) => rank(a) - rank(b)).slice(0, maxSections);
}
