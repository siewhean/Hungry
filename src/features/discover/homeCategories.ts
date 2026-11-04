/**
 * Kinds of food for Home's sections and chips. A stall is placed by what its name and top dish
 * say ("Ah Hock Prawn Noodles" is noodles), because stalls carry no cuisine of their own.
 * Pure: the screen passes the cards it holds and gets sections back.
 */

export type HomeCategoryId =
  | "japkor"
  | "indian"
  | "malay"
  | "soup"
  | "noodles"
  | "rice"
  | "seafood"
  | "chinese"
  | "breakfast"
  | "dessert"
  | "drinks"
  | "western";

export type HomeCategory = {
  id: HomeCategoryId;
  /** The section heading. */
  title: string;
  /** The short word on the Home chip. */
  chipLabel: string;
  /** What the section's chevron searches for. */
  query: string;
  keywords: readonly string[];
};

/**
 * In the order a stall is tried: the first kind that matches claims it, so "Japanese ramen" is
 * Japanese and Korean, not noodles.
 */
export const HOME_CATEGORIES: readonly HomeCategory[] = [
  {
    id: "japkor",
    title: "Japanese and Korean",
    chipLabel: "Japanese and Korean",
    query: "Japanese",
    keywords: [
      "japanese",
      "japan",
      "sushi",
      "ramen",
      "udon",
      "soba",
      "donburi",
      "tonkatsu",
      "yakitori",
      "teppanyaki",
      "izakaya",
      "korean",
      "kimchi",
      "bibimbap",
      "tteokbokki",
      "bulgogi",
    ],
  },
  {
    id: "indian",
    title: "Indian and prata",
    chipLabel: "Indian",
    query: "Prata",
    keywords: [
      "indian",
      "prata",
      "thosai",
      "dosa",
      "naan",
      "tandoori",
      "tandoor",
      "murtabak",
      "mamak",
      "biryani",
      "briyani",
      "vadai",
      "masala",
      "curry puff",
    ],
  },
  {
    id: "malay",
    title: "Malay and Indonesian",
    chipLabel: "Malay",
    query: "Nasi",
    keywords: [
      "malay",
      "nasi",
      "padang",
      "minang",
      "rumah makan",
      "warung",
      "penyet",
      "rendang",
      "satay",
      "sate",
      "mee rebus",
      "soto",
      "lontong",
      "ikan bakar",
    ],
  },
  {
    id: "soup",
    title: "Soups and porridge",
    chipLabel: "Soup",
    query: "Soup",
    keywords: [
      "soup",
      "herbal",
      "bak kut teh",
      "porridge",
      "congee",
      "yong tau foo",
      "tom yum",
      "sliced fish",
      "claypot soup",
    ],
  },
  {
    id: "noodles",
    title: "Noodles",
    chipLabel: "Noodles",
    query: "Noodles",
    keywords: [
      "noodle",
      "noodles",
      "mee",
      "kway teow",
      "kuay teow",
      "hor fun",
      "bee hoon",
      "beehoon",
      "mee pok",
      "laksa",
      "wanton",
      "wonton",
      "lor mee",
      "ban mian",
      "pasta",
      "bak chor mee",
    ],
  },
  {
    id: "rice",
    title: "Rice dishes",
    chipLabel: "Rice",
    query: "Rice",
    keywords: ["rice", "claypot", "economic", "bento", "chicken rice", "duck rice", "lor bak"],
  },
  {
    id: "seafood",
    title: "Seafood",
    chipLabel: "Seafood",
    query: "Seafood",
    keywords: ["seafood", "crab", "prawn", "fish", "oyster", "stingray", "sotong", "clam"],
  },
  {
    id: "chinese",
    title: "Zi char and Chinese",
    chipLabel: "Chinese",
    query: "Zi char",
    keywords: [
      "zi char",
      "tze char",
      "zichar",
      "dim sum",
      "roast",
      "char siew",
      "siew mei",
      "duck",
      "hotpot",
      "steamboat",
      "mala",
      "sichuan",
      "cantonese",
      "teochew",
      "hakka",
      "chinese",
      "wok",
    ],
  },
  {
    id: "breakfast",
    title: "Breakfast and toast",
    chipLabel: "Breakfast",
    query: "Kaya toast",
    keywords: ["toast", "kaya", "breakfast", "bakery", "bread", "pau", "bun", "egg", "pancake"],
  },
  {
    id: "dessert",
    title: "Desserts and sweets",
    chipLabel: "Dessert",
    query: "Dessert",
    keywords: [
      "dessert",
      "ice cream",
      "ice kacang",
      "chendol",
      "cendol",
      "bingsu",
      "cake",
      "waffle",
      "kueh",
      "kuih",
      "tau huay",
      "tau suan",
      "pudding",
      "gelato",
      "orh nee",
      "sweet",
      "ice",
    ],
  },
  {
    id: "drinks",
    title: "Coffee, tea and drinks",
    chipLabel: "Drinks",
    query: "Kopi",
    keywords: [
      "coffee",
      "kopi",
      "tea",
      "teh",
      "juice",
      "drinks",
      "drink",
      "beverage",
      "boba",
      "bubble tea",
      "smoothie",
      "milo",
      "sugar cane",
      "soya",
    ],
  },
  {
    id: "western",
    title: "Western and cafes",
    chipLabel: "Western",
    query: "Western",
    keywords: [
      "western",
      "burger",
      "pizza",
      "steak",
      "fish and chips",
      "cafe",
      "grill",
      "sandwich",
      "fried chicken",
      "mcdonald",
      "kfc",
      "subway",
      "popeyes",
    ],
  },
] as const;

