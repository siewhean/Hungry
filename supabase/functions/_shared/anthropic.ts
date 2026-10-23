// @ts-nocheck
/* eslint-disable import/no-unresolved */
// Same contract as gemini.ts, for Claude models. Plain fetch, like gemini.ts, so the Edge Functions
// and scripts/taste-answer-key-eval.mjs (Node) can load the same file.
import { failureMessage, fetchWithRetry } from "./aiRetry.ts";

type JsonObject = Record<string, unknown>;

/** Returns the parsed JSON answer, or null when the model stopped before finishing it. */
export async function generateJson(options: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  schema: unknown;
  maxOutputTokens: number;
}): Promise<JsonObject | null> {
  const response = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
    },
    // No temperature: current Claude models reject non-default sampling values.
    body: JSON.stringify({
      model: options.model,
      max_tokens: options.maxOutputTokens,
      system: options.system,
      messages: [{ role: "user", content: options.user }],
      output_config: { effort: "low", format: { type: "json_schema", schema: options.schema } },
    }),
  });
  if (!response.ok) throw new Error(await failureMessage("Anthropic", response));
  const body = (await response.json()) as JsonObject;
  if (body.stop_reason !== "end_turn") return null;
  const blocks = (body.content ?? []) as JsonObject[];
  const text = blocks
    .filter((block) => block.type === "text")
    .map((block) => String(block.text ?? ""))
    .join("");
  return JSON.parse(text) as JsonObject;
}
