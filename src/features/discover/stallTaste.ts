/**
 * A rough taste for a stall whose dishes carry no taste data yet: read from its name and the
 * cuisine tags the catalogue holds ("thai", "bakery", "ramen"). Most stalls have no menu in the
 * app, and the menus there are have not been taste-tagged, so without this every stall looks the
 * same to the palate and Home falls back to distance alone.
 *
 * It is a hint, never shown as a fact: its confidence stays below the level that shows a match
 * percentage (see shouldShowMatchPercent), and a dish's own tagged taste always wins over it.
 * Pure: no service reads.
 */
import type { TasteKey, TasteVector } from "@/types/domain";

/** Trust in a lean read from a name or cuisine tag: enough to order by, too little to show. */
export const STALL_LEAN_CONFIDENCE = 0.4;

const NEUTRAL = 5;
const STEP = 2;
const LOW = 1;
const HIGH = 9;

type Cue = { words: readonly string[]; lean: Partial<Record<TasteKey, number>> };

/** Each cue moves the axes it names by that many steps from neutral (negative = milder). */
const CUES: readonly Cue[] = [
  {
    words: ["thai", "tom yum", "tomyum", "som tam", "isaan", "isan"],
    lean: { spicy: 1.5, sour: 1.5, aromatic: 1.5 },
  },
  { words: ["vietnamese", "pho", "banh mi"], lean: { aromatic: 1.5, sour: 1 } },
  {
    words: [
      "mala",
      "sichuan",
      "szechuan",
      "chongqing",
      "hunan",
      "chilli",
      "chili",
      "spicy",
      "sambal",
    ],
    lean: { spicy: 2 },
  },
  { words: ["korean", "kimchi", "tteokbokki", "bibimbap"], lean: { spicy: 1, salty: 1 } },
  {
    words: [
      "indian",
      "prata",
      "biryani",
      "briyani",
      "tandoor",
      "tandoori",
      "masala",
      "thosai",
      "dosa",
    ],
    lean: { spicy: 1, aromatic: 1.5, rich: 1 },
  },
  { words: ["curry", "laksa", "rendang"], lean: { spicy: 1, rich: 1.5, aromatic: 1 } },
  {
    words: [
      "malay",
      "malaysian",
      "indonesian",
      "padang",
      "minang",
      "penyet",
      "nasi lemak",
      "satay",
    ],
    lean: { spicy: 1, aromatic: 1, rich: 1 },
  },
  { words: ["mexican", "taco", "burrito"], lean: { spicy: 1, sour: 0.5 } },
  {
    words: ["japanese", "ramen", "sushi", "izakaya", "udon", "donburi", "teriyaki", "yakitori"],
    lean: { salty: 1.5 },
  },
  { words: ["ramen", "tonkotsu"], lean: { rich: 1.5 } },
  {
    words: ["burger", "pizza", "steak", "steak house", "steakhouse", "western", "grill", "bbq"],
    lean: { rich: 1.5, salty: 1 },
  },
  { words: ["italian", "pasta", "carbonara", "cheese"], lean: { rich: 1.5, salty: 0.5 } },
  {
    words: ["fried chicken", "chicken wing", "wings", "fish and chips"],
    lean: { rich: 1.5, salty: 1 },
  },
  {
    words: ["bak kut teh", "herbal", "mediterranean", "middle eastern", "turkish", "lebanese"],
    lean: { aromatic: 1.5 },
  },
  {
    words: [
      "dessert",
      "ice cream",
      "gelato",
      "cake",
      "bakery",
      "pastry",
      "patisserie",
      "waffle",
      "bingsu",
      "chendol",
      "cendol",
      "kueh",
      "kuih",
      "donut",
      "doughnut",
      "chocolate",
      "crepe",
      "tau huay",
      "pudding",
      "kaya",
    ],
    lean: { sweet: 2 },
  },
  { words: ["bubble tea", "boba", "milk tea", "juice", "smoothie"], lean: { sweet: 1.5 } },
  { words: ["coffee", "kopi", "cafe", "coffee shop"], lean: { aromatic: 1, sweet: 0.5 } },
  { words: ["salad", "poke", "healthy", "vegetarian", "vegan"], lean: { rich: -1, sour: 0.5 } },
  { words: ["porridge", "congee", "fish soup", "sliced fish"], lean: { rich: -1, spicy: -1 } },
];

const AXES: readonly TasteKey[] = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"];

function escapeForRegex(word: string) {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CUE_PATTERNS = CUES.map((cue) => ({
  lean: cue.lean,
  pattern: new RegExp(`\\b(?:${cue.words.map(escapeForRegex).join("|")})\\b`, "i"),
}));

/** The words a stall is known by: its name and its cuisine tags ("coffee_shop" reads "coffee shop"). */
export function stallText(name: string, cuisineTags: readonly string[] = []): string {
  return [name, ...cuisineTags.map((tag) => tag.replace(/[_-]+/g, " "))].join(" ").toLowerCase();
}

/**
 * The stall's likely taste, or undefined when nothing in its name or tags says anything about
 * taste (a plain "Stall 12" stays unknown rather than looking neutral).
 */
export function stallTasteLean(
  name: string,
  cuisineTags: readonly string[] = [],
): TasteVector | undefined {
  const text = stallText(name, cuisineTags);
  const steps: Record<TasteKey, number> = {
    sweet: 0,
    spicy: 0,
    sour: 0,
    salty: 0,
    rich: 0,
    aromatic: 0,
  };
  let matched = false;
  for (const { pattern, lean } of CUE_PATTERNS) {
    if (!pattern.test(text)) continue;
    matched = true;
    for (const axis of AXES) steps[axis] += lean[axis] ?? 0;
  }
  if (!matched) return undefined;
  const vector = {} as TasteVector;
  for (const axis of AXES) {
    vector[axis] = Math.min(HIGH, Math.max(LOW, NEUTRAL + steps[axis] * STEP));
  }
  return vector;
}
