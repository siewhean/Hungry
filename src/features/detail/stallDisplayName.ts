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
  "LRT",
  "MRT",
  "NTU",
  "NTUC",
  "NUS",
  "OK",
  "SAFRA",
  "SG",
  "SIM",
  "SIT",
  "SMU",
  "SUTD",
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

const STREET_TYPE_PATTERN =
  "(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Crescent|Cres|Lane|Ln|Way|Walk|Boulevard|Blvd|Lorong|Lor|Place|Pl|Close|Cl|Park|Jalan|Jln|Industrial(?:\\s+Park(?:\\s+[A-Za-z0-9]+)?)?|Ring(?:\\s+Road)?|Highway|Turn|Hill|Rise|Link|View|Bank|Quay|Grove|Square)";

const SG_TOWNS = [
  "Ang Mo Kio",
  "Bedok",
  "Bishan",
  "Bukit Batok",
  "Bukit Merah",
  "Bukit Panjang",
  "Bukit Timah",
  "Central",
  "Choa Chu Kang",
  "Clementi",
  "Geylang",
  "Hougang",
  "Jurong East",
  "Jurong West",
  "Kallang",
  "Marine Parade",
  "Novena",
  "Pasir Ris",
  "Punggol",
  "Queenstown",
  "Sembawang",
  "Sengkang",
  "Serangoon",
  "Tampines",
  "Toa Payoh",
  "Woodlands",
  "Yishun",
  "Changi",
  "Ubi",
  "Bugis",
  "Chinatown",
  "Orchard",
  "Tanjong Pagar",
  "Katong",
  "Tiong Bahru",
  "Telok Blangah",
];

const ADDRESS_SUFFIX_REGEX = new RegExp(
  `\\s+((?:(?:blk|block)\\s*\\d+[A-Za-z]?|\\d+[A-Za-z]?)\\s+.*\\b${STREET_TYPE_PATTERN}\\b.*)$`,
  "i",
);

/**
 * Detect synthetic SFA license fallback names that are placeholder entries rather than real food stalls.
 * e.g. 'SFA Licensed Stall #01-01 (TP00101001)', 'SFA Licensed Food Establishment (E82092C020)'
 */
export function isPlaceholderStall(name: string | null | undefined): boolean {
  if (!name) return false;
  return /^sfa\s+licensed\s+(?:stall|food\s+establishment)/i.test(name.trim());
}

/**
 * Clean location qualifiers inside stall names or addresses.
 * Removes postal codes, bare unit numbers (#01-12), SFA licence numbers,
 * leading block numbers, leading street numbers, and separates composite
 * street-address + landmark entries (e.g. '76 Nanyang Drive 01-06 NTU North Spine' -> 'NTU North Spine').
 */
