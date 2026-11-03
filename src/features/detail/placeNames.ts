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

function titleCase(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** "Singapore 648310 Pioneer Mrt Stn" and "Pioneer Mrt Station" both read "Pioneer MRT Station". */
export function cleanPlaceName(name: string | null | undefined): string {
  let text = (name ?? "").replace(/\s+/g, " ").trim();
  // A postal code written in front of, or after, the name is the address, not the place.
  text = text
    .replace(/^singapore\s+\d{6}\s+/i, "")
    .replace(/[,\s]+singapore\s+\d{6}$/i, "")
    .trim();
  if (!text) return "";
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
