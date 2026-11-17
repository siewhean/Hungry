/** Explicit provenance publishers used by the catalog; unrelated hosts cannot open app links. */
const CATALOG_SOURCE_HOSTS = new Set([
  "hungry.sg",
  "www.hungry.sg",
  "www.capitaland.com",
  "www.vivocity.com.sg",
  "www.parkwayparade.com.sg",
  "www.313somerset.com.sg",
  "www.wismaonline.com",
  "www.linkreit.com",
  "www.jurongpoint.com.sg",
  "www.amkhub.com.sg",
  "www.nex.com.sg",
  "www.sunteccity.com.sg",
  "www.paragon.com.sg",
  "www.takashimayasc.com.sg",
  "www.foodpanda.sg",
  "foodpanda.sg",
  "food.grab.com",
  "sethlui.com",
  "eatbook.sg",
  "www.nea.gov.sg",
  "www.roots.gov.sg",
]);

export function isTrustedCatalogSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      CATALOG_SOURCE_HOSTS.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}
