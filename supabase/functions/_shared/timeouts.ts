// How long an Edge Function waits on another company's API before giving up.
// Pass `signal: AbortSignal.timeout(TIMEOUT_MS.x)` in the fetch options. The signal covers the
// whole exchange, including reading the response body, so a provider that stops answering ends the
// call with an error the function already handles instead of holding it open until the platform
// kills it.

export const TIMEOUT_MS = {
  /** Sending an email through Resend. */
  email: 10_000,
  /** Posting a batch of push messages to Expo. */
  push: 15_000,
  /** Downloading a photo from our own storage. */
  photoDownload: 20_000,
  /** One Google Vision request. */
  vision: 30_000,
  /** One attempt at an AI provider (Gemini, Anthropic). */
  ai: 45_000,
} as const;
