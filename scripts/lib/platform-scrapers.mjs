const COMMON_IMAGE_REJECTION = /plus-white|quick-add|logo-app-grab|placeholder|default|transparent|1x1/i;

export const PLATFORM_ADAPTERS = Object.freeze({
  grabfood: {
    source: "grabfood",
    label: "Grab",
    routeIsValid: (url) => /food\.grab\.com\/sg\/en\/restaurant\//i.test(url),
    itemStrategy: "heading",
    containerSelectors: "li, div[class*='menuItem'], div[class*='item']",
    titleSelectors: "h3, h4, h6, .name, p[class*='itemName'], div[class*='itemNameTitle']",
  },
  oddle: {
    source: "oddle",
    label: "Oddle",
    routeIsValid: (url) => /(?:eats\.)?oddle\.me\//i.test(url) && !/\/explore(?:[/?#]|$)/i.test(url) && !/^https:\/\/(?:eats\.)?oddle\.me\/?(?:sg)?\/?$/i.test(url),
    itemStrategy: "container",
    containerSelectors: ".menu-item, [data-testid='menu-item'], .MuiGrid-item, [role='button']",
    titleSelectors: "h3, h4, .title, [data-testid='item-name']",
  },
  foodpanda: {
    source: "foodpanda",
    label: "Foodpanda",
    routeIsValid: (url) => /foodpanda\.sg\/restaurant\//i.test(url),
    itemStrategy: "container",
    containerSelectors: "[data-testid*='menu-product'], [data-testid*='product-card'], [class*='product-card'], [class*='dish-card']",
    titleSelectors: "[data-testid*='product-name'], h3, h4, [class*='product-name'], [class*='dish-name']",
    allowInserts: false,
  },
  deliveroo: {
    source: "deliveroo",
    label: "Deliveroo",
    routeIsValid: (url) => /deliveroo\.com\.sg\/menu\//i.test(url),
    itemStrategy: "container",
    containerSelectors: "[data-testid*='menu-item'], [data-testid*='item-card'], [class*='menu-item'], [class*='MenuItem']",
    titleSelectors: "[data-testid*='item-name'], h3, h4, [class*='itemName'], [class*='item-name']",
    allowInserts: false,
  },
});

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function firstString(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && clean(value)) return clean(value);
  }
  return null;
}

