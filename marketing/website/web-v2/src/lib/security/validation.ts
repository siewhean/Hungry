import { NextResponse } from "next/server";

export class ApiValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiValidationError";
    this.status = status;
  }
}

export async function readJsonObject(request: Request, maxBytes = 16_384) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ApiValidationError("Request body is too large.", 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiValidationError("Request body must be valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiValidationError("Request body must be a JSON object.");
  }

  return body as Record<string, unknown>;
}

export function getStringField(
  body: Record<string, unknown>,
  key: string,
  {
    fallback,
    max = 256,
    min = 0,
    required = false,
    transform = "trim",
  }: {
    fallback?: string;
    max?: number;
    min?: number;
    required?: boolean;
    transform?: "lower-trim" | "none" | "trim";
  } = {},
) {
  const value = body[key];

  if (value === undefined || value === null) {
    if (required) throw new ApiValidationError(`Missing ${key}.`);
    return fallback;
  }

  if (typeof value !== "string") {
    throw new ApiValidationError(`Invalid ${key}.`);
  }

  const normalized =
    transform === "none"
      ? value
      : transform === "lower-trim"
        ? value.trim().toLowerCase()
        : value.trim();

  if (required && normalized.length < min) {
    throw new ApiValidationError(`Invalid ${key}.`);
  }
  if (normalized.length > max) {
    throw new ApiValidationError(`${key} is too long.`);
  }

  return normalized;
}

export function getBooleanField(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new ApiValidationError(`Invalid ${key}.`);
  return value;
}

export function validationErrorResponse(error: unknown) {
  if (error instanceof ApiValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}
