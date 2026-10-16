import { AUTH_COPY } from "./authCopy";

export type AuthErrorLogContext = {
  code?: string;
  status?: number;
  name?: string;
};

type AuthErrorShape = {
  error_code?: unknown;
  code?: unknown;
  status?: unknown;
  name?: unknown;
  message?: unknown;
};

/**
 * Non-PII diagnostics for a failed auth call. Never includes the message,
 * email, or any request payload — only provider error codes and HTTP status.
 */
export function getAuthErrorLogContext(error: unknown): AuthErrorLogContext {
  const shape = (error ?? {}) as AuthErrorShape;
  const rawCode = shape.error_code ?? shape.code;
  return {
    code: typeof rawCode === "string" ? rawCode : undefined,
    status: typeof shape.status === "number" ? shape.status : undefined,
    name: typeof shape.name === "string" ? shape.name : undefined,
  };
}

function isNetworkError(error: unknown): boolean {
  const message = (error as AuthErrorShape | null)?.message;
  if (typeof message !== "string") return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("network request failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network error")
  );
}

export function getLoginErrorMessage(error: unknown): string {
  const { code, status } = getAuthErrorLogContext(error);
  if (code === "email_not_confirmed") return AUTH_COPY.login.emailNotConfirmedToast;
  if (code === "invalid_credentials") return AUTH_COPY.login.invalidCredentialsToast;
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    status === 429
  ) {
    return AUTH_COPY.login.tooManyAttemptsToast;
  }
  if (code === "user_banned") return AUTH_COPY.login.accountUnavailableToast;
  if (isNetworkError(error) || status === 0) return AUTH_COPY.login.networkErrorToast;
  return AUTH_COPY.login.genericErrorToast;
}
