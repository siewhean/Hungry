// stallSymbols: the stall page's SF Symbol adapters, and the rule that the stall page draws no
// emoji, no typed glyph and no raw Lucide icon. Run with `npm run test:render`.
import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach } from "node:test";

import * as symbols from "@/components/stall/stallSymbols";
import { cleanup, render } from "@/test/render";
import { readRepoFile } from "@/test/sourceContracts";

afterEach(cleanup);

test("R5-STALL-2: every stall symbol renders an icon of the size it is given", async () => {
  const names = Object.keys(symbols).filter((name) => /Symbol$/.test(name));
  assert.ok(names.length >= 15, "the stall page's symbols are exported");
  for (const name of names) {
    const Symbol = (
      symbols as unknown as Record<
        string,
        import("react").ComponentType<{ size?: number; color?: string }>
      >
    )[name];
    const view = await render(createElement(Symbol, { size: 20, color: "#123456" }));
    assert.ok(view.container.firstElementChild, `${name} renders`);
    await cleanup();
  }
});

const STALL_PAGE_FILES = [
  "src/app/screens/detail/StallDetailScreen.tsx",
  "src/app/screens/detail/StallVisitedScreen.tsx",
  "src/components/stall/FollowStallButton.tsx",
  "src/components/stall/MenuFilterDropdown.tsx",
  "src/components/stall/PopularVisitorsSection.tsx",
  "src/components/stall/StallHelpFillCard.tsx",
  "src/components/stall/StallInteractionBar.tsx",
  "src/components/stall/StallMenuDish.tsx",
  "src/components/stall/StallVisitedSheet.tsx",
  "src/components/detail/DetailCollapsingHeader.tsx",
  "src/components/detail/FloatingBackButton.tsx",
];

test("R5-STALL-2: no emoji, no typed star and no raw Lucide icon in the stall page files (source contract)", () => {
  const emoji = /\p{Extended_Pictographic}|[★☆✓✔✗▲▼→←]/u;
  for (const file of STALL_PAGE_FILES) {
    const source = readRepoFile(file);
    assert.doesNotMatch(source, emoji, `${file} has an emoji or a typed glyph`);
    assert.doesNotMatch(source, /from "lucide-react-native"/, `${file} imports Lucide directly`);
  }
});
