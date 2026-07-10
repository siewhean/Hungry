const NAME_STOP_WORDS = new Set([
  "and", "cafe", "coffee", "food", "foods", "kitchen", "ltd", "pte", "restaurant", "singapore", "stall", "the",
]);

export function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function nameTokens(value) {
  return normalizeName(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !NAME_STOP_WORDS.has(token));
}

export function extractPostalCode(value) {
  const match = String(value || "").match(/(?:^|\D)(\d{6})(?:\D|$)/);
  return match?.[1] || null;
}

export function nameSimilarity(left, right) {
  const leftNorm = normalizeName(left);
  const rightNorm = normalizeName(right);
  if (!leftNorm || !rightNorm) return 0;
  if (leftNorm === rightNorm) return 1;
  const a = new Set(nameTokens(leftNorm));
  const b = new Set(nameTokens(rightNorm));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  const jaccard = intersection / union;
  const containment = intersection / Math.min(a.size, b.size);
  return Number((jaccard * 0.55 + containment * 0.45).toFixed(4));
}

export function normalizeGrabUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    if (!/^food\.grab\.com$/i.test(parsed.hostname)) return null;
    if (!/^\/sg\/(?:en|zh(?:-cn|-tw)?)\/restaurant\//i.test(parsed.pathname)) return null;
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|ref|source|campaign)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export function extractGrabDirectoryCandidates(payload) {
  const candidates = new Map();
  const seen = new Set();
  const queue = [payload];
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }

    const url = firstGrabUrl(node);
    const name = firstText(node, ["merchantName", "restaurantName", "displayName", "name", "title"]);
    if (url && name) {
      const address = firstText(node, ["fullAddress", "address", "merchantAddress", "location", "subtitle"]);
      const postalCode =
        extractPostalCode(firstText(node, ["postalCode", "postal_code", "postcode"])) || extractPostalCode(address);
      const key = `${normalizeName(name)}|${postalCode || ""}|${url}`;
      candidates.set(key, { name, address: address || null, postalCode, url, source: "grab_directory_payload" });
    }
    queue.push(...Object.values(node).filter((value) => value && typeof value === "object"));
  }
  return [...candidates.values()];
}

export function matchGrabCandidates(venues, candidates, options = {}) {
  const minNameScore = Number(options.minNameScore ?? 0.72);
  const minConfidence = Number(options.minConfidence ?? 0.82);
  const minMargin = Number(options.minMargin ?? 0.08);
  const proposals = [];
  const usedCandidates = new Set();

  for (const venue of venues) {
    if (venue.menu_source_url) continue;
    const venuePostal = extractPostalCode(venue.postal_code) || extractPostalCode(venue.address);
    const scored = candidates
      .map((candidate, index) => {
        const candidatePostal = candidate.postalCode || extractPostalCode(candidate.address);
        const nameScore = nameSimilarity(venue.name, candidate.name);
        const postalMatch = Boolean(venuePostal && candidatePostal && venuePostal === candidatePostal);
        const confidence = Number((nameScore * 0.65 + (postalMatch ? 0.35 : 0)).toFixed(4));
        return { candidate, candidateIndex: index, candidatePostal, confidence, nameScore, postalMatch };
      })
      .sort((a, b) => b.confidence - a.confidence);
    const best = scored[0];
    const runnerUp = scored[1];
    if (!best) continue;
    const margin = Number((best.confidence - (runnerUp?.confidence || 0)).toFixed(4));
    const safe =
      best.postalMatch &&
      best.nameScore >= minNameScore &&
      best.confidence >= minConfidence &&
      margin >= minMargin &&
      !usedCandidates.has(best.candidateIndex);
    if (safe) usedCandidates.add(best.candidateIndex);
    proposals.push({
      venueId: venue.id,
      venueName: venue.name,
      venuePostalCode: venuePostal,
      candidateName: best.candidate.name,
      candidatePostalCode: best.candidatePostal,
      menuSourceUrl: best.candidate.url,
      nameScore: best.nameScore,
      confidence: best.confidence,
      margin,
      status: safe ? "approved" : "manual_review",
      reason: safe
        ? "exact_postal_high_confidence_unique_match"
        : !best.postalMatch
          ? "postal_mismatch_or_missing"
          : best.nameScore < minNameScore
            ? "name_score_below_threshold"
            : margin < minMargin
              ? "ambiguous_candidate_margin"
              : usedCandidates.has(best.candidateIndex)
                ? "candidate_already_assigned"
                : "confidence_below_threshold",
    });
  }
  return proposals;
}

function firstText(node, keys) {
  for (const key of keys) {
    const value = node?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object") {
      const nested = firstText(value, ["formatted", "full", "label", "name", "text", "value"]);
      if (nested) return nested;
    }
  }
  return null;
}

function firstGrabUrl(node) {
  for (const key of ["merchantUrl", "restaurantUrl", "webUrl", "deeplink", "url", "href", "link"]) {
    const value = node?.[key];
    if (typeof value !== "string") continue;
    const normalized = normalizeGrabUrl(value);
    if (normalized) return normalized;
  }
  return null;
}
