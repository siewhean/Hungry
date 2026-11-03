/**
 * Home's sections below the main stall rail: one made of different foods that suit the diner,
 * sections built on a taste (spicy, rich, sweet...) that mix food types, and the food-kind
 * sections (noodles, rice...). A stall sits in one section only. Pure: the screen passes the
 * stalls it holds and the diner's palate, and gets the sections back.
 */
import {
  buildCategorySections,
  classifyHomeText,
  type BuildCategorySectionsOptions,
  type HomeCategoryId,
} from "@/features/discover/homeCategories";
import type { TasteKey, TasteVector } from "@/types/domain";

export type HomeSectionDish = {
  name: string;
  rating?: number;
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
  kind: "recommended" | "taste" | "favourite" | "food";
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
const MIN_KINDS_RECOMMENDED = 3;
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

/**
 * Builds Home's sections in the order they show: recommended foods, the diner's pinned dishes,
 * then taste and food-kind sections taking turns.
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

  // 1. Recommended: the best fits, one food kind at a time.
  let recommended: HomeSection<T> | undefined;
  {
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
    const picked = roundRobinByKind(scored, perSection);
    if (picked.length >= minItems && new Set(picked.map(kindOf)).size >= MIN_KINDS_RECOMMENDED) {
      claim(picked);
      recommended = {
        id: "recommended",
        title: trusted ? "Recommended for you" : "Popular near you",
        query: "",
        cards: picked,
        kind: "recommended",
      };
    }
  }

  // 2. Taste sections: stalls whose top dish has the taste, mixed across food kinds.
  const user = palate;
  const tasteOrder: readonly TasteKey[] =
    trusted && user
      ? [...AXES].filter((axis) => user[axis] >= 6).sort((a, b) => user[b] - user[a])
      : DEFAULT_TASTE_ORDER;
  const tasteSections: HomeSection<T>[] = [];
  for (const axis of tasteOrder) {
    if (tasteSections.length >= 2) break;
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
    if (picked.length < minItems || new Set(picked.map(kindOf)).size < MIN_KINDS) continue;
    claim(picked);
    tasteSections.push({
      id: `taste-${meta.id}`,
      title: meta.title,
      query: meta.query,
      cards: picked,
      kind: "taste",
    });
  }

  // 3. Food kinds (pinned dishes first, then what the diner has had, then the hour).
  const foodAll = buildCategorySections(cards, {
    ...options,
    excludeVenueIds: claimed,
    maxSections,
  }).map<HomeSection<T>>((section) => ({
    ...section,
    kind: section.id.startsWith("favourite-") ? "favourite" : "food",
  }));
  const favourites = foodAll.filter((section) => section.kind === "favourite");
  const foods = foodAll.filter((section) => section.kind === "food");

  const ordered: HomeSection<T>[] = [];
  if (recommended) ordered.push(recommended);
  ordered.push(...favourites);
  const turns = Math.max(tasteSections.length, foods.length);
  for (let index = 0; index < turns; index += 1) {
    // A food kind first when the diner has a taste to lead with, so the page alternates.
    if (tasteSections[index]) ordered.push(tasteSections[index]);
    if (foods[index]) ordered.push(foods[index]);
  }
  return ordered.slice(0, maxSections);
}
