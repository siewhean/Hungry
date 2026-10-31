/**
 * A stall name for display. Half the catalogue comes from licence data in ALL CAPS
 * ("TIAN TIAN HAINANESE CHICKEN RICE"), which shouts on a page. Names that are entirely
 * upper case are shown in title case; a name with any lower-case letter was written by a
 * person and is left alone. Display only: store, copy and share the stored name.
 */

/** Stay upper case: acronyms the title-case rule would otherwise spoil. */
const KEEP_UPPER = new Set([
  "ABC",
  "BBQ",
  "DIY",
  "FC",
  "HDB",
  "HK",
  "II",
  "III",
  "IV",
  "JB",
  "KFC",
  "KL",
  "MRT",
  "NTUC",
  "OK",
  "SG",
  "TCM",
  "TV",
  "UK",
  "US",
  "USA",
  "XO",
]);

/** Vowel-less words look like acronyms but are plain abbreviations: show them as words. */
const FORCE_TITLE = new Set(["BLK", "LTD", "MR", "MRS", "PL", "RD", "ST", "NTH", "STH"]);

/** Lower case when not the first word. */
const SMALL_WORDS = new Set([
  "and",
  "at",
  "bin",
  "binte",
  "by",
  "for",
  "in",
  "of",
  "on",
  "the",
  "to",
]);

const hasLowerCase = (value: string) => /\p{Ll}/u.test(value);
const hasLetter = (value: string) => /\p{L}/u.test(value);

function capitalise(part: string): string {
  // "MCDONALD" -> "McDonald".
  if (/^MC\p{Lu}{3,}$/u.test(part.toUpperCase())) return `Mc${capitalise(part.slice(2))}`;
  const lower = part.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleToken(token: string, isFirst: boolean) {
  const upper = token.toUpperCase();
  // "#01-10", "S11", "7": anything with a digit keeps its letters as typed (upper case).
  if (/\d/.test(token)) return upper;
  if (KEEP_UPPER.has(upper)) return upper;
  if (FORCE_TITLE.has(upper)) return capitalise(token);
  // No vowels in 2 to 5 letters: an initialism such as BKT or CKT.
  if (/^[BCDFGHJKLMNPQRSTVWXZ]{2,5}$/.test(upper)) return upper;
  const lower = token.toLowerCase();
  if (!isFirst && SMALL_WORDS.has(lower)) return lower;
  // "MCDONALD'S" -> "McDonald's"; "D'ORIENT" -> "D'Orient"; "DAVID'S" -> "David's".
  if (token.includes("'") || token.includes("’")) {
    return token
      .split(/(['’])/)
      .map((piece, index, pieces) => {
        if (piece === "'" || piece === "’") return piece;
        const previous = pieces[index - 2];
        const isTail = index > 0 && piece.length === 1 && previous !== undefined;
        return isTail && piece.toLowerCase() === "s" ? "s" : capitalise(piece);
      })
      .join("");
  }
  return capitalise(token);
}

export function toDisplayName(name: string): string {
  if (!hasLetter(name) || hasLowerCase(name)) return name;
  let wordIndex = 0;
  // Split on spaces and keep the separators; hyphens and slashes split words but stay.
  return name
    .split(/(\s+)/)
    .map((chunk) => {
      if (/^\s*$/.test(chunk)) return chunk;
      return chunk
        .split(/([-/&()])/)
        .map((piece) => {
          if (!hasLetter(piece) && !/\d/.test(piece)) return piece;
          const result = titleToken(piece, wordIndex === 0);
          wordIndex += 1;
          return result;
        })
        .join("");
    })
    .join("");
}
