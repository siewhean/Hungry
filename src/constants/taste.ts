import type {
  HawkerTasteTag,
  TasteKey,
  TasteProfile,
  TasteVector,
  TextureArchetype,
} from "@/types/domain";

export const TASTE_DIMENSIONS: {
  key: TasteKey;
  label: string;
  shortLabel: string;
  icon: string;
}[] = [
  { key: "sweet", label: "Sweet", shortLabel: "Sw", icon: "Sparkles" },
  { key: "spicy", label: "Spicy", shortLabel: "Sp", icon: "Flame" },
  { key: "sour", label: "Sour", shortLabel: "So", icon: "Citrus" },
  { key: "salty", label: "Salty", shortLabel: "Sa", icon: "Waves" },
  { key: "rich", label: "Rich", shortLabel: "Ri", icon: "Soup" },
  { key: "aromatic", label: "Aromatic", shortLabel: "Ar", icon: "Leaf" },
];

export const NEUTRAL_TASTE_VECTOR: TasteVector = {
  sweet: 5,
  spicy: 5,
  sour: 5,
  salty: 5,
  rich: 5,
  aromatic: 5,
};

/** Neutral baseline taste profile for new users / skipped quiz */
export const NEUTRAL_TASTE_PROFILE: TasteProfile = {
  vector: NEUTRAL_TASTE_VECTOR,
  bitterTolerance: 5,
  fatAffinity: 5,
  textureArchetype: "mixed" as TextureArchetype,
  neophiliaIndex: 5,
  spiceSeeking: 5,
};

// ─── Review Tags ──────────────────────────────────────────────────────────────

export const REVIEW_TAGS = [
  "Spicy",
  "Sweet",
  "Sour",
  "Savoury",
  "Rich",
  "Light",
  "Fragrant",
  "Crispy",
  "Soft",
];

// ─── Localized Hawker Taste Tag Taxonomy ──────────────────────────────────────

/**
 * Each hawker tag maps community vocabulary to quantifiable AI vector deltas.
 * When a user applies a tag to a dish review, the engine uses `vectorImpact`
 * to calibrate both the dish's community vector and the user's personal vector.
 */
export const HAWKER_TASTE_TAGS: {
  key: HawkerTasteTag;
  label: string;
  emoji: string;
  description: string;
  /** Additive adjustment to taste vector axes when this tag is applied */
  vectorImpact: Partial<TasteVector>;
}[] = [
  {
    key: "wok_hei",
    label: "Wok Hei",
    emoji: "🔥",
    description: "Smoky charred aroma from the wok",
    vectorImpact: { aromatic: 2, salty: 1, rich: 1 },
  },
  {
    key: "lemak",
    label: "Lemak",
    emoji: "🥥",
    description: "Rich & creamy coconut-based",
    vectorImpact: { rich: 3, sweet: 1 },
  },
  {
    key: "qq",
    label: "QQ",
    emoji: "🟠",
    description: "Bouncy & springy texture",
    vectorImpact: {}, // pure texture signal — no taste vector impact
  },
  {
    key: "jelak",
    label: "Jelak",
    emoji: "😵",
    description: "Too rich, cloying, overwhelming",
    vectorImpact: { rich: -2, sweet: -1 }, // negative signal
  },
  {
    key: "hiam",
    label: "Hiam",
    emoji: "🌶️",
    description: "Intense, aggressive spiciness",
    vectorImpact: { spicy: 3 },
  },
  {
    key: "gao",
    label: "Gao",
    emoji: "☕",
    description: "Thick & concentrated",
    vectorImpact: { rich: 2, aromatic: 1 },
  },
  {
    key: "chao_ta",
    label: "Chao Ta",
    emoji: "🖤",
    description: "Charred or burnt edge",
    vectorImpact: { aromatic: 1 },
  },
  {
    key: "shiok",
    label: "Shiok",
    emoji: "👌",
    description: "Intensely satisfying, perfect balance",
    vectorImpact: { sweet: 1, salty: 1, rich: 1 }, // broad positive
  },
  {
    key: "sedap",
    label: "Sedap",
    emoji: "😋",
    description: "Deeply delicious, umami-rich",
    vectorImpact: { salty: 1, rich: 1, aromatic: 1 },
  },
  {
    key: "power",
    label: "Power!",
    emoji: "💪",
    description: "Exceptionally strong flavor",
    vectorImpact: { spicy: 1, salty: 1, aromatic: 1 },
  },
];

/** Extended review tags = basic English tags + hawker-specific Singlish tags */
export const EXTENDED_REVIEW_TAGS = [
  ...REVIEW_TAGS,
  "Wok Hei",
  "Lemak",
  "QQ",
  "Jelak",
  "Hiam",
  "Gao",
  "Chao Ta",
  "Shiok",
  "Sedap",
];
