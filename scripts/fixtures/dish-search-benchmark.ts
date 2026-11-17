import type { SearchFilters, TasteVector } from "../../src/types/domain";

export const EXPECTED_CATALOGUE_SHA256 =
  "bddb9250142d3fba44ee04ed95375473a3115de36a60c3ddceaf7061e3a3c980";

type BenchmarkCategory =
  | "dish_name"
  | "spelling"
  | "multilingual"
  | "area"
  | "budget"
  | "dietary"
  | "availability"
  | "taste";

export interface BenchmarkCaseBase {
  id: string;
  category: BenchmarkCategory;
  mode: "contract" | "diagnostic";
  expectedIds: readonly string[];
  firstId?: string;
  note?: string;
}

export interface SearchBenchmarkCase extends BenchmarkCaseBase {
  filters: Partial<SearchFilters>;
  /** Limit the result set to these IDs, in any order. */
  exactSet?: boolean;
}

export interface RecommendationBenchmarkCase extends BenchmarkCaseBase {
  taste: TasteVector;
}

export const SEARCH_CASES: readonly SearchBenchmarkCase[] = [
  {
    id: "chicken-rice",
    category: "dish_name",
    mode: "contract",
    filters: { query: "chicken rice" },
    expectedIds: ["dish-chicken-rice"],
    exactSet: true,
  },
  {
    id: "case-and-whitespace",
    category: "dish_name",
    mode: "contract",
    filters: { query: "  LAKSA  " },
    expectedIds: ["dish-laksa"],
    exactSet: true,
  },
  {
    id: "fish-substring",
    category: "dish_name",
    mode: "contract",
    filters: { query: "fish" },
    expectedIds: ["dish-ban-mian", "dish-fish-soup"],
    exactSet: true,
  },
  {
    id: "ban-mian-romanized",
    category: "multilingual",
    mode: "contract",
    filters: { query: "ban mian" },
    expectedIds: ["dish-ban-mian"],
    exactSet: true,
  },
  {
    id: "mala-xiang-guo-romanized",
    category: "multilingual",
    mode: "contract",
    filters: { query: "mala xiang guo" },
    expectedIds: ["dish-mala-xiang-guo"],
    exactSet: true,
  },
  {
    id: "no-unrelated-dishes",
    category: "dish_name",
    mode: "contract",
    filters: { query: "zz-no-such-dish-zz" },
    expectedIds: [],
    exactSet: true,
  },
  {
    id: "satay-inclusive-budget",
    category: "budget",
    mode: "contract",
    filters: { query: "satay", maxPrice: 8 },
    expectedIds: ["dish-satay"],
    exactSet: true,
  },
  {
    id: "satay-over-budget",
    category: "budget",
    mode: "contract",
    filters: { query: "satay", maxPrice: 7.99 },
    expectedIds: [],
    exactSet: true,
  },
  {
    id: "fish-under-6-60",
    category: "budget",
    mode: "contract",
    filters: { query: "fish", maxPrice: 6.6 },
    expectedIds: ["dish-ban-mian"],
    exactSet: true,
  },
  {
    id: "close-radius-inclusive",
    category: "area",
    mode: "contract",
    filters: { query: "chicken rice", radius: 180 },
    expectedIds: ["dish-chicken-rice"],
    exactSet: true,
  },
  {
    id: "outside-radius",
    category: "area",
    mode: "contract",
    filters: { query: "chicken rice", radius: 179 },
    expectedIds: [],
    exactSet: true,
  },
  {
    id: "halal-satay",
    category: "dietary",
    mode: "contract",
    filters: { query: "satay", dietaryFlags: ["halal"] },
    expectedIds: ["dish-satay"],
    exactSet: true,
  },
  {
    id: "pork-free-is-not-halal",
    category: "dietary",
    mode: "contract",
    filters: { query: "chicken rice", dietaryFlags: ["halal"] },
    expectedIds: [],
    exactSet: true,
  },
  {
    id: "closed-laksa",
    category: "availability",
    mode: "contract",
    filters: { query: "laksa", openOnly: true },
    expectedIds: [],
    exactSet: true,
  },
  {
    id: "laksa-misspelling",
    category: "spelling",
    mode: "diagnostic",
    filters: { query: "laksha" },
    expectedIds: ["dish-laksa"],
    note: "Expected relevance if typo handling is introduced.",
  },
  {
    id: "satay-spelling-variant",
    category: "spelling",
    mode: "diagnostic",
    filters: { query: "sate" },
    expectedIds: ["dish-satay"],
    note: "Expected relevance if Indonesian spelling aliases are supported.",
  },
  {
    id: "chicken-rice-chinese",
    category: "multilingual",
    mode: "diagnostic",
    filters: { query: "海南鸡饭" },
    expectedIds: ["dish-chicken-rice"],
    note: "Chinese query against the English fixture name.",
  },
  {
    id: "mala-xiang-guo-chinese",
    category: "multilingual",
    mode: "diagnostic",
    filters: { query: "麻辣香锅" },
    expectedIds: ["dish-mala-xiang-guo"],
    note: "Chinese query against the romanized fixture name.",
  },
  {
    id: "exclude-other-planning-area",
    category: "area",
    mode: "diagnostic",
    filters: { query: "chicken rice", areaName: "Orchard" },
    expectedIds: [],
    exactSet: true,
    note: "The fixture dish is in Chinatown, outside the requested area.",
  },
];

export const RECOMMENDATION_CASES: readonly RecommendationBenchmarkCase[] = [
  {
    id: "spicy-lunch",
    category: "taste",
    mode: "contract",
    taste: { sweet: 1, spicy: 10, sour: 2, salty: 8, rich: 7, aromatic: 9 },
    expectedIds: ["dish-laksa", "dish-mala-xiang-guo"],
    firstId: "dish-laksa",
  },
  {
    id: "sweet-lunch",
    category: "taste",
    mode: "contract",
    taste: { sweet: 9, spicy: 0, sour: 0, salty: 4, rich: 8, aromatic: 9 },
    expectedIds: ["dish-kaya-toast", "dish-pandan-cake"],
    firstId: "dish-kaya-toast",
  },
];
