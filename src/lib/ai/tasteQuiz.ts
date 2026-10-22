/**
 * Scenario-Based Taste Quiz
 *
 * Implements the psychological profiling quiz from the Gastronomy Architecture
 * research. Four scenarios extract high-fidelity taste data with low cognitive
 * load by placing users in emotionally resonant food situations.
 *
 * Quiz Structure:
 *   Scenario 1: "The Comfort Order" → stress-eating archetype → fat/sweet/spice
 *   Scenario 2: "The Coffee Test"   → bitter tolerance → supertaster proxy
 *   Scenario 3: "The Texture Craving" → texture archetype → cruncher/chewer/smoother
 *   Scenario 4: "The Night Market"  → neophilia index → exploration vs exploitation
 *
 * Output: Complete TasteProfile (6-axis vector + secondary psychometric axes)
 */

import type { TasteProfile, TasteVector, TextureArchetype } from "@/types/domain";
import { NEUTRAL_TASTE_PROFILE } from "@/constants/taste";

// ─── Quiz Types ───────────────────────────────────────────────────────────────

export interface ScenarioOption {
  id: string;
  label: string;
  description: string;
  /**
   * Local generated onboarding asset filename from src/assets/onboarding/food.
   * Keep scenario imagery generated and professional; do not use external provider URLs.
   */
  generatedImageAsset: string;
  /** Adjustments to the core 6-axis taste vector */
  tasteImpact: Partial<TasteVector>;
  /** Adjustments to the secondary psychometric axes */
  profileImpact: Partial<Omit<TasteProfile, "vector">>;
}

export interface QuizScenario {
  id: string;
  /** The contextual prompt shown to the user */
  prompt: string;
  /** Subtitle/scene-setting text */
  scene: string;
  options: ScenarioOption[];
}

export interface ScenarioQuizAnswer {
  scenarioId: string;
  selectedOptionId: string;
}

// ─── Scenario Definitions ─────────────────────────────────────────────────────

export const QUIZ_SCENARIOS: QuizScenario[] = [
  // ── Scenario 1: The Comfort Order ────────────────────────────────────
  {
    id: "comfort",
    prompt: "It's been a long, exhausting week.",
    scene:
      "It's 10pm, raining outside, and you want nothing more than to stay on the couch. What's your ultimate comfort delivery?",
    options: [
      {
        id: "comfort-umami",
        label: "Rich ramen",
        description: "A steaming bowl of thick, cloudy tonkotsu broth",
        generatedImageAsset: "ramen.webp",
        tasteImpact: { salty: 3, rich: 3, aromatic: 1 },
        profileImpact: { fatAffinity: 8, spiceSeeking: 2 },
      },
      {
        id: "comfort-sweet",
        label: "Pandan cake",
        description: "Soft pandan sponge with a sweet, fragrant finish",
        generatedImageAsset: "pandan-cake.webp",
        tasteImpact: { sweet: 4, rich: 2 },
        profileImpact: { fatAffinity: 7, spiceSeeking: 1 },
      },
      {
        id: "comfort-spicy",
        label: "Fiery mala xiang guo",
        description: "Tongue-numbing Sichuan peppercorn heat",
        generatedImageAsset: "mala-xiang-guo.webp",
        tasteImpact: { spicy: 4, salty: 2, aromatic: 1 },
        profileImpact: { spiceSeeking: 9, fatAffinity: 5 },
      },
      {
        id: "comfort-clean",
        label: "Yong tau foo soup",
        description: "Light broth, tofu, vegetables, and a clean palate reset",
        generatedImageAsset: "yong-tau-foo.webp",
        tasteImpact: { sour: 2, salty: 1 },
        profileImpact: { fatAffinity: 2, spiceSeeking: 1 },
      },
    ],
  },

  // ── Scenario 2: The Coffee Test ──────────────────────────────────────
  {
    id: "bitter",
    prompt: "You walk into an artisanal café.",
    scene: "They hand you their signature dark, intense black coffee. How do you prepare it?",
    options: [
      {
        id: "bitter-black",
        label: "Pitch black",
        description: '"I drink it as it is."',
        generatedImageAsset: "kaya-toast.webp",
        tasteImpact: { aromatic: 2 },
        profileImpact: { bitterTolerance: 9 },
      },
      {
        id: "bitter-splash",
        label: "Splash of milk",
        description: "Just enough to take the edge off",
        generatedImageAsset: "kaya-toast.webp",
        tasteImpact: { rich: 1 },
        profileImpact: { bitterTolerance: 6 },
      },
      {
        id: "bitter-loaded",
        label: "Cream & caramel",
        description: "Heavy cream and two pumps of syrup",
        generatedImageAsset: "pandan-cake.webp",
        tasteImpact: { sweet: 3, rich: 2 },
        profileImpact: { bitterTolerance: 2 },
      },
      {
        id: "bitter-skip",
        label: "Herbal tea instead",
        description: "Skip the coffee entirely — a bright fruity tea",
        generatedImageAsset: "fish-soup.webp",
        tasteImpact: { sweet: 1, sour: 1, aromatic: 1 },
        profileImpact: { bitterTolerance: 1 },
      },
    ],
  },

  // ── Scenario 3: The Texture Craving ──────────────────────────────────
  {
    id: "texture",
    prompt: "Forget flavour for a moment.",
    scene: "Which physical texture makes a dish completely irresistible to you?",
    options: [
      {
        id: "texture-bouncy",
        label: "QQ bouncy",
        description: "Fresh tapioca pearls or thick hand-pulled noodles",
        generatedImageAsset: "yong-tau-foo.webp",
        tasteImpact: {},
        profileImpact: { textureArchetype: "chewer" as TextureArchetype },
      },
      {
        id: "texture-crunchy",
        label: "Shatteringly crunchy",
        description: "Double-fried chicken skin, golden and loud",
        generatedImageAsset: "roti-prata.webp",
        tasteImpact: { rich: 1 },
        profileImpact: { textureArchetype: "cruncher" as TextureArchetype },
      },
      {
        id: "texture-silky",
        label: "Melt-in-your-mouth",
        description: "Slow-braised pork belly, silky and rich",
        generatedImageAsset: "ramen.webp",
        tasteImpact: { rich: 2 },
        profileImpact: {
          textureArchetype: "smoother" as TextureArchetype,
          fatAffinity: 7,
        },
      },
      {
        id: "texture-pop",
        label: "Pop & snap",
        description: "Fresh roe, charred corn, bursting with juice",
        generatedImageAsset: "bibimbap.webp",
        tasteImpact: { sour: 1 },
        profileImpact: { textureArchetype: "mixed" as TextureArchetype },
      },
    ],
  },

  // ── Scenario 4: The Night Market ─────────────────────────────────────
  {
    id: "adventure",
    prompt: "You're exploring a foreign night market.",
    scene: "Bustling stalls, unfamiliar aromas, smoke everywhere. What's your strategy?",
    options: [
      {
        id: "adventure-extreme",
        label: "Find the longest queue",
        description: "The most exotic, unrecognisable dish — let's go",
        generatedImageAsset: "char-kway-teow.webp",
        tasteImpact: { aromatic: 1, spicy: 1 },
        profileImpact: { neophiliaIndex: 10 },
      },
      {
        id: "adventure-familiar",
        label: "Local twist on comfort",
        description: "Something familiar given a local spin — fried chicken?",
        generatedImageAsset: "chicken-rice.webp",
        tasteImpact: { salty: 1, rich: 1 },
        profileImpact: { neophiliaIndex: 4 },
      },
      {
        id: "adventure-safe",
        label: "Fresh grilled seafood",
        description: "Simple, clean, freshest possible — minimal risk",
        generatedImageAsset: "fish-soup.webp",
        tasteImpact: { salty: 1, aromatic: 1 },
        profileImpact: { neophiliaIndex: 2 },
      },
    ],
  },
];

