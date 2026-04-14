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

import type {
  TasteProfile,
  TasteVector,
  TextureArchetype,
} from "@/types/domain";
import { NEUTRAL_TASTE_PROFILE } from "@/constants/taste";

// ─── Quiz Types ───────────────────────────────────────────────────────────────

export interface ScenarioOption {
  id: string;
  label: string;
  description: string;
  imageUrl: string;
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
        imageUrl:
          "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600",
        tasteImpact: { salty: 3, rich: 3, aromatic: 1 },
        profileImpact: { fatAffinity: 8, spiceSeeking: 2 },
      },
      {
        id: "comfort-sweet",
        label: "Warm brownie & ice cream",
        description: "Decadent double-fudge with a generous scoop",
        imageUrl:
          "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600",
        tasteImpact: { sweet: 4, rich: 2 },
        profileImpact: { fatAffinity: 7, spiceSeeking: 1 },
      },
      {
        id: "comfort-spicy",
        label: "Fiery mala skewers",
        description: "Tongue-numbing Sichuan peppercorn heat",
        imageUrl:
          "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600",
        tasteImpact: { spicy: 4, salty: 2, aromatic: 1 },
        profileImpact: { spiceSeeking: 9, fatAffinity: 5 },
      },
      {
        id: "comfort-clean",
        label: "Crisp Caesar salad",
        description: "Cool, clean, crunchy — the palate reset",
        imageUrl:
          "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600",
        tasteImpact: { sour: 2, salty: 1 },
        profileImpact: { fatAffinity: 2, spiceSeeking: 1 },
      },
    ],
  },

  // ── Scenario 2: The Coffee Test ──────────────────────────────────────
  {
    id: "bitter",
    prompt: "You walk into an artisanal café.",
    scene:
      "They hand you their signature dark, intense black coffee. How do you prepare it?",
    options: [
      {
        id: "bitter-black",
        label: "Pitch black",
        description: "\"I drink it as it is.\"",
        imageUrl:
          "https://images.unsplash.com/photo-1514432324607-a09d9b4aefda?w=600",
        tasteImpact: { aromatic: 2 },
        profileImpact: { bitterTolerance: 9 },
      },
      {
        id: "bitter-splash",
        label: "Splash of milk",
        description: "Just enough to take the edge off",
        imageUrl:
          "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600",
        tasteImpact: { rich: 1 },
        profileImpact: { bitterTolerance: 6 },
      },
      {
        id: "bitter-loaded",
        label: "Cream & caramel",
        description: "Heavy cream and two pumps of syrup",
        imageUrl:
          "https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=600",
        tasteImpact: { sweet: 3, rich: 2 },
        profileImpact: { bitterTolerance: 2 },
      },
      {
        id: "bitter-skip",
        label: "Herbal tea instead",
        description: "Skip the coffee entirely — a bright fruity tea",
        imageUrl:
          "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600",
        tasteImpact: { sweet: 1, sour: 1, aromatic: 1 },
        profileImpact: { bitterTolerance: 1 },
      },
    ],
  },

  // ── Scenario 3: The Texture Craving ──────────────────────────────────
  {
    id: "texture",
    prompt: "Forget flavour for a moment.",
    scene:
      "Which physical texture makes a dish completely irresistible to you?",
    options: [
      {
        id: "texture-bouncy",
        label: "QQ bouncy",
        description: "Fresh tapioca pearls or thick hand-pulled noodles",
        imageUrl:
          "https://images.unsplash.com/photo-1558857563-b371033873b8?w=600",
        tasteImpact: {},
        profileImpact: { textureArchetype: "chewer" as TextureArchetype },
      },
      {
        id: "texture-crunchy",
        label: "Shatteringly crunchy",
        description: "Double-fried chicken skin, golden and loud",
        imageUrl:
          "https://images.unsplash.com/photo-1562967914-608f82629710?w=600",
        tasteImpact: { rich: 1 },
        profileImpact: { textureArchetype: "cruncher" as TextureArchetype },
      },
      {
        id: "texture-silky",
        label: "Melt-in-your-mouth",
        description: "Slow-braised pork belly, silky and rich",
        imageUrl:
          "https://images.unsplash.com/photo-1544025162-d76694265947?w=600",
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
        imageUrl:
          "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600",
        tasteImpact: { sour: 1 },
        profileImpact: { textureArchetype: "mixed" as TextureArchetype },
      },
    ],
  },

  // ── Scenario 4: The Night Market ─────────────────────────────────────
  {
    id: "adventure",
    prompt: "You're exploring a foreign night market.",
    scene:
      "Bustling stalls, unfamiliar aromas, smoke everywhere. What's your strategy?",
    options: [
      {
        id: "adventure-extreme",
        label: "Find the longest queue",
        description: "The most exotic, unrecognisable dish — let's go",
        imageUrl:
          "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600",
        tasteImpact: { aromatic: 1, spicy: 1 },
        profileImpact: { neophiliaIndex: 10 },
      },
      {
        id: "adventure-familiar",
        label: "Local twist on comfort",
        description: "Something familiar given a local spin — fried chicken?",
        imageUrl:
          "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=600",
        tasteImpact: { salty: 1, rich: 1 },
        profileImpact: { neophiliaIndex: 4 },
      },
      {
        id: "adventure-safe",
        label: "Fresh grilled seafood",
        description: "Simple, clean, freshest possible — minimal risk",
        imageUrl:
          "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=600",
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
export function computeTasteProfileFromQuiz(
  answers: ScenarioQuizAnswer[]
): TasteProfile {
  const result: TasteProfile = {
    ...NEUTRAL_TASTE_PROFILE,
    vector: { ...NEUTRAL_TASTE_PROFILE.vector },
  };

  for (const answer of answers) {
    const scenario = QUIZ_SCENARIOS.find((s) => s.id === answer.scenarioId);
    if (!scenario) continue;

    const option = scenario.options.find(
      (o) => o.id === answer.selectedOptionId
    );
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
          : Math.round(
              (result.fatAffinity + option.profileImpact.fatAffinity) / 2
            );
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
export function getNextScenario(
  answers: ScenarioQuizAnswer[]
): QuizScenario | null {
  const answeredIds = new Set(answers.map((a) => a.scenarioId));
  return QUIZ_SCENARIOS.find((s) => !answeredIds.has(s.id)) ?? null;
}
