import { createHash } from "node:crypto";

import { NEUTRAL_TASTE_VECTOR } from "../src/constants/taste";
import { runRecommendationPipeline } from "../src/lib/ai/tasteEngine";
import { buildings, dishes, venues } from "../src/lib/services/mock/data";
import { mockRepository } from "../src/lib/services/mock/repositories";
import type { SearchFilters } from "../src/types/domain";
import {
  EXPECTED_CATALOGUE_SHA256,
  RECOMMENDATION_CASES,
  SEARCH_CASES,
  type BenchmarkCaseBase,
  type SearchBenchmarkCase,
} from "./fixtures/dish-search-benchmark";

const flags = process.argv.slice(2);
if (flags.some((flag) => flag !== "--json" && flag !== "--strict")) {
  console.error("Usage: node --import tsx scripts/dish-search-benchmark.ts [--json] [--strict]");
  process.exit(2);
}

const catalogue = {
  buildings: buildings.map(({ id, planningArea }) => ({ id, planningArea })),
  venues: venues.map(({ id, buildingId, isOpen }) => ({ id, buildingId, isOpen })),
  dishes: dishes.map(
    ({
      id,
      name,
      venueId,
      buildingId,
      price,
      distanceMeters,
      dietaryFlags,
      foodTypeTag,
      rating,
      tasteTags,
      tasteVector,
      tasteConfidence,
    }) => ({
      id,
      name,
      venueId,
      buildingId,
      price,
      distanceMeters,
      dietaryFlags,
      foodTypeTag,
      rating,
      tasteTags,
      tasteVector,
      tasteConfidence,
    }),
  ),
};
const catalogueHash = createHash("sha256").update(JSON.stringify(catalogue)).digest("hex");
if (catalogueHash !== EXPECTED_CATALOGUE_SHA256) {
  console.error(
    `Mock catalogue changed. Review the benchmark fixture labels before updating the pinned hash to ${catalogueHash}.`,
  );
  process.exit(1);
}
const knownIds = new Set(dishes.map((dish) => dish.id));
const defaultFilters: SearchFilters = {
  query: "",
  categories: [],
  dietaryFlags: [],
  tasteValues: NEUTRAL_TASTE_VECTOR,
  radius: 3_000,
};

function evaluate(
  fixture: BenchmarkCaseBase & Pick<SearchBenchmarkCase, "exactSet">,
  actualIds: string[],
) {
  const expectedIds = fixture.expectedIds;
  if (
    [...expectedIds, ...(fixture.firstId ? [fixture.firstId] : [])].some((id) => !knownIds.has(id))
  ) {
    throw new Error(
      `Unknown fixture dish ID in ${fixture.id}. Check the canonical mock catalogue.`,
    );
  }

  const missing = expectedIds.filter((id) => !actualIds.includes(id));
  const unexpected = fixture.exactSet ? actualIds.filter((id) => !expectedIds.includes(id)) : [];
  const unique = new Set(actualIds).size === actualIds.length;
  const firstMatches = fixture.firstId === undefined || fixture.firstId === actualIds[0];
  return {
    ...fixture,
    passed: unique && missing.length === 0 && unexpected.length === 0 && firstMatches,
    actualIds,
    missing,
    unexpected,
  };
}

const results = [
  ...SEARCH_CASES.map((fixture) => {
    const matches = mockRepository.searchDishes(
      { ...defaultFilters, ...fixture.filters },
      NEUTRAL_TASTE_VECTOR,
    );
    return {
      ...evaluate(
        fixture,
        matches.map((dish) => dish.id),
      ),
      path: "mock_search",
      filters: fixture.filters,
    };
  }),
  ...RECOMMENDATION_CASES.map((fixture) => {
    const ranking = runRecommendationPipeline(dishes, {
      userVector: fixture.taste,
      context: { timeSegment: "lunch" },
      neophiliaIndex: 5,
      dietaryFlags: [],
      radiusMeters: defaultFilters.radius,
    });
    return {
      ...evaluate(
        fixture,
        ranking.map((row) => row.dishId),
      ),
      path: "lunch_recommendation",
    };
  }),
];

function summarize(mode: "contract" | "diagnostic") {
  const cases = results.filter((result) => result.mode === mode);
  return { passed: cases.filter((result) => result.passed).length, total: cases.length };
}

const contracts = summarize("contract");
const diagnostics = summarize("diagnostic");

if (flags.includes("--json")) {
  console.log(
    JSON.stringify({ catalogueHash, catalogue, contracts, diagnostics, results }, null, 2),
  );
} else {
  console.log(
    `Hungry dish benchmark · ${dishes.length} canonical mock dishes · SHA-256 ${catalogueHash}`,
  );
  for (const { id, mode, passed, actualIds } of results) {
    console.log(
      `${passed ? "PASS" : mode === "diagnostic" ? "GAP " : "FAIL"} ${id}: ${actualIds.join(", ") || "(none)"}`,
    );
  }
  console.log(
    `Contracts ${contracts.passed}/${contracts.total} · Diagnostics ${diagnostics.passed}/${diagnostics.total}`,
  );
}

if (
  contracts.passed !== contracts.total ||
  (flags.includes("--strict") && diagnostics.passed !== diagnostics.total)
) {
  process.exitCode = 1;
}
