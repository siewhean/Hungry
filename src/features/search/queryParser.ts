// Pulls the parts of a typed search that are filters, not words to match, so "halal laksa under $5"
// searches for laksa with the Halal and Under S$5 filters on. The words left over are the search text.
// Each part comes back with a key, so a part the user removes is searched for as plain text instead.

export type ParsedDietaryFlag = "halal" | "vegetarian" | "vegan" | "pork_free";

export interface ParsedQueryPart {
  /** `dietary:halal` or `price:5`; pass keys the user removed back in as `dismissed`. */
  key: string;
  kind: "dietary" | "price";
  /** What the chip says: "Halal", "Under S$5". */
  label: string;
  /** The words as typed, for the screen reader and logs. */
  source: string;
}

export interface ParsedSearchQuery {
  /** What is left to search for. Empty when the whole query was filters. */
  text: string;
  dietary: ParsedDietaryFlag[];
  maxPrice?: number;
  parts: ParsedQueryPart[];
}

const DIETARY_WORDS: Record<string, ParsedDietaryFlag> = {
  halal: "halal",
  vegetarian: "vegetarian",
  vegan: "vegan",
  porkfree: "pork_free",
  "pork-free": "pork_free",
};
const DIETARY_LABELS: Record<ParsedDietaryFlag, string> = {
  halal: "Halal",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pork_free: "No pork",
};

const MAX_CAP = 200;
const NUMBER = String.raw`(\d{1,3}(?:\.\d{1,2})?)`;
// "$5", "S$5", "5" after a price word; "under5" and "under$5" are one token.
const AMOUNT_TOKEN = new RegExp(String.raw`^(?:s?\$)?${NUMBER}$`);
const PRICE_WORD_AND_AMOUNT = new RegExp(String.raw`^(?:under|below|<=?)(?:s?\$)?${NUMBER}$`);
const BARE_DOLLAR_AMOUNT = new RegExp(String.raw`^s?\$${NUMBER}$`);
const PRICE_WORDS = new Set(["under", "below", "<", "<="]);
const CURRENCY_WORDS = new Set(["dollar", "dollars", "bucks"]);

const EMPTY_SET: ReadonlySet<string> = new Set();

function bareWord(token: string): string {
  return token.toLowerCase().replace(/[,.;:!?]+$/, "");
}

function parseCap(text: string): number | undefined {
  const value = Number(text);
  return Number.isFinite(value) && value > 0 && value <= MAX_CAP ? value : undefined;
}

function formatCap(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** How many tokens a price phrase starting at `index` takes, and its cap. */
function matchPrice(
  words: readonly string[],
  index: number,
): { used: number; cap: number } | undefined {
  const word = words[index] as string;
  const attached = PRICE_WORD_AND_AMOUNT.exec(word);
  if (attached) {
    const cap = parseCap(attached[1] as string);
    return cap === undefined ? undefined : { used: 1, cap };
  }
  const next = words[index + 1];
  const nextNext = words[index + 2];
  const afterAmount = (used: number) =>
    CURRENCY_WORDS.has(words[index + used] ?? "") ? used + 1 : used;
  if (PRICE_WORDS.has(word) && next !== undefined) {
    const amount = AMOUNT_TOKEN.exec(next);
    const cap = amount ? parseCap(amount[1] as string) : undefined;
    return cap === undefined ? undefined : { used: afterAmount(2), cap };
  }
  if (word === "less" && next === "than" && nextNext !== undefined) {
    const amount = AMOUNT_TOKEN.exec(nextNext);
    const cap = amount ? parseCap(amount[1] as string) : undefined;
    return cap === undefined ? undefined : { used: afterAmount(3), cap };
  }
  // "$5 laksa", "laksa $5", "$5 or less": a bare dollar amount at either end of the query.
  const dollars = BARE_DOLLAR_AMOUNT.exec(word);
  if (dollars) {
    const cap = parseCap(dollars[1] as string);
    if (cap === undefined) return undefined;
    const tail = words.slice(index + 1, index + 3);
    const used =
      (tail[0] === "or" && (tail[1] === "less" || tail[1] === "below")) ||
      (tail[0] === "and" && tail[1] === "below")
        ? 3
        : 1;
    const atEnd = index === 0 || index + used === words.length;
    return atEnd ? { used, cap } : undefined;
  }
  return undefined;
}

export function parseSearchQuery(
  raw: string,
  dismissed: ReadonlySet<string> = EMPTY_SET,
): ParsedSearchQuery {
  const tokens = raw.split(/\s+/).filter(Boolean);
  const words = tokens.map(bareWord);
  const kept: string[] = [];
  const dietary: ParsedDietaryFlag[] = [];
  const parts: ParsedQueryPart[] = [];
  let maxPrice: number | undefined;

  for (let index = 0; index < tokens.length; index += 1) {
    const word = words[index] as string;

    const flag = DIETARY_WORDS[word];
    if (flag && !dismissed.has(`dietary:${flag}`)) {
      if (!dietary.includes(flag)) {
        dietary.push(flag);
        parts.push({
          key: `dietary:${flag}`,
          kind: "dietary",
          label: DIETARY_LABELS[flag],
          source: tokens[index] as string,
        });
      }
      continue;
    }

    // "no pork" and "pork free" are two words each.
    const next = words[index + 1];
    if (
      ((word === "no" && next === "pork") || (word === "pork" && next === "free")) &&
      !dismissed.has("dietary:pork_free")
    ) {
      if (!dietary.includes("pork_free")) {
        dietary.push("pork_free");
        parts.push({
          key: "dietary:pork_free",
          kind: "dietary",
          label: DIETARY_LABELS.pork_free,
          source: `${tokens[index]} ${tokens[index + 1]}`,
        });
      }
      index += 1;
      continue;
    }

    if (maxPrice === undefined) {
      const price = matchPrice(words, index);
      const key = price ? `price:${formatCap(price.cap)}` : undefined;
      if (price && key && !dismissed.has(key)) {
        maxPrice = price.cap;
        parts.push({
          key,
          kind: "price",
          label: `Under S$${formatCap(price.cap)}`,
          source: tokens.slice(index, index + price.used).join(" "),
        });
        index += price.used - 1;
        continue;
      }
    }

    kept.push(tokens[index] as string);
  }

  return { text: kept.join(" "), dietary, maxPrice, parts };
}
