/**
 * Venue address formatting.
 *
 * Catalog rows often arrive with the same address fragments repeated across
 * `buildingName`, `address`, `unitNumber`, and `postalCode`, e.g.
 * "190 LORONG 6 TOA PAYOH #02-514,Singapore 310190 | Unit: 02-514 | Postal code: 310190".
 * These helpers turn that into clean, deduplicated parts for display.
 */

export type VenueAddressInput = {
  venueName?: string;
  unitNumber?: string;
  buildingName?: string;
  address?: string;
  postalCode?: string;
  planningArea?: string;
};

export type FormattedVenueAddress = {
  /** Clean building / operator name (e.g. "Toa Payoh West Market"), when the source has a real one. */
  building?: string;
  /** Short street line, e.g. "190 Lorong 6 Toa Payoh". */
  street?: string;
  /** Normalised unit, e.g. "#02-514". */
  unit?: string;
  /** Six-digit postal code. */
  postalCode?: string;
  /** Display lines in order: building, street, "Unit #02-514", "Singapore 310190". */
  lines: string[];
};

const POSTAL_PATTERN = /\b(\d{6})\b/;
const UNIT_CODE_PATTERN = /#?\s*([A-Z]?\d{1,3}[A-Z]?\s*-\s*\d{1,5}[A-Z]?)\b/i;

function clean(value?: string) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function isAllCaps(value: string) {
  const letters = value.replace(/[^A-Za-z]/g, "");
  return letters.length > 0 && letters === letters.toUpperCase();
}

/** Title-cases words while leaving tokens that contain digits (e.g. "2A", "#02-514") uppercase. */
export function toDisplayCase(value: string) {
  return value
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (/\d/.test(word)) return word.toUpperCase();
      return word
        .toLowerCase()
        .replace(/(^|[-'(/])([a-z])/g, (_match, prefix: string, char: string) => {
          return `${prefix}${char.toUpperCase()}`;
        });
    })
    .join(" ");
}

function normaliseCase(value: string) {
  return isAllCaps(value) ? toDisplayCase(value) : value;
}

function normaliseUnit(value?: string) {
  const raw = clean(value).replace(/^unit[:\s]*/i, "");
  if (!raw) return undefined;
  const match = raw.match(UNIT_CODE_PATTERN);
  if (match) return `#${match[1].replace(/\s+/g, "").toUpperCase()}`;
  return raw;
}