// ─── Vector Computation ───────────────────────────────────────────────────────

/**
 * Compute a complete TasteProfile from the user's quiz answers.
 *
 * Starts from the neutral profile (all 5s) and applies each answer's
 * taste and profile impacts additively, clamped to [0, 10].
 */
export function computeTasteProfileFromQuiz(answers: ScenarioQuizAnswer[]): TasteProfile {
  const result: TasteProfile = {
    ...NEUTRAL_TASTE_PROFILE,
    vector: { ...NEUTRAL_TASTE_PROFILE.vector },
  };

  for (const answer of answers) {
    const scenario = QUIZ_SCENARIOS.find((s) => s.id === answer.scenarioId);
    if (!scenario) continue;

    const option = scenario.options.find((o) => o.id === answer.selectedOptionId);
    if (!option) continue;

    // Apply taste vector impacts (additive, clamped)
    for (const [key, delta] of Object.entries(option.tasteImpact)) {
      const k = key as keyof TasteVector;
      result.vector[k] = clamp(result.vector[k] + (delta ?? 0), 0, 10);
    }

    // Apply profile impacts (direct set for enums, additive for numbers)
    if (option.profileImpact.bitterTolerance !== undefined) {
      result.bitterTolerance = option.profileImpact.bitterTolerance;
    }
    if (option.profileImpact.fatAffinity !== undefined) {
      // Average with existing if already set by a previous scenario
      result.fatAffinity =
        result.fatAffinity === NEUTRAL_TASTE_PROFILE.fatAffinity
          ? option.profileImpact.fatAffinity
          : Math.round((result.fatAffinity + option.profileImpact.fatAffinity) / 2);
    }
    if (option.profileImpact.textureArchetype !== undefined) {
      result.textureArchetype = option.profileImpact.textureArchetype;
    }
    if (option.profileImpact.neophiliaIndex !== undefined) {
      result.neophiliaIndex = option.profileImpact.neophiliaIndex;
    }
    if (option.profileImpact.spiceSeeking !== undefined) {
      result.spiceSeeking = option.profileImpact.spiceSeeking;
    }
  }

  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Quiz Helpers ─────────────────────────────────────────────────────────────

/**
 * Check if a set of answers covers all quiz scenarios.
 */
export function isQuizComplete(answers: ScenarioQuizAnswer[]): boolean {
  const answeredIds = new Set(answers.map((a) => a.scenarioId));
  return QUIZ_SCENARIOS.every((s) => answeredIds.has(s.id));
}

/**
 * Get the scenario that the user should answer next, or null if complete.
 */
export function getNextScenario(answers: ScenarioQuizAnswer[]): QuizScenario | null {
  const answeredIds = new Set(answers.map((a) => a.scenarioId));
  return QUIZ_SCENARIOS.find((s) => !answeredIds.has(s.id)) ?? null;
}