function structuredPrice(record) {
  for (const key of ["priceInLocalCurrency", "displayPrice", "formattedPrice", "price", "unitPrice", "unit_price"]) {
    const value = record?.[key];
    if (typeof value === "string" && /\d/.test(value)) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  for (const key of ["priceInMinorUnit", "price_in_minor_unit", "priceCents", "price_cents"]) {
    const value = Number(record?.[key]);
    if (Number.isFinite(value)) return (value / 100).toFixed(2);
  }
  if (Array.isArray(record?.productVariations)) {
    const variation = record.productVariations.find((entry) => entry?.price !== undefined);
    if (variation && /\d/.test(String(variation.price))) return String(variation.price);
  }
  return null;
}

function structuredImage(record) {
  const direct = firstString(record, ["imageUrl", "image_url", "image", "photoHref", "photo", "thumbnail"]);
  if (direct) return direct;
  const images = record?.images;
  if (Array.isArray(images)) {
    const candidate = images.find((value) => typeof value === "string") ||
      images.map((value) => value?.url || value?.imageUrl || value?.imagePath || value?.file_path).find(Boolean);
    if (candidate) return clean(candidate);
  }
  return null;
}

export function extractVenueInfoFromStructuredData(value, { maxNodes = 10000 } = {}) {
  let best = { logo: null, addr: null, name: null };
  let visited = 0;
  function visit(node) {
    if (!node || typeof node !== "object" || visited >= maxNodes) return;
    visited += 1;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const address = firstString(node, ["address", "displayAddress", "fullAddress", "merchantAddress"]);
    const name = firstString(node, ["merchantName", "restaurantName", "vendorName", "name", "title"]);
    const logo = structuredImage(node) || firstString(node, ["logo", "logoUrl", "logo_url"]);
    const signalCount = Number(Boolean(address)) + Number(Boolean(name)) + Number(Boolean(logo));
    const bestCount = Number(Boolean(best.addr)) + Number(Boolean(best.name)) + Number(Boolean(best.logo));
    if (signalCount > bestCount) best = { logo, addr: address, name };
    Object.values(node).forEach(visit);
  }
  visit(value);
  return best;
}

export function extractMenuItemsFromStructuredData(value, { maxNodes = 15000 } = {}) {
  const items = new Map();
  let visited = 0;
  function visit(node) {
    if (!node || typeof node !== "object" || visited >= maxNodes) return;
    visited += 1;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const name = firstString(node, ["name", "title", "productName", "product_name", "itemName", "item_name"]);
    const price = structuredPrice(node);
    const src = structuredImage(node);
    const desc = firstString(node, ["description", "desc", "subtitle", "productDescription", "product_description"]);
    if (name && (price || src) && name.length <= 255) {
      const key = clean(name).toLowerCase();
      const current = items.get(key) || {};
      items.set(key, { name, price: price || current.price || null, src: src || current.src || null, desc: desc || current.desc || null });
    }
    Object.values(node).forEach(visit);
  }
  visit(value);
  return Array.from(items.values());
}

async function extractDomVenueInfo(page) {
  return page.evaluate(() => {
    const logo =
      document.querySelector("img[alt*='logo' i]")?.src ||
      document.querySelector("[class*='merchant' i] img")?.src ||
      document.querySelector("header img")?.src ||
      document.querySelector("meta[property='og:image']")?.content ||
      null;
    const addr =
      document.querySelector("address")?.textContent?.trim() ||
      Array.from(document.querySelectorAll("[class*='address' i], [class*='location' i]"))
        .map((element) => element.textContent?.trim())
        .find((text) => text && /\d{6}|singapore|#\d/i.test(text)) ||
      null;
    return { logo, addr };
  });
}

async function scrollAndExtract(page, adapter) {
  const config = {
    containerSelectors: adapter.containerSelectors,
    titleSelectors: adapter.titleSelectors,
    itemStrategy: adapter.itemStrategy,
  };
  return page.evaluate(async (platformConfig) => {
    const accumulated = new Map();
    const imageRejected = /plus-white|quick-add|logo-app-grab|placeholder|default|transparent|1x1/i;
    function imageFor(container) {
      const image = Array.from(container.querySelectorAll("img"))
        .find((element) => {
          const src = element.src || element.getAttribute("data-src") || "";
          return src.startsWith("http") && !imageRejected.test(src) && !src.includes(",");
        });
      if (image) return image.src || image.getAttribute("data-src");
      const backgroundNode = container.querySelector("[style*='background-image']");
      const background = backgroundNode ? getComputedStyle(backgroundNode).backgroundImage : "";
      const candidate = background.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
      return candidate.startsWith("http") && !imageRejected.test(candidate) ? candidate : null;
    }
    function add(container, titleNode) {
      const name = (titleNode?.textContent || "").trim();
      if (!name || name.length > 255) return;
      const lines = (container.textContent || "").split("\n").map((line) => line.trim()).filter(Boolean);
      const explicitPrice = container.querySelector(".price, [data-testid*='price'], [class*='price']")?.textContent || "";
      const priceText = explicitPrice || lines.find((line) => /(?:S\$|\$)?\s*\d+(?:\.\d{1,2})/.test(line)) || "";
      const price = priceText.match(/(?:S\$|\$)?\s*(\d+(?:\.\d{1,2})?)/)?.[1] || null;
      const existing = accumulated.get(name.toLowerCase()) || {};
      accumulated.set(name.toLowerCase(), {
        name,
        price: price || existing.price || null,
        src: imageFor(container) || existing.src || null,
        desc: lines.filter((line) => line !== name && line !== explicitPrice).join(" | ") || existing.desc || null,
      });
    }
    function collect() {
      if (platformConfig.itemStrategy === "heading") {
        document.querySelectorAll(platformConfig.titleSelectors).forEach((titleNode) => {
          let container = titleNode.closest("li") || titleNode.closest("div[class*='menuItem']") || titleNode.closest("div[class*='item']");
          if (container && /menuItemInfo|itemName/.test(String(container.className))) container = container.parentElement;
          if (container) add(container, titleNode);
        });
        return;
      }
      document.querySelectorAll(platformConfig.containerSelectors).forEach((container) => {
        const titleNode = container.querySelector(platformConfig.titleSelectors);
        if (titleNode) add(container, titleNode);
      });
    }
    let unchanged = 0;
    let lastHeight = 0;
    let travelled = 0;
    while (unchanged < 6 && travelled <= 50_000) {
      document.querySelectorAll("button").forEach((button) => {
        if (/show more|load more|view more/i.test(button.textContent || "")) button.click();
      });
      collect();
      const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      window.scrollBy(0, 500);
      travelled += 500;
      unchanged = height === lastHeight && window.scrollY + window.innerHeight >= height ? unchanged + 1 : 0;
      lastHeight = height;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    collect();
    return Array.from(accumulated.values());
  }, config);
}

export async function scrapeWithPlatformAdapter({
  page,
  platform,
  url,
  venue,
  missingDishes,
  runWithTimeout,
  validateVenue,
  buildVenueUpdates,
  applyVenueUpdate,
  matchDishes,
  normalize,
  debugCapture,
  onTransientFailure,
  logger = console,
}) {
  const adapter = PLATFORM_ADAPTERS[platform];
  if (!adapter) throw new Error(`Unsupported platform scraper: ${platform}`);
  try {
    logger.log(`  Scraping ${adapter.label}: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(2_500);
    if (!adapter.routeIsValid(page.url())) {
      logger.log(`    [!] ${adapter.label} redirected to a non-menu route (${page.url()}). Skipping.`);
      return 0;
    }
    if (debugCapture) await debugCapture(page, adapter);

    const nextDataText = await page.evaluate(() => document.getElementById("__NEXT_DATA__")?.textContent || null);
    const domVenueInfo = await extractDomVenueInfo(page);
    let parsedNextData = null;
    let structuredVenueInfo = { logo: null, addr: null };
    if (nextDataText) {
      try {
        parsedNextData = JSON.parse(nextDataText);
        structuredVenueInfo = extractVenueInfoFromStructuredData(parsedNextData);
      } catch {
        logger.log(`    [i] ${adapter.label} page state was not valid JSON; using DOM extraction only.`);
      }
    }
    const venueInfo = {
      logo: domVenueInfo.logo || structuredVenueInfo.logo,
      addr: domVenueInfo.addr || structuredVenueInfo.addr,
    };
    if (!(await validateVenue(page, venue, url, adapter.label, venueInfo))) return 0;

    const domItemsResult = await runWithTimeout(
      () => scrollAndExtract(page, adapter),
      `${adapter.label} menu extraction for ${url}`,
      100_000,
    );
    if (domItemsResult === null) {
      onTransientFailure?.(new Error(`${adapter.label} menu extraction timed out`));
      return 0;
    }
    const domItems = domItemsResult;
    let structuredItems = [];
    if (parsedNextData) structuredItems = extractMenuItemsFromStructuredData(parsedNextData);
    const data = new Map();
    for (const item of [...domItems, ...structuredItems]) {
      const key = normalize(item.name);
      if (!key) continue;
      const existing = data.get(key) || {};
      data.set(key, {
        name: item.name,
        price: item.price || existing.price || null,
        desc: item.desc || existing.desc || null,
        src: item.src && !COMMON_IMAGE_REJECTION.test(item.src) ? item.src : existing.src || null,
        source: adapter.source,
        sourceUrl: url,
        allowInsert: adapter.allowInserts !== false,
      });
    }

    if (venueInfo.logo || venueInfo.addr) {
      const updates = buildVenueUpdates(venueInfo, venue, url, adapter.source);
      if (Object.keys(updates).length > 0) await applyVenueUpdate(updates, venue.id);
    }
    return await matchDishes(data, missingDishes, venue);
  } catch (error) {
    onTransientFailure?.(error);
    logger.log(`    [!] ${adapter.label} scrape failed: ${error.message}`);
    return 0;
  }
}
