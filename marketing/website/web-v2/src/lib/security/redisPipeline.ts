type RedisPipelineEntry = {
  error?: unknown;
  result?: unknown;
};

function isPipelineEntry(value: unknown): value is RedisPipelineEntry {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseIntegerResult(value: unknown, command: string): number {
  const hasNumericValue =
    typeof value === "number" || (typeof value === "string" && value.trim().length > 0);
  const parsed = hasNumericValue ? Number(value) : Number.NaN;

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Rate limit store returned an invalid ${command} result.`);
  }

  return parsed;
}

export function parseRedisRateLimitPipeline(payload: unknown): number {
  if (!Array.isArray(payload) || payload.length !== 2 || !payload.every(isPipelineEntry)) {
    throw new Error("Rate limit store returned an invalid pipeline response.");
  }

  for (const entry of payload) {
    if (entry.error !== undefined && entry.error !== null) {
      throw new Error("Rate limit store returned a command error.");
    }
  }

  const count = parseIntegerResult(payload[0].result, "INCR");
  if (count < 1) {
    throw new Error("Rate limit store returned an invalid INCR count.");
  }

  const expiryResult = parseIntegerResult(payload[1].result, "EXPIRE");
  if (expiryResult !== 0 && expiryResult !== 1) {
    throw new Error("Rate limit store returned an invalid EXPIRE result.");
  }

  return count;
}
