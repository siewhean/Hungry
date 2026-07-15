import { describe, expect, it } from "vitest";

import type { LayoutImage, StoreShape } from "../../types/layout";
import { exportLayoutJson, parseLayoutJson, toLayoutDocument } from "./exportJson";
import { exportLayoutSvg } from "./exportSvg";

const image: LayoutImage = {
  name: "level-1.png",
  src: "data:image/png;base64,abc&def",
  width: 1200,
  height: 800,
};

const shape: StoreShape = {
  id: "store-1",
  unitId: "B1-01 & <02>",
  tenantName: "Example",
  category: "Food",
  fillColor: "#16a34a",
  labelPosition: "centroid",
  points: [
    { x: 10, y: 20 },
    { x: 110, y: 20 },
    { x: 110, y: 80 },
    { x: 10, y: 80 },
  ],
};

describe("layout JSON", () => {
  it("exports the stable polygon schema without embedding raster data", () => {
    const document = toLayoutDocument(image, [shape]);

    expect(document).toEqual({
      image: { name: "level-1.png", width: 1200, height: 800 },
      stores: [
        {
          id: "store-1",
          unitId: "B1-01 & <02>",
          tenantName: "Example",
          category: "Food",
          fillColor: "#16a34a",
          labelPosition: "centroid",
          polygon: shape.points,
        },
      ],
    });
    expect(exportLayoutJson(image, [shape])).not.toContain("data:image");
  });

  it("round-trips exported geometry into a detached canonical document", () => {
    const exported = exportLayoutJson(image, [shape]);
    const imported = parseLayoutJson(exported);

    expect(imported).toEqual(toLayoutDocument(image, [shape]));
    expect(imported.stores[0].polygon).not.toBe(shape.points);
  });

  it.each([
    ["malformed JSON", "{"],
    ["missing stores", JSON.stringify({ image: { name: "x", width: 1, height: 1 } })],
    [
      "non-finite coordinates",
      JSON.stringify({
        image: { name: "x", width: 1, height: 1 },
        stores: [{ ...toLayoutDocument(image, [shape]).stores[0], polygon: [{ x: null, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }],
      }),
    ],
  ])("rejects %s", (_case, source) => {
    expect(() => parseLayoutJson(source)).toThrow();
  });
});

describe("layout SVG", () => {
  it("keeps vector polygons as the geometry source and escapes XML content", () => {
    const svg = exportLayoutSvg(image, [shape]);

    expect(svg).toContain('<polygon points="10,20 110,20 110,80 10,80"');
    expect(svg).toContain("B1-01 &amp; &lt;02&gt;");
    expect(svg).toContain("data:image/png;base64,abc&amp;def");
    expect(svg).not.toContain("B1-01 & <02>");
  });
});

describe("export validation", () => {
  it.each([
    [
      "self-intersecting polygons",
      {
        ...shape,
        points: [
          { x: 10, y: 10 },
          { x: 100, y: 100 },
          { x: 10, y: 100 },
          { x: 100, y: 10 },
        ],
      },
    ],
    ["missing unit IDs", { ...shape, unitId: "" }],
    [
      "out-of-bounds coordinates",
      { ...shape, points: [{ x: -1, y: 0 }, ...shape.points.slice(1)] },
    ],
  ])("fails closed for %s", (_case, invalidShape) => {
    expect(() => exportLayoutJson(image, [invalidShape])).toThrow();
    expect(() => exportLayoutSvg(image, [invalidShape])).toThrow();
  });
});