function extractUnit(text: string) {
  const labelled = text.match(/unit[:\s]*#?\s*([A-Z]?\d{1,3}[A-Z]?\s*-\s*\d{1,5}[A-Z]?)/i);
  if (labelled) return normaliseUnit(labelled[1]);
  const hashed = text.match(/#\s*([A-Z]?\d{1,3}[A-Z]?\s*-\s*\d{1,5}[A-Z]?)\b/i);
  return hashed ? normaliseUnit(hashed[1]) : undefined;
}

function extractPostal(text: string) {
  const labelled = text.match(/(?:singapore|postal\s*code[:\s]*|\bS\(?)\s*(\d{6})\b/i);
  if (labelled) return labelled[1];
  return text.match(POSTAL_PATTERN)?.[1];
}

/** Strips unit, postal, "Singapore", and labelled fragments from an address segment. */
function stripLocationNoise(segment: string) {
  return clean(
    segment
      .replace(/unit[:\s]*#?\s*[A-Z]?\d{1,3}[A-Z]?\s*-\s*\d{1,5}[A-Z]?/gi, " ")
      .replace(/postal\s*code[:\s]*\d{6}/gi, " ")
      .replace(/#\s*[A-Z]?\d{1,3}[A-Z]?\s*-\s*\d{1,5}[A-Z]?\b/gi, " ")
      .replace(/\bsingapore\s*\(?\d{6}\)?/gi, " ")
      .replace(/\bS\(\d{6}\)/gi, " ")
      .replace(/\b\d{6}\b/g, " ")
      .replace(/\bsingapore\b/gi, " ")
      .replace(/^[\s,;:|-]+|[\s,;:|-]+$/g, ""),
  );
}

function sameText(a?: string, b?: string) {
  const left = clean(a).toLowerCase();
  const right = clean(b).toLowerCase();
  return left.length > 0 && left === right;
}

/**
 * Returns the building name only when it is a real name, not an address fragment
 * such as "Singapore 310190 | Unit: 02-514 | Postal Code: 310190" or the stall's own name.
 */
export function cleanBuildingName(buildingName?: string, venueName?: string) {
  const value = clean(buildingName);
  if (!value) return undefined;
  if (sameText(value, venueName)) return undefined;
  if (/\|/.test(value)) return undefined;
  if (/\b(unit|postal\s*code)\b/i.test(value)) return undefined;
  if (/\bsingapore\s*\d{6}\b/i.test(value) || POSTAL_PATTERN.test(value)) return undefined;
  if (/#\s*\d/.test(value)) return undefined;
  // A leading block number ("190 Lorong 6 ...") means this is a street address, not a name.
  if (/^\d+[A-Z]?\s/i.test(value)) return undefined;
  return normaliseCase(value);
}

const ROAD_WORDS =
  "lorong|street|st|avenue|ave|road|rd|drive|dr|crescent|cres|close|lane|ln|link|way|walk|place|pl|terrace|ring|central";

/**
 * Short area label derived from a street, e.g. "190 Lorong 6 Toa Payoh" -> "Toa Payoh",
 * "123 Ang Mo Kio Avenue 3" -> "Ang Mo Kio".
 */
export function deriveAreaFromStreet(street?: string) {
  let value = clean(street);
  if (!value) return undefined;
  value = value.replace(/^(blk|block)\s+/i, "").replace(/^\d+[A-Z]?\s+/i, "");
  value = value.replace(new RegExp(`\\b(${ROAD_WORDS})\\b(\\s+\\d+[A-Z]?)?`, "gi"), " ");
  value = clean(value.replace(/\b\d+[A-Z]?\b/g, " "));
  return value ? normaliseCase(value) : undefined;
}

export function formatVenueAddress(input: VenueAddressInput): FormattedVenueAddress {
  const building = cleanBuildingName(input.buildingName, input.venueName);
  const rawAddress = clean(input.address);
  const rawBuilding = clean(input.buildingName);
  const combined = [rawAddress, rawBuilding].filter(Boolean).join(" | ");

  const unit = normaliseUnit(input.unitNumber) ?? extractUnit(combined);
  const postalFromField = clean(input.postalCode).match(POSTAL_PATTERN)?.[1];
  const postalCode = postalFromField ?? extractPostal(combined);

  const seen = new Set<string>();
  const streetParts: string[] = [];
  // Only the part before the first "|" carries street text; later pipes repeat unit/postal.
  const streetSource = rawAddress.split("|")[0] ?? "";
  for (const segment of streetSource.split(/[,\n;]/)) {
    const stripped = stripLocationNoise(segment);
    if (!stripped) continue;
    if (sameText(stripped, input.venueName) || sameText(stripped, building)) continue;
    const key = stripped.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    streetParts.push(normaliseCase(stripped));
  }
  const street = streetParts.join(", ") || undefined;

  const lines = [
    building,
    street,
    unit ? `Unit ${unit}` : undefined,
    postalCode ? `Singapore ${postalCode}` : undefined,
  ].filter((line): line is string => Boolean(line));

  return { building, street, unit, postalCode, lines };
}

/**
 * Header label for a stall: building / operator name, falling back to a short area.
 * Never returns a raw address string.
 */
export function formatVenueLocationLabel(input: VenueAddressInput) {
  const building = cleanBuildingName(input.buildingName, input.venueName);
  if (building) return building;
  const area = clean(input.planningArea);
  if (area) return normaliseCase(area);
  return deriveAreaFromStreet(formatVenueAddress(input).street);
}

/** Single-line clean address, suitable for map searches and accessibility labels. */
export function formatVenueAddressLine(input: VenueAddressInput) {
  const { building, street, unit, postalCode } = formatVenueAddress(input);
  return [
    clean(input.venueName) ? normaliseCase(clean(input.venueName)) : undefined,
    building,
    street,
    unit,
    postalCode ? `Singapore ${postalCode}` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}
