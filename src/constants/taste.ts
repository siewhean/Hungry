import type { TasteKey, TasteVector } from "@/types/domain";

export const TASTE_DIMENSIONS: Array<{
  key: TasteKey;
  label: string;
  shortLabel: string;
  icon: string;
}> = [
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

