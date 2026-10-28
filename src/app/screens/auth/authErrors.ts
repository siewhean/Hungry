import { getAuthFailureMessage } from "@/features/auth/authErrors";

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

/** The sign-in failure message: account states first, then offline / rate limit / generic. */
export function getLoginErrorMessage(error: unknown): string {
  const { code } = getAuthErrorLogContext(error);
  if (code === "email_not_confirmed") return AUTH_COPY.login.emailNotConfirmedToast;
  if (code === "invalid_credentials") return AUTH_COPY.login.invalidCredentialsToast;
  if (code === "user_banned") return AUTH_COPY.login.accountUnavailableToast;
  return getAuthFailureMessage(error, AUTH_COPY.login.genericErrorToast);
}
