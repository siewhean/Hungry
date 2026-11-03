// FilterChipRail with `fit`: every chip on one row, no scrolling. Run with
// `node scripts/test-render.mjs src/components/ui/FilterChipRail.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { cleanup, render } from "@/test/render";

import { FilterChipRail } from "./FilterChipRail";

afterEach(cleanup);

const options = [
  { id: "dietary", label: "Dietary needs" },
  { id: "spicy", label: "Spicy" },
  { id: "halal", label: "Halal" },
  { id: "cheap", label: "Under S$5" },
];
const byLabel = (label: string) =>
  document.body.querySelector(`[aria-label="${label}"]`) as HTMLElement | null;

test("fit shows every chip at once and a chip press selects it", async () => {
  const picked: string[] = [];
  const view = await render(
    <FilterChipRail
      fit
      options={options}
      selectedIds={["spicy"]}
      onSelect={(id) => picked.push(id)}
    />,
  );
  for (const option of options) assert.ok(byLabel(option.label), `${option.label} is on screen`);

  await view.press(byLabel("Under S$5"));
  assert.deepEqual(picked, ["cheap"]);
});