const CATEGORY_BY_ID = new Map(HOME_CATEGORIES.map((category) => [category.id, category]));

export function getHomeCategory(id: HomeCategoryId): HomeCategory {
  return CATEGORY_BY_ID.get(id) as HomeCategory;
}

function escapeForRegex(word: string) {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// One pattern per kind: whole words only, so "ice" is not found in "Price" or "Rice".
const CATEGORY_PATTERNS = new Map<HomeCategoryId, RegExp>(
  HOME_CATEGORIES.map((category) => [
    category.id,
    new RegExp(`\\b(?:${category.keywords.map(escapeForRegex).join("|")})\\b`, "i"),
  ]),
);

/** True when the text names something of this kind. */
export function matchesHomeCategory(id: HomeCategoryId, text: string): boolean {
  return CATEGORY_PATTERNS.get(id)?.test(text) ?? false;
}

/** The first kind (in HOME_CATEGORIES order) that the text names. */
export function classifyHomeText(text: string): HomeCategoryId | undefined {
  return HOME_CATEGORIES.find((category) => matchesHomeCategory(category.id, text))?.id;
}

/** Kinds worth showing first at this Singapore hour; the rest follow in the usual order. */
export function timeOfDayPriority(hour: number): readonly HomeCategoryId[] {
  if (hour >= 5 && hour < 10) return ["breakfast", "drinks", "noodles"];
  if (hour >= 10 && hour < 14) return ["rice", "noodles", "malay"];
  if (hour >= 14 && hour < 17) return ["dessert", "drinks", "breakfast"];
  if (hour >= 17 && hour < 21) return ["chinese", "seafood", "rice"];
  return ["soup", "indian", "malay"];
}

type SectionCard = { venue: { id: string; name: string }; topDish?: { name: string } };

export type HomeCategorySection<T> = {
  id: string;
  title: string;
  /** What the chevron searches for. */
  query: string;
  cards: T[];
};

export type FavouriteFoodStyle = { id: string; label: string; query: string };

export type BuildCategorySectionsOptions<T> = {
  /** Singapore hour of day, for which kinds lead. */
  hour: number;
  /** Popular dishes the diner pinned: each gets its own section first. */
  favourites?: readonly FavouriteFoodStyle[];
  /** Names of dishes the diner has had; their kinds lead too. */
  familiarNames?: readonly string[];
  /** Stalls already shown above (the main rail); sections never repeat them. */
  excludeVenueIds?: ReadonlySet<string>;
  /** Order inside a section; the feed's own order when left out. */
  compare?: (a: T, b: T) => number;
  minItems?: number;
  maxSections?: number;
  perSection?: number;
};

const DEFAULT_MIN_ITEMS = 3;
const DEFAULT_MAX_SECTIONS = 6;
const DEFAULT_PER_SECTION = 10;
const MAX_FAVOURITE_SECTIONS = 2;

function textOf(card: SectionCard) {
  return `${card.venue.name} ${card.topDish?.name ?? ""}`;
}

/**
 * Sections of different foods from the stalls Home holds. Every stall lands in at most one
 * section, so no two rows show the same stall: pinned dishes first, then the kinds the diner
 * has had, then what suits this hour, then the rest. A kind with fewer than a rail's worth of
 * stalls is skipped and leaves its stalls for later kinds.
 */
export function buildCategorySections<T extends SectionCard>(
  cards: readonly T[],
  options: BuildCategorySectionsOptions<T>,
): HomeCategorySection<T>[] {
  const minItems = options.minItems ?? DEFAULT_MIN_ITEMS;
  const maxSections = options.maxSections ?? DEFAULT_MAX_SECTIONS;
  const perSection = options.perSection ?? DEFAULT_PER_SECTION;
  const claimed = new Set<string>(options.excludeVenueIds ?? []);
  const sections: HomeCategorySection<T>[] = [];

  const claim = (id: string, title: string, query: string, matches: (card: T) => boolean) => {
    const found = cards.filter((card) => !claimed.has(card.venue.id) && matches(card));
    if (found.length < minItems) return;
    const ordered = options.compare ? [...found].sort(options.compare) : found;
    const chosen = ordered.slice(0, perSection);
    for (const card of chosen) claimed.add(card.venue.id);
    sections.push({ id, title, query, cards: chosen });
  };

  for (const style of (options.favourites ?? []).slice(0, MAX_FAVOURITE_SECTIONS)) {
    const pattern = new RegExp(`\\b${escapeForRegex(style.label.toLowerCase())}\\b`, "i");
    claim(`favourite-${style.id}`, `${style.label} near you`, style.query, (card) =>
      pattern.test(textOf(card)),
    );
  }

  const familiar = new Set<HomeCategoryId>();
  for (const name of options.familiarNames ?? []) {
    const kind = classifyHomeText(name);
    if (kind) familiar.add(kind);
  }
  const leading = [...familiar, ...timeOfDayPriority(options.hour)];
  const ordered = [
    ...new Set<HomeCategoryId>([...leading, ...HOME_CATEGORIES.map((category) => category.id)]),
  ];
  for (const id of ordered) {
    if (sections.length >= maxSections) break;
    const category = getHomeCategory(id);
    // A stall is judged by the first kind it names, so a kind only claims what is really its own.
    claim(id, category.title, category.query, (card) => classifyHomeText(textOf(card)) === id);
  }
  return sections.slice(0, maxSections);
}
