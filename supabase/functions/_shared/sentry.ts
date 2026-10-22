// @ts-nocheck
/* eslint-disable import/no-unresolved */
// Shared error tracking for every Edge Function. Wrap the handler with serveWithSentry instead
// of calling Deno.serve; a CI contract (error-reporting-contracts.test.ts) enforces this.
//
// Needs the SENTRY_DSN function secret. Without it everything here is a no-op, so local
// runs and functions deployed before the secret is set keep working.
import * as Sentry from "npm:@sentry/deno@10.76.2";
import { scrubEvent } from "./sentryScrub.ts";

const dsn = Deno.env.get("SENTRY_DSN") ?? "";

if (dsn) {
  Sentry.init({
    dsn,
    environment: Deno.env.get("APP_ENV") ?? "production",
    // The Deno default integrations read the filesystem and install global handlers that
    // the Edge runtime does not support (Supabase's own Sentry guide turns them off).
    defaultIntegrations: false,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
  });
}

// Requests whose error was already reported with its stack, so a 5xx response for the same
// request does not create a second, stackless event.
const reportedRequests = new WeakSet<Request>();

type ErrorContext = Record<string, string | number | boolean | null | undefined>;

function tagScope(scope, functionName: string, context: ErrorContext = {}) {
  scope.setTag("function", functionName);
  scope.setTag("region", Deno.env.get("SB_REGION") ?? "unknown");
  scope.setTag("execution_id", Deno.env.get("SB_EXECUTION_ID") ?? "unknown");
  scope.setExtras(context);
}

/**
 * Report an error the function handled itself (a per-item failure, a failed RPC). Pass the
 * request when the handler then returns a 5xx, so the response is not reported twice. Never throws.
 */
export async function reportFunctionError(
  functionName: string,
  error: unknown,
  context: ErrorContext = {},
  request?: Request,
): Promise<void> {
  console.error(`${functionName} error`, error, context);
  if (request) reportedRequests.add(request);
  if (!dsn) return;
  try {
    Sentry.withScope((scope) => {
      tagScope(scope, functionName, context);
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error?.message ?? error)),
      );
    });
    await Sentry.flush(2000);
  } catch {
    // Reporting must never break the function.
  }
}

async function errorCodeOf(response: Response): Promise<string> {
  try {
    const body = await response.clone().json();
    return typeof body?.error === "string" ? body.error : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Drop-in replacement for Deno.serve. Uncaught exceptions and 5xx responses are sent to
 * Sentry, tagged with the function name; the caller gets a generic 500 for an exception.
 */
export function serveWithSentry(
  functionName: string,
  handler: (request: Request) => Promise<Response> | Response,
) {
  Deno.serve(async (request) => {
    try {
      const response = await handler(request);
      if (dsn && response.status >= 500 && !reportedRequests.has(request)) {
        const code = await errorCodeOf(response);
        try {
          Sentry.withScope((scope) => {
            tagScope(scope, functionName, { status: response.status, code });
            Sentry.captureMessage(`${functionName} responded ${response.status}: ${code}`, "error");
          });
          await Sentry.flush(2000);
        } catch {
          // Reporting must never break the response.
        }
      }
      return response;
    } catch (error) {
      await reportFunctionError(functionName, error, { method: request.method }, request);
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
}
