// Shared by the tag-dishes and mood-search Edge Functions and scripts/taste-answer-key-eval.mjs.
import { failureMessage, fetchWithRetry } from "./aiRetry.ts";

type JsonObject = Record<string, unknown>;

// Gemini wants upper-case type names and rejects additionalProperties, so convert a plain JSON schema.
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema === null || typeof schema !== "object") return schema;
  const converted: JsonObject = {};
  for (const [key, value] of Object.entries(schema as JsonObject)) {
    if (key === "additionalProperties") continue;
    converted[key] =
      key === "type" && typeof value === "string" ? value.toUpperCase() : toGeminiSchema(value);
  }
  return converted;
}

/** Returns the parsed JSON answer, or null when the model stopped before finishing it. */
export async function generateJson(options: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  schema: unknown;
  maxOutputTokens: number;
}): Promise<JsonObject | null> {
  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": options.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.system }] },
        contents: [{ role: "user", parts: [{ text: options.user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(options.schema),
          maxOutputTokens: options.maxOutputTokens,
          temperature: 0,
        },
      }),
    },
  );
  if (!response.ok) throw new Error(await failureMessage("Gemini", response));
  const body = (await response.json()) as JsonObject;
  const candidate = (body.candidates as JsonObject[] | undefined)?.[0];
  if (!candidate || candidate.finishReason !== "STOP") return null;
  const parts = ((candidate.content as JsonObject | undefined)?.parts ?? []) as JsonObject[];
  return JSON.parse(parts.map((part) => String(part.text ?? "")).join("")) as JsonObject;
}
