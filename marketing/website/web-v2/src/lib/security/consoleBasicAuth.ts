import type { NextRequest } from "next/server";

export const CONSOLE_BASIC_AUTH_REALM = "Hungry Console";

type ConsoleBasicAuthCredentials = {
  password: string;
  username: string;
};

type ConsoleBasicAuthResult =
  | {
      configured: false;
      reason: "missing_config";
      valid: false;
    }
  | {
      configured: true;
      reason: "missing_header" | "malformed_header" | "invalid_credentials";
      valid: false;
    }
  | {
      configured: true;
      reason: "valid";
      valid: true;
    };

function envValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getConsoleBasicAuthCredentials(): ConsoleBasicAuthCredentials | null {
  const username =
    envValue("HUNGRY_CONSOLE_USERNAME") || envValue("HUNGRY_CONSOLE_BASIC_AUTH_USERNAME");
  const password =
    envValue("HUNGRY_CONSOLE_PASSWORD") || envValue("HUNGRY_CONSOLE_BASIC_AUTH_PASSWORD");

  if (!username || !password) return null;

  return { password, username };
}

export function consoleBasicAuthChallengeHeader() {
  return `Basic realm="${CONSOLE_BASIC_AUTH_REALM}", charset="UTF-8"`;
}

function decodeBase64(value: string) {
  try {
    return atob(value);
  } catch {
    return "";
  }
}

function parseBasicAuthorization(value: string | null) {
  if (!value) return null;

  const [scheme, encoded] = value.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "basic" || !encoded) return null;

  const decoded = decodeBase64(encoded);
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex <= 0) return null;

  return {
    password: decoded.slice(separatorIndex + 1),
    username: decoded.slice(0, separatorIndex),
  };
}

function constantTimeEquals(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
}

export function validateConsoleBasicAuth(request: NextRequest): ConsoleBasicAuthResult {
  const expected = getConsoleBasicAuthCredentials();
  if (!expected) {
    return { configured: false, reason: "missing_config", valid: false };
  }

  const provided = parseBasicAuthorization(request.headers.get("authorization"));
  if (!request.headers.get("authorization")) {
    return { configured: true, reason: "missing_header", valid: false };
  }
  if (!provided) {
    return { configured: true, reason: "malformed_header", valid: false };
  }

  const usernameMatches = constantTimeEquals(provided.username, expected.username);
  const passwordMatches = constantTimeEquals(provided.password, expected.password);

  if (!usernameMatches || !passwordMatches) {
    return { configured: true, reason: "invalid_credentials", valid: false };
  }

  return { configured: true, reason: "valid", valid: true };
}
