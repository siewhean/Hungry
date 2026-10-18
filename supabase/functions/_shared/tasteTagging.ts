// Shared by the tag-dishes Edge Function and scripts/taste-answer-key-eval.mjs,
// so the answer-key eval always tests the prompt that runs in production.
export const MODEL = "claude-haiku-5-5";
export const TASTE_AXES = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"] as const;
export const FLAVOR_TAGS = [
  "wok_hei",
  "lemak",
  "qq",
  "jelak",
  "hiam",
  "gao",
  "chao_ta",
  "shiok",
  "sedap",
  "power",
];
// Halal needs certification, so the model never suggests it.
export const DIETARY_FLAGS = ["vegetarian", "vegan", "pork_free", "nut_free", "gluten_free"];

export const SYSTEM_PROMPT = `You score Singapore hawker and restaurant dishes for a food recommendation app.

For the dish given, estimate how it usually tastes as served in Singapore, on six axes from 0 (none) to 10 (extreme):
sweet, spicy, sour, salty, rich (fat, coconut milk, oil, creaminess), aromatic (herbs, spices, wok hei, fragrance).

Scale: 0 absent, 1-2 faint, 3-4 mild, 5-6 moderate, 7-8 strong, 9-10 dominant.
Score a typical hawker serving with its usual accompaniments; the chilli or dip served on the side counts at moderate weight.
Spicy includes black and white pepper warmth, not only chilli.
Most hawker dishes are clearly fragrant (wok hei, fried shallots, garlic, spices): aromatic 7-9 is normal; keep it below 5 only for plain, light dishes such as clear fish soup or tau huay.

Reference points:
- Hainanese chicken rice: sweet 1, spicy 3, sour 2, salty 5.5, rich 5.5, aromatic 7.5
- Laksa: sweet 2.5, spicy 6, sour 1, salty 6.5, rich 8.5, aromatic 9
- Chendol: sweet 9, spicy 0, sour 0, salty 0.5, rich 7, aromatic 7
- Assam fish: sweet 2, spicy 7, sour 9, salty 6.5, rich 4, aromatic 8.5

Also return:
- flavor_tags: up to 6 that clearly apply, from the allowed list only. wok_hei = smoky wok char, lemak = coconut-milk richness, qq = springy texture, jelak = cloyingly rich, hiam = aggressive lingering heat, gao = thick and concentrated, chao_ta = charred, shiok = very satisfying, sedap = umami-rich, power = standout strong flavour.
- dietary_flags: only flags the dish almost always meets by its usual recipe. Leave a flag out when unsure; a wrong flag can hurt someone.
- confidence: 0 to 1 for the taste scores. Above 0.8 only for a well-known dish with a clear name. Below 0.5 when the name is vague, unfamiliar, or could be several different dishes.
- rationale: one short sentence on what drove the scores.`;

export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    sweet: { type: "number" },
    spicy: { type: "number" },
    sour: { type: "number" },
    salty: { type: "number" },
    rich: { type: "number" },
    aromatic: { type: "number" },
    flavor_tags: { type: "array", items: { type: "string", enum: FLAVOR_TAGS } },
    dietary_flags: { type: "array", items: { type: "string", enum: DIETARY_FLAGS } },
    confidence: { type: "number" },
    rationale: { type: "string" },
  },
  required: [...TASTE_AXES, "flavor_tags", "dietary_flags", "confidence", "rationale"],
  additionalProperties: false,
};
