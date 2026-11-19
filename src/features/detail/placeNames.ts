/**
 * One way of writing a building's name. The catalog holds the same place under several spellings
 * ("Pioneer Mrt Station", "Singapore 648310 Pioneer Mrt Stn"), and Home shows them side by side,
 * so names are cleaned the same way everywhere before they are shown or compared. Pure.
 */

const ACRONYMS: Readonly<Record<string, string>> = {
  mrt: "MRT",
  lrt: "LRT",
  hdb: "HDB",
  ntuc: "NTUC",
  nus: "NUS",
  ntu: "NTU",
  smu: "SMU",
};

const ABBREVIATIONS: Readonly<Record<string, string>> = {
  stn: "Station",
  ctr: "Centre",
  cntr: "Centre",
  center: "Centre",
};

const INVALID_BUILDING_RE =
  /^(?:(?:\(?part\s+of|\(?portion|\(?sub-?unit|\(?left\s+part|\(?right\s+part|mr\d+|mc\d+|\(?blk\s*n\d|\(?n\d\.\d|\(?\d+(?:st|nd|rd|th)?\s*storey).*)[\)\]]?$/i;

function titleCase(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** "Singapore 648310 Pioneer Mrt Stn" and "Pioneer Mrt Station" both read "Pioneer MRT Station". */
export function cleanPlaceName(name: string | null | undefined): string {
  let text = (name ?? "").replace(/\s+/g, " ").trim();
  if (!text || INVALID_BUILDING_RE.test(text)) return "";

  // Strip trailing storey / level / subunit suffixes first so trailing postal codes become exposed
  text = text
    .replace(
      /\s*\((?:1st|2nd|3rd|[0-9]+th)?\s*(?:storey|level|unit|sub-?unit|part|portion|mr\d*|mc\d*)[^)]*\)/gi,
      "",
    )
    .replace(/\s*(?:1st|2nd|3rd|[0-9]+th)?\s*storey.*$/gi, "")
    .replace(/\s*level\s+[0-9a-z\s-]+$/gi, "")
    .replace(/\s*\(?mr\s*\d+\)?$/gi, "")
    .trim();

  // Strip postal codes (leading, trailing, or embedded before unit/storey)
  text = text
    .replace(/^singapore\s+\d{6}\s*/i, "")
    .replace(/(?:\b|,\s*)singapore\s+\d{6}\b/gi, "")
    .replace(/[,\s]+\d{6}$/, "")
    .trim();

  if (!text || INVALID_BUILDING_RE.test(text)) return "";

  // Strip trailing unit numbers like "#01-75/76", "#B1-12", "#02-101"
  text = text.replace(/[\s,#]+(?:b\d+|\d+)-[0-9a-z\/-]+$/i, "").trim();

  // Strip trailing storey / level / subunit suffixes again if exposed
  text = text
    .replace(
      /\s*\((?:1st|2nd|3rd|[0-9]+th)?\s*(?:storey|level|unit|sub-?unit|part|portion|mr\d*|mc\d*)[^)]*\)/gi,
      "",
    )
    .replace(/\s*(?:1st|2nd|3rd|[0-9]+th)?\s*storey.*$/gi, "")
    .replace(/\s*level\s+[0-9a-z\s-]+$/gi, "")
    .replace(/\s*\(?mr\s*\d+\)?$/gi, "")
    .trim();

  // A bare unit number or bare postal code is never a building name
  if (
    !text ||
    /^#(?:[b0-9]+-[0-9a-z\/-]+|[0-9a-z\/-]+)$/i.test(text) ||
    /^[b0-9]+-[0-9a-z\/-]+$/i.test(text) ||
    INVALID_BUILDING_RE.test(text)
  ) {
    return "";
  }
  if (/^singapore\s+\d{6}$/i.test(text) || /^\d{6}$/.test(text)) return "";

  // A name typed in capitals reads as a shout; codes like "JW50" or "NTU" stay as they are.
  const shouted = text === text.toUpperCase() && /[A-Z]{2,}.*\s/.test(text);
  return text
    .split(" ")
    .map((word) => {
      const bare = word.toLowerCase();
      if (ABBREVIATIONS[bare]) return ABBREVIATIONS[bare];
      if (ACRONYMS[bare]) return ACRONYMS[bare];
      return shouted ? titleCase(word) : word;
    })
    .join(" ");
}

/** Two names with the same key are the same place. */
export function placeKey(name: string | null | undefined): string {
  return cleanPlaceName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
