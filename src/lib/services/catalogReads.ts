export type CatalogReadFailure =
  | "auth"
  | "timeout"
  | "rate-limit"
  | "server"
  | "cancelled"
  | "network"
  | "contract";

export class CatalogReadError extends Error {
  constructor(
    message: string,
    readonly outcome: CatalogReadFailure,
    readonly status?: number,
    readonly code?: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "CatalogReadError";
  }
}

export function catalogReadOutcome(error: unknown): CatalogReadFailure {
  if (error instanceof CatalogReadError) return error.outcome;
  const fields = typeof error === "object" && error ? (error as Record<string, unknown>) : {};
  const status = Number(fields.status);
  const code = String(fields.code ?? "").toUpperCase();
  const message = String(fields.message ?? error ?? "").toLowerCase();
  if (
    status === 401 ||
    status === 403 ||
    code === "42501" ||
    code === "PGRST301" ||
    code === "PGRST303" ||
    ["session_invalid", "authentication_required", "authorization"].includes(String(fields.kind))
  )
    return "auth";
  if (fields.name === "AbortError") return "cancelled";
  if (
    status === 429 ||
    code === "PT429" ||
    code === "RATE_LIMITED" ||
    fields.kind === "rate_limited" ||
    message.includes("rate limited")
  )
    return "rate-limit";
  if (
    status === 408 ||
    status === 504 ||
    code === "57014" ||
    message.includes("timed out") ||
    message.includes("statement timeout")
  )
    return "timeout";
  if (status >= 500) return "server";
  if (
    fields.kind === "network" ||
    fields.kind === "unavailable" ||
    /failed to fetch|fetch failed|network request failed|network error|load failed/.test(message)
  ) {
    return "network";
  }
  return "contract";
}

const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();

export function catalogProjectHost(): string | undefined {
  if (!projectUrl) return undefined;
  try {
    return new URL(projectUrl).host;
  } catch {
    return undefined;
  }
}

let sessionGeneration = 0;
let observingSession = false;

/** Changes on account switch and sign-out/sign-in, including reopening the same account. */
export function catalogRequestScope(): string {
  if (!observingSession) {
    const { useSessionStore } =
      require("@/store/useSessionStore") as typeof import("@/store/useSessionStore");
    useSessionStore.subscribe((next, previous) => {
      if (
        next.isAuthenticated !== previous.isAuthenticated ||
        next.authenticatedUserId !== previous.authenticatedUserId ||
        next.authDataSource !== previous.authDataSource
      ) {
        sessionGeneration += 1;
      }
    });
    observingSession = true;
  }
  return `${catalogProjectHost() ?? "local"}:${sessionGeneration}`;
}

export function requireCurrentCatalogScope(scope: string): void {
  if (scope !== catalogRequestScope()) {
    throw new CatalogReadError("The account changed during the request.", "cancelled");
  }
}
