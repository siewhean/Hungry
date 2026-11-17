import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("web-v2 keeps public shell server-rendered with a tiny client route gate", () => {
  const layout = read("marketing/website/web-v2/src/app/layout.tsx");
  const shell = read("marketing/website/web-v2/src/components/layout/AppLayoutWrapper.tsx");
  const routeEffects = read("marketing/website/web-v2/src/components/layout/RouteEffects.tsx");
  const navbar = read("marketing/website/web-v2/src/components/layout/Navbar.tsx");

  assert.match(layout, /import localFont from "next\/font\/local"/);
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.match(layout, /publicHeader=/);
  assert.match(layout, /<AnnouncementBar \/>/);
  assert.match(layout, /<Navbar \/>/);
  assert.match(layout, /publicFooter=\{<Footer \/>/);

  assert.match(shell, /"use client"/);
  assert.match(shell, /usePathname/);
  assert.doesNotMatch(shell, /from "next\/headers"/);
  assert.doesNotMatch(shell, /from "@\/components\/layout\/Navbar"/);
  assert.doesNotMatch(shell, /from "@\/components\/layout\/Footer"/);
  assert.match(shell, /publicHeader: ReactNode/);
  assert.match(shell, /publicFooter: ReactNode/);
  assert.match(shell, /pathname\.startsWith\("\/console"\)/);
  assert.match(shell, /pathname\.startsWith\("\/merchant"\)/);

  assert.match(routeEffects, /"use client"/);
  assert.match(routeEffects, /requestIdleCallback|setTimeout/);
  assert.doesNotMatch(navbar, /"use client"/);
  assert.match(navbar, /SamePageLink/);
});

test("web-v2 animation libraries are not top-level imports on first paint", () => {
  const hero = read("marketing/website/web-v2/src/components/sections/Hero.tsx");
  const stickyStory = read("marketing/website/web-v2/src/components/home/StickyScreenStory.tsx");
  const merchantStory = read("marketing/website/web-v2/src/components/sections/MerchantStory.tsx");
  const waitlist = read("marketing/website/web-v2/src/app/join-waitlist/JoinWaitlistForm.tsx");
  const reveal = read("marketing/website/web-v2/src/components/motion/Reveal.tsx");

  for (const source of [hero, stickyStory, merchantStory, waitlist, reveal]) {
    assert.doesNotMatch(source, /from "framer-motion"/);
    assert.doesNotMatch(source, /from "gsap"/);
    assert.doesNotMatch(source, /from "gsap\/ScrollTrigger"/);
    assert.doesNotMatch(source, /AnimatePresence/);
    assert.doesNotMatch(source, /motion\./);
  }

  assert.match(hero, /Promise\.all\(\[import\("gsap"\), import\("gsap\/ScrollTrigger"\)\]\)/);
  assert.match(
    stickyStory,
    /Promise\.all\(\[import\("gsap"\), import\("gsap\/ScrollTrigger"\)\]\)/,
  );
  assert.match(reveal, /new IntersectionObserver/);
});

test("web-v2 has an explicit post-build bundle budget gate", () => {
  const packageJson = read("marketing/website/web-v2/package.json");
  const budgetScript = read("marketing/website/web-v2/scripts/check-bundle-budget.mjs");

  assert.match(packageJson, /"bundle:budget": "node scripts\/check-bundle-budget\.mjs"/);
  assert.match(budgetScript, /MAX_LARGEST_CHUNK_BYTES/);
  assert.match(budgetScript, /MAX_TOTAL_CHUNK_BYTES/);
  assert.match(budgetScript, /\.next", "static", "chunks"/);
});
