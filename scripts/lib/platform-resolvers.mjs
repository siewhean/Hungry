import { rankVenueCandidates } from "./venue-identity.mjs";

export const PLATFORM_RESOLVERS = Object.freeze({
  grabfood: {
    label: "Grab",
    searchUrl: (query) => `https://food.grab.com/sg/en/restaurants?search=${encodeURIComponent(query)}`,
    matchesUrl: (url) => /food\.grab\.com\/sg\/en\/restaurant\//i.test(url),
  },
  oddle: {
    label: "Oddle",
    searchUrl: (query) => `https://eats.oddle.me/sg/explore?search=${encodeURIComponent(query)}`,
    matchesUrl: (url) => /(?:eats\.)?oddle\.me\/.+/i.test(url) && !/\/explore(?:[/?#]|$)/i.test(url),
  },
  foodpanda: {
    label: "Foodpanda",
    searchUrl: (query) => `https://www.foodpanda.sg/restaurants/new?query=${encodeURIComponent(query)}`,
    matchesUrl: (url) => /foodpanda\.sg\/restaurant\//i.test(url),
  },
  deliveroo: {
    label: "Deliveroo",
    searchUrl: (query) => `https://deliveroo.com.sg/search?fulfillment_method=DELIVERY&query=${encodeURIComponent(query)}`,
    matchesUrl: (url) => /deliveroo\.com\.sg\/menu\//i.test(url),
  },
});

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function absoluteUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}

export function collectStructuredVenueCandidates(value, { baseUrl, matchesUrl, maxNodes = 5000 } = {}) {
  const candidates = [];
  const seen = new Set();
  let visited = 0;

  function visit(node) {
    if (!node || typeof node !== "object" || visited >= maxNodes) return;
    visited += 1;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const rawUrl = node.url || node.href || node.link || node.webUrl || node.restaurantUrl || node.redirectUrl;
    const url = absoluteUrl(rawUrl, baseUrl);
    if (url && (!matchesUrl || matchesUrl(url)) && !seen.has(url)) {
      seen.add(url);
      candidates.push({
        url,
        name: clean(node.name || node.title || node.displayName || node.merchantName || node.restaurantName),
        address: clean(node.address || node.displayAddress || node.fullAddress || node.merchantAddress),
        origin: "structured",
      });
    }
    Object.values(node).forEach(visit);
  }

  visit(value);
  return candidates;
}

export async function resolveDirectPlatformUrl(page, {
  platform,
  venue,
  waitMs = 1500,
  logger = console,
} = {}) {
  const resolver = PLATFORM_RESOLVERS[platform];
  if (!resolver) throw new Error(`Unsupported direct platform resolver: ${platform}`);

  const query = [venue?.name, venue?.postal_code].filter(Boolean).join(" ");
  await page.goto(resolver.searchUrl(query), { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(waitMs);
  const snapshot = await page.evaluate(() => ({
    baseUrl: location.href,
    links: Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => ({
        url: anchor.href,
        name: (anchor.textContent || anchor.getAttribute("aria-label") || "").trim(),
        address: (anchor.closest("article, li, [data-testid], [class*='card']")?.textContent || "").trim(),
        origin: "dom",
      })),
    nextData: document.getElementById("__NEXT_DATA__")?.textContent || null,
  }));

  const candidates = snapshot.links.filter((candidate) => resolver.matchesUrl(candidate.url));
  if (snapshot.nextData) {
    try {
      candidates.push(...collectStructuredVenueCandidates(JSON.parse(snapshot.nextData), {
        baseUrl: snapshot.baseUrl,
        matchesUrl: resolver.matchesUrl,
      }));
    } catch {
      // The direct resolver remains usable from DOM links when page state changes shape.
    }
  }

  const unique = Array.from(new Map(candidates.map((candidate) => [candidate.url, candidate])).values());
  const ranked = rankVenueCandidates(venue, unique);
  const best = ranked[0] || null;
  if (!best) return { url: null, band: "reject", score: 0, candidates: [] };
  if (best.band !== "accept") {
    logger.log(
      `    [i] ${resolver.label} direct resolver candidate requires ${best.band} (${best.score.toFixed(2)}): ${best.candidate.url}`,
    );
    return { url: null, ...best, candidates: ranked };
  }
  logger.log(`    [+] ${resolver.label} direct resolver accepted ${best.candidate.url} (${best.score.toFixed(2)})`);
  return { url: best.candidate.url, ...best, candidates: ranked };
}
