// @ts-nocheck
/* eslint-disable import/no-unresolved */
// Picks the AI provider and model for mood-search, tag-dishes and scripts/taste-answer-key-eval.mjs.
// Set the Supabase secrets AI_PROVIDER ("gemini" or "anthropic") and AI_MODEL to switch without a deploy;
// each provider reads its own key (GEMINI_API_KEY or ANTHROPIC_API_KEY). ANTHROPIC_WORKSPACE_ID is only
// needed for an Anthropic key that is not tied to a Console workspace.
import { generateJson as generateWithAnthropic } from "./anthropic.ts";
import { generateJson as generateWithGemini } from "./gemini.ts";

type JsonObject = Record<string, unknown>;

const PROVIDERS = {
  gemini: { keyName: "GEMINI_API_KEY", defaultModel: "gemini-3.8-flash", generate: generateWithGemini },
  anthropic: {
    keyName: "ANTHROPIC_API_KEY",
    defaultModel: "claude-haiku-5-5",
    generate: generateWithAnthropic,
  },
};

export interface AiSettings {
  provider: keyof typeof PROVIDERS;
  model: string;
  apiKey: string;
  workspaceId: string;
  /** Set when the secrets are wrong; the caller answers with it as the error code. */
  problem: "invalid_ai_provider" | "missing_ai_api_key" | null;
}

export function resolveAi(getEnv: (name: string) => string | undefined): AiSettings {
  const requested = (getEnv("AI_PROVIDER") ?? "").trim().toLowerCase() || "gemini";
  if (!(requested in PROVIDERS)) {
    return { provider: "gemini", model: "", apiKey: "", workspaceId: "", problem: "invalid_ai_provider" };
  }
  const provider = requested as keyof typeof PROVIDERS;
  const config = PROVIDERS[provider];
  const apiKey = (getEnv(config.keyName) ?? "").trim();
  return {
    provider,
    model: (getEnv("AI_MODEL") ?? "").trim() || config.defaultModel,
    apiKey,
    workspaceId: provider === "anthropic" ? (getEnv("ANTHROPIC_WORKSPACE_ID") ?? "").trim() : "",
    problem: apiKey ? null : "missing_ai_api_key",
  };
}

/** Returns the parsed JSON answer, or null when the model stopped before finishing it. */
export function generateJson(
  ai: AiSettings,
  options: { system: string; user: string; schema: unknown; maxOutputTokens: number },
): Promise<JsonObject | null> {
  return PROVIDERS[ai.provider].generate({
    apiKey: ai.apiKey,
    workspaceId: ai.workspaceId,
    model: ai.model,
    ...options,
  });
}
