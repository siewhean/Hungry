// Shared by gemini.ts and anthropic.ts.
// Busy models answer 429, 503 or 529 for a moment; a short wait and retry usually gets through.
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [1000, 2500, 5000];

/** Returns the last response, whether or not it was ok. */
export async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let response = await fetch(url, init);
  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (response.ok || !RETRY_STATUSES.has(response.status)) break;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
    response = await fetch(url, init);
  }
  return response;
}

/** The status and the first 200 characters of the body, so Sentry and the eval show why a call failed. */
export async function failureMessage(label: string, response: Response): Promise<string> {
  const detail = (await response.text().catch(() => "")).slice(0, 200);
  return `${label} request failed with status ${response.status}: ${detail}`;
}
