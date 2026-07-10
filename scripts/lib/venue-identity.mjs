const GENERIC_NAME_TOKENS = new Set([
  "and", "bakery", "beverage", "beverages", "cafe", "cuisine", "dessert",
  "drink", "drinks", "food", "foods", "halal", "indian", "japanese",
  "korean", "ltd", "malay", "muslim", "pte", "restaurant", "seafood",
  "shop", "singapore", "snacks", "stall", "the", "thai", "vegetarian",
  "western",
]);

const GENERIC_ADDRESS_TOKENS = new Set([
  "avenue", "building", "central", "centre", "center", "drive", "food",
  "lane", "mall", "plaza", "road", "shop", "shopping", "singapore",
  "street", "tower", "unit",
]);

export const DEFAULT_IDENTITY_THRESHOLDS = Object.freeze({
  accept: 0.72,
  review: 0.52,
});

export const DEFAULT_IDENTITY_WEIGHTS = Object.freeze({
  name: 0.5,
  postal: 0.25,
  address: 0.15,
  urlLocation: 0.1,
});

function clean(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value, ignored = new Set()) {
  return clean(value)
    .split(" ")
    .filter((token) => token.length >= 2)
    .filter((token) => !ignored.has(token));
}

function unique(values) {
  return Array.from(new Set(values));
}

function recallScore(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  if (expectedSet.size === 0 || actualSet.size === 0) return null;
  const shared = Array.from(expectedSet).filter((token) => actualSet.has(token));
  return shared.length / expectedSet.size;
}

function symmetricTokenScore(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size === 0 || rightSet.size === 0) return null;
  const shared = Array.from(leftSet).filter((token) => rightSet.has(token)).length;
  return (2 * shared) / (leftSet.size + rightSet.size);
}

function postalCode(value) {
  return String(value || "").match(/\b(\d{6})\b/)?.[1] || null;
}

function outletTokens(name) {
  return unique(
    Array.from(String(name || "").matchAll(/\(([^)]+)\)/g))
      .flatMap((match) => tokens(match[1], GENERIC_NAME_TOKENS)),
  );
}

function urlTokens(value) {
  try {
    const url = new URL(value);
    return tokens(`${url.hostname} ${url.pathname}`, new Set([
      ...GENERIC_NAME_TOKENS,
      ...GENERIC_ADDRESS_TOKENS,
      "com", "delivery", "deliveroo", "eats", "en", "foodpanda", "grab",
      "menu", "oddle", "restaurant", "restaurants", "sg", "www",
    ]));
  } catch {
    return [];
  }
}

function bandForScore(score, thresholds) {
  if (score >= thresholds.accept) return "accept";
  if (score >= thresholds.review) return "review";
  return "reject";
}

export function scoreVenueIdentity({
  venue,
  candidate,
  weights = DEFAULT_IDENTITY_WEIGHTS,
  thresholds = DEFAULT_IDENTITY_THRESHOLDS,
}) {
  const venueName = String(venue?.name || "");
  const candidateName = String(candidate?.name || candidate?.title || candidate?.pageIdentity || "");
  const venueNameTokens = tokens(venueName.replace(/\([^)]*\)/g, " "), GENERIC_NAME_TOKENS);
  const candidateNameTokens = tokens(candidateName, GENERIC_NAME_TOKENS);
  const name = recallScore(venueNameTokens, candidateNameTokens) ?? 0;

  const venuePostal = postalCode(`${venue?.postal_code || ""} ${venue?.address || ""}`);
  const candidatePostal = postalCode(`${candidate?.postalCode || ""} ${candidate?.address || ""}`);
  const postal = venuePostal && candidatePostal ? Number(venuePostal === candidatePostal) : null;

  const venueAddressTokens = tokens(venue?.address, GENERIC_ADDRESS_TOKENS);
  const candidateAddressTokens = tokens(candidate?.address, GENERIC_ADDRESS_TOKENS);
  const address = symmetricTokenScore(venueAddressTokens, candidateAddressTokens);

  const expectedLocationTokens = unique([
    ...outletTokens(venueName),
    ...venueAddressTokens,
    ...(venuePostal ? [venuePostal] : []),
  ]);
  const candidateUrlTokens = urlTokens(candidate?.url);
  const urlLocation = expectedLocationTokens.length > 0 && candidateUrlTokens.length > 0
    ? recallScore(expectedLocationTokens, candidateUrlTokens)
    : null;

  const signals = { name, postal, address, urlLocation };
  let weightedScore = 0;
  let totalWeight = 0;
  for (const [signal, weight] of Object.entries(weights)) {
    const value = signals[signal];
    weightedScore += (value === null || value === undefined ? 0.5 : value) * weight;
    totalWeight += weight;
  }
  let score = totalWeight > 0 ? weightedScore / totalWeight : 0;

  const requiredOutletTokens = outletTokens(venueName);
  const candidateIdentityTokens = new Set(tokens(
    `${candidateName} ${candidate?.address || ""} ${candidate?.url || ""}`,
  ));
  const outletMatched = requiredOutletTokens.length === 0 ||
    requiredOutletTokens.some((token) => candidateIdentityTokens.has(token));
  const postalMismatch = Boolean(venuePostal && candidatePostal && venuePostal !== candidatePostal);
  const nameMismatch = name < 0.34;

  const hardReasons = [];
  if (!outletMatched) hardReasons.push("outlet_qualifier_mismatch");
  if (postalMismatch) hardReasons.push("postal_mismatch");
  if (nameMismatch) hardReasons.push("name_mismatch");
  const hasPositiveLocationEvidence = postal === 1 || (address !== null && address >= 0.35) ||
    (urlLocation !== null && urlLocation >= 0.5) ||
    (requiredOutletTokens.length > 0 && outletMatched);
  if (!hasPositiveLocationEvidence) hardReasons.push("missing_outlet_evidence");
  if (hardReasons.length > 0) score = Math.min(score, thresholds.review - 0.01);

  score = Number(Math.max(0, Math.min(1, score)).toFixed(4));
  return {
    score,
    band: bandForScore(score, thresholds),
    signals,
    hardReasons,
    outletMatched,
    hasPositiveLocationEvidence,
    candidate: {
      name: candidateName || null,
      address: candidate?.address || null,
      url: candidate?.url || null,
    },
  };
}

export function rankVenueCandidates(venue, candidates, options = {}) {
  return (candidates || [])
    .map((candidate) => ({
      ...scoreVenueIdentity({ venue, candidate, ...options }),
      candidate,
    }))
    .sort((left, right) => right.score - left.score);
}
