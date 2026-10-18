import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { getHungryService, setMockServiceProvider } from "@/lib/services/serviceProvider";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("shared list RPC returns approved photos and a map query", () => {
  const migration = read("supabase/migrations/20261018050000_public_portfolio_photos_maps.sql");
  assert.match(
    migration,
    /'image_url', case when d\.media_approved_for_display then d\.image_url end/,
  );
  assert.match(migration, /'map_query', nullif\(concat_ws/);
  assert.match(migration, /where p\.id = p_portfolio_id and p\.visibility = 'public'/);
  assert.match(
    migration,
    /grant execute on function public\.get_public_portfolio\(uuid\) to anon, authenticated/,
  );
});

test("web share pages show the dish photo in previews, map links and pass the share tag", () => {
  const web = "marketing/website/web-v2/src";
  const preview = read(`${web}/components/share/SharePreview.tsx`);
  assert.match(preview, /images: \[imageUrl \?\? siteConfig\.openGraphImage\]/);
  assert.match(preview, /href=\{appDeepLink\(appPath, shareSource\)\}/);
  assert.match(preview, /Get directions/);
  assert.match(read(`${web}/lib/share/sharedLinks.ts`), /export function readShareSource/);
  for (const page of ["dish", "stall", "portfolio"]) {
    assert.match(
      read(`${web}/app/${page}/[id]/page.tsx`),
      /readShareSource\(\(await searchParams\)\.src\)/,
    );
  }
});

test("signed-out friends can open a public list and are asked to sign in only to save it", async () => {
  setMockServiceProvider();
  const service = getHungryService();
  assert.equal(await service.portfolio.getPublicPortfolio("missing-list"), null);

  const screen = read("src/app/screens/portfolio/PortfolioPublicViewScreen.tsx");
  assert.match(screen, /portfolio\.getPublicPortfolio\(portfolioId\)/);
  assert.match(
    screen,
    /if \(!isAuthenticated\) \{\s*setReturnRoute\(\{ name: "PortfolioPublicView"/,
  );
  assert.match(
    read("src/lib/services/supabase/supabaseService.ts"),
    /client\.rpc\("get_public_portfolio", \{ p_portfolio_id: id \}\)/,
  );
});