export function cleanLocationQualifier(qualifier: string): string {
  let q = qualifier.trim();
  // Strip postal codes e.g. Singapore 637331 or 637331
  q = q
    .replace(/singapore\s*\d{6}/gi, "")
    .replace(/\b\d{6}\b/g, "")
    .trim();

  // If qualifier is purely a unit number e.g. '#01-12' or '01-72', strip entirely
  if (/^(?:#\s*)?[b0-9]+(?:\s*-\s*[0-9a-z\/-]+)+$/i.test(q)) return "";
  // If qualifier is SFA licence e.g. 'GB20108001', strip entirely
  if (/^[A-Z]{2}\d{8}$/i.test(q)) return "";
  // If qualifier is noise e.g. 'part of', 'left part of', 'outlet #9', strip
  if (/^(?:(?:left|right)?\s*part\s*of|outlet\s*#?\d+|drinks\s*stall)$/i.test(q)) return "";

  // 1. If string contains an embedded unit number separating address from location name:
  // e.g. '76 Nanyang Drive 01-06 NTU North Spine' -> 'NTU North Spine'
  // e.g. '2 Bukit Batok West Ave 7 01-01/02/03 HomeTeamNS' -> 'HomeTeamNS'
  const unitSplit = q.match(
    /^(.*?)(?:,\s*|\s+)(?:#\s*)?([B0-9]+-[0-9A-Za-z\/-]+)(?:,\s*|\s+)(.*?)$/i,
  );
  if (unitSplit && unitSplit[3].trim()) {
    let right = unitSplit[3].trim();
    right = right.replace(/^(?:k\d+\s+)+/i, "").trim();
    if (right.length >= 2 && !/^(?:singapore|\d{6})/i.test(right)) {
      return right;
    }
  }

  // 2. Strip leading unit numbers: '#01-06 NTU North Spine' -> 'NTU North Spine'
  q = q.replace(/^(?:#\s*)?[b0-9]+(?:\s*-\s*[0-9a-z\/-]+)+\s*,?\s*/i, "").trim();
  // 3. Strip trailing unit numbers: 'NTU North Spine #01-06' -> 'NTU North Spine'
  q = q.replace(/[\s,#]+(?:b\d+|\d+)-[0-9a-z\/-]+$/i, "").trim();
  // 4. Strip block prefixes: 'Blk 221 Boon Lay Place' -> 'Boon Lay Place'
  q = q.replace(/^(?:blk|block)\s*\d+[a-z]?\s*,?\s*/i, "").trim();
  // 5. Strip leading street numbers when followed by a street type or Singapore town
  const streetRegex = new RegExp(`^\\d+[A-Za-z]?\\s+(?=.*\\b${STREET_TYPE_PATTERN}\\b)`, "i");
  const blockTownRegex = new RegExp(`^\\d{2,4}[A-Za-z]?\\s+(?=(?:${SG_TOWNS.join("|")})\\b)`, "i");
  if (streetRegex.test(q)) {
    q = q.replace(/^\d+[A-Za-z]?\s+/i, "").trim();
  } else if (blockTownRegex.test(q)) {
    q = q.replace(/^\d{2,4}[A-Za-z]?\s+/i, "").trim();
  }

  // Normalize common street abbreviations without breaking Saint (St George)
  q = q
    .replace(/\bRd\.?\b/gi, "Road")
    .replace(/(\b[A-Za-z]+)\s+St\.?(?=\s+\d+|\s*$|,)/gi, "$1 Street")
    .replace(/\bSt\.?$/gi, "Street")
    .replace(/\bAve\.?\b/gi, "Avenue")
    .replace(/\bDr\.?\b/gi, "Drive")
    .replace(/\bJln\.?\b/gi, "Jalan")
    .replace(/\bLor\.?\b/gi, "Lorong")
    .replace(/\bCres\.?\b/gi, "Crescent");

  return q;
}

/**
 * Clean a raw stall name to ensure chain stalls show clean location qualifiers in parentheses,
 * without raw address fragments (block numbers, street numbers, unit numbers).
 */
export function cleanStallName(rawName: string): string {
  if (!rawName) return rawName;
  let name = rawName.trim();
  if (isPlaceholderStall(name)) return "";

  // 1. Parentheses format: 'Brand (Location)'
  const parenMatch = name.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    const brand = parenMatch[1].trim();
    const rawLoc = parenMatch[2].trim();
    const cleanedLoc = cleanLocationQualifier(rawLoc);
    if (!cleanedLoc) {
      return brand;
    }
    return `${brand} (${cleanedLoc})`;
  }

  // 2. Marketing noise: 'Brand | Description – Location'
  if (name.includes(" | ") && name.includes("–")) {
    const parts = name.split("–");
    const brandPart = name.split(" | ")[0].trim();
    const locPart = parts[parts.length - 1].trim();
    if (locPart && brandPart) {
      return `${brandPart} (${locPart})`;
    }
  }

  // 3. Hyphen or pipe address format: 'Brand - 46 Telok Blangah Drive'
  const hyphenMatch = name.match(/^(.*?)\s+[-|]\s+(\d+[A-Za-z]?\s+.*)$/);
  if (hyphenMatch) {
    const brand = hyphenMatch[1].trim();
    const rawAddr = hyphenMatch[2].trim();
    const cleanedAddr = cleanLocationQualifier(rawAddr);
    if (cleanedAddr) {
      return `${brand} (${cleanedAddr})`;
    }
  }

  // 4. Any stall or brand followed directly by a street address without parentheses:
  // e.g. 'Song Fa Bak Kut Teh 11 New Bridge Rd' -> 'Song Fa Bak Kut Teh (New Bridge Road)'
  // e.g. 'Peperoni Pizzeria 95 Frankel Ave' -> 'Peperoni Pizzeria (Frankel Avenue)'
  // e.g. 'The Penyet Co Blk 678A Woodlands Ave 6' -> 'The Penyet Co (Woodlands Avenue 6)'
  const addrSuffixMatch = name.match(ADDRESS_SUFFIX_REGEX);
  if (addrSuffixMatch && addrSuffixMatch.index !== undefined && addrSuffixMatch.index > 0) {
    const brand = name.slice(0, addrSuffixMatch.index).trim();
    const rawAddr = addrSuffixMatch[1].trim();
    const cleanedAddr = cleanLocationQualifier(rawAddr);
    if (cleanedAddr) {
      return `${brand} (${cleanedAddr})`;
    }
  }

  // 5. Chain brand followed by address/block without parentheses:
  const chainPrefixes = [
    "Starbucks",
    "McDonald's",
    "KFC",
    "Subway",
    "Toast Box",
    "Ya Kun",
    "BreadTalk",
    "LiHO",
    "KOI",
    "Gong Cha",
    "Old Chang Kee",
    "Pizza Hut",
    "Burger King",
    "Crave",
    "Encik Tan",
    "PastaMania",
    "Mr Bean",
    "Kimly",
    "ChopSteak",
    "Chops & Sear",
    "Chocolate Origin",
    "Chuan Wei Mala Hot Pot",
    "Happy Bites By Swee Heng",
    "San.wich by Swee Heng",
    "Bengawan Solo",
  ];

  for (const prefix of chainPrefixes) {
    if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
      const rest = name
        .slice(prefix.length)
        .trim()
        .replace(/^[-–\s|]+/, "");
      if (rest) {
        const hasAddress =
          /^(?:blk|block|\d+|#)/i.test(rest) ||
          new RegExp(`\\b${STREET_TYPE_PATTERN}\\b`, "i").test(rest);
        if (hasAddress) {
          const cleaned = cleanLocationQualifier(rest);
          if (cleaned) {
            return `${prefix} (${cleaned})`;
          }
          return prefix;
        }
      }
    }
  }

  return name;
}

export function toDisplayName(name: string): string {
  if (!name) return "";
  const cleaned = cleanStallName(name);
  if (!cleaned) return "";
  if (!hasLetter(cleaned) || hasLowerCase(cleaned)) return cleaned;
  let wordIndex = 0;
  // Split on spaces and keep the separators; hyphens and slashes split words but stay.
  return cleaned
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
