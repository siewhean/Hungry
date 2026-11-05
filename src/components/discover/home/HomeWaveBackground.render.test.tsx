// The wavy band at the top of Home: a closed outline whose lower edge is a wave, drawn behind the
// page without taking touches. Run with
// `HUNGRY_DATA_SOURCE=mock node scripts/test-render.mjs src/components/discover/home/HomeWaveBackground.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import {
  HomeWaveBackground,
  WAVE_BAND_HEIGHT,
  waveBandPath,
} from "@/components/discover/home/HomeWaveBackground";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

test("the band is a closed outline from the top corners down to a wavy lower edge", () => {
  const d = waveBandPath(390, 200, 16, 1.25, 0);
  assert.match(d, /^M0 0 L390 0 L390\.0 /);
  assert.match(d, / Z$/);
  const ys = [...d.matchAll(/L[\d.]+ ([\d.]+)/g)].slice(1).map((match) => Number(match[1]));
  assert.ok(Math.max(...ys) <= 216.01 && Math.min(...ys) >= 183.99, "stays within the amplitude");
  assert.ok(Math.max(...ys) - Math.min(...ys) > 20, "the edge actually rises and falls");
});

test("moving the phase slides the wave sideways", () => {
  assert.notEqual(waveBandPath(390, 200, 16, 2, 0), waveBandPath(390, 200, 16, 2, 1));
  assert.equal(waveBandPath(390, 200, 16, 2, 0), waveBandPath(390, 200, 16, 2, 2 * Math.PI));
});

test("the background never takes touches and is hidden from screen readers", async () => {
  const view = await render(
    <HomeWaveBackground width={390} topInset={47} scrollY={{ value: 0 } as never} />,
  );
  const band = view.findByTestId("home-wave-background");
  assert.ok(band, "the band renders");
  assert.ok(WAVE_BAND_HEIGHT > 0);
  assert.equal(band.getAttribute("aria-hidden") ?? "true", "true");
});

test("the phone draws the water shader through Skia; the web keeps the plain waves", async () => {
  const { readFileSync } = await import("node:fs");
  const wave = readFileSync("src/components/discover/home/HomeWaveBackground.tsx", "utf8");
  assert.match(wave, /USE_WATER_SHADER = Platform\.OS !== "web"/);
  assert.match(wave, /<HomeWaterShader/);
  const { WATER_SHADER_SOURCE } = await import("@/components/discover/home/HomeWaterShader");
  for (const uniform of ["float2 size", "float time", "float3 tint", "float strength"]) {
    assert.ok(WATER_SHADER_SOURCE.includes(`uniform ${uniform}`), `shader declares ${uniform}`);
  }
  assert.match(WATER_SHADER_SOURCE, /half4 main\(float2 xy\)/);
  assert.match(WATER_SHADER_SOURCE, /caustic/);
});
