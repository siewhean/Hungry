import { Webhook } from "npm:standardwebhooks@^1";
import { reportFunctionError, serveWithSentry } from "../_shared/sentry.ts";

type EmailAction =
  | "signup"
  | "recovery"
  | "magiclink"
  | "invite"
  | "reauthentication"
  | "email_change";

type HookPayload = {
  user?: {
    email?: unknown;
    new_email?: unknown;
  };
  email_data?: {
    email_action_type?: unknown;
    token?: unknown;
    token_hash?: unknown;
    token_new?: unknown;
    token_hash_new?: unknown;
    redirect_to?: unknown;
    site_url?: unknown;
  };
};

type ResendSendResponse = {
  id?: string;
  message?: string;
};

const MAX_HOOK_BODY_BYTES = 64 * 1024;

function jsonResponse(status: number, body: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function parseAction(value: unknown): EmailAction | null {
  return value === "signup" ||
      value === "recovery" ||
      value === "magiclink" ||
      value === "invite" ||
      value === "reauthentication" ||
      value === "email_change"
    ? value
    : null;
}

function getTemplateId(action: EmailAction): string {
  const envName = {
    signup: "RESEND_TEMPLATE_SIGNUP_ID",
    recovery: "RESEND_TEMPLATE_RECOVERY_ID",
    magiclink: "RESEND_TEMPLATE_MAGICLINK_ID",
    invite: "RESEND_TEMPLATE_SIGNUP_ID",
    reauthentication: "RESEND_TEMPLATE_MAGICLINK_ID",
    email_change: "RESEND_TEMPLATE_SIGNUP_ID",
  }[action];
  return requiredEnv(envName);
}

function makeConfirmationUrl(tokenHash: string, action: EmailAction, redirectTo: string): string {
  const supabaseUrl = new URL(requiredEnv("SUPABASE_URL"));
  if (supabaseUrl.protocol !== "https:" && supabaseUrl.hostname !== "localhost") {
    throw new Error("invalid_supabase_url");
  }

  const confirmationUrl = new URL("/auth/v1/verify", supabaseUrl);
  confirmationUrl.searchParams.set("token", tokenHash);
  confirmationUrl.searchParams.set("type", action);
  confirmationUrl.searchParams.set("redirect_to", redirectTo);
  return confirmationUrl.toString();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function makeIdempotencyKey(webhookId: string, messageLabel: string): Promise<string> {
  const source = new TextEncoder().encode(`${webhookId}\0${messageLabel}`);
  const digest = await crypto.subtle.digest("SHA-256", source);
  const hexDigest = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `hungry-auth-${hexDigest}`;
}

async function sendTemplatedEmail(args: {
  apiKey: string;
  sender: string;
  recipient: string;
  templateId: string;
  token: string;
  confirmationUrl: string;
  includeConfirmationUrl: boolean;
  idempotencyKey: string;
}): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": args.idempotencyKey,
      },
      body: JSON.stringify({
        from: args.sender,
        to: [args.recipient],
        template: {
          id: args.templateId,
          // Resend templates should declare TOKEN and may declare
          // CONFIRMATION_URL. Do not send undeclared variables.
          variables: args.includeConfirmationUrl
            ? { TOKEN: args.token, CONFIRMATION_URL: args.confirmationUrl }
            : { TOKEN: args.token },
        },
      }),
    });
  } catch {
    return false;
  }

  if (!response.ok) return false;
  const result = (await response.json().catch(() => ({}))) as ResendSendResponse;
  return isNonEmptyString(result.id);
}

serveWithSentry("send-email", async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  let resendApiKey: string;
  let sender: string;
  let hookSecret: string;
  try {
    resendApiKey = requiredEnv("RESEND_API_KEY");
    sender = requiredEnv("RESEND_FROM");
    hookSecret = requiredEnv("SEND_EMAIL_HOOK_SECRET").replace(/^v1,whsec_/, "");
    if (hookSecret.length === 0 || sender.includes("\r") || sender.includes("\n")) {
      throw new Error("invalid_email_hook_configuration");
    }
  } catch (error) {
    await reportFunctionError("send-email", error, { stage: "configuration" });
    return jsonResponse(500, { error: "email_hook_not_configured" });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_HOOK_BODY_BYTES) {
    return jsonResponse(413, { error: "payload_too_large" });
  }

  let payload: HookPayload;
  let webhookId: string;
  try {
    // Supabase signs the exact raw body with Standard Webhooks headers. Verify
    // before parsing or acting on any recipient, token, redirect, or action.
    const webhook = new Webhook(hookSecret);
    payload = webhook.verify(rawBody, Object.fromEntries(request.headers.entries())) as HookPayload;
    webhookId = request.headers.get("webhook-id")?.trim() ?? "";
    if (!webhookId || webhookId.length > 256) {
      return jsonResponse(401, { error: "invalid_webhook_signature" });
    }
  } catch {
    return jsonResponse(401, { error: "invalid_webhook_signature" });
  }

  const emailData = payload.email_data;
  const action = parseAction(emailData?.email_action_type);
  if (!action) {
    return jsonResponse(422, { error: "unsupported_email_action" });
  }

  const redirectTo = emailData?.redirect_to;
  if (!isNonEmptyString(redirectTo)) {
    return jsonResponse(400, { error: "invalid_email_hook_payload" });
  }

  let templateId: string;
  try {
    templateId = getTemplateId(action);
  } catch (error) {
    await reportFunctionError("send-email", error, { stage: "template", action });
    return jsonResponse(500, { error: "email_hook_not_configured" });
  }

  const messages: Array<{ recipient: string; token: unknown; tokenHash: unknown; label: string }> = [];
  if (action === "email_change") {
    // Supabase documents these legacy reversed pairs: token + token_hash_new
    // goes to the current address, while token_new + token_hash goes to the
    // new address. If only one pair exists, it goes to the new address.
    const currentEmail = payload.user?.email;
    const newEmail = payload.user?.new_email;
    const token = emailData?.token;
    const tokenHash = emailData?.token_hash;
    const tokenNew = emailData?.token_new;
    const tokenHashNew = emailData?.token_hash_new;
    const hasCurrentPair = isNonEmptyString(currentEmail) && isNonEmptyString(token) &&
      isNonEmptyString(tokenHashNew);
    const hasNewPair = isNonEmptyString(newEmail) && isNonEmptyString(tokenNew) &&
      isNonEmptyString(tokenHash);

    if (hasCurrentPair && hasNewPair) {
      messages.push(
        { recipient: currentEmail, token, tokenHash: tokenHashNew, label: "email-change-current" },
        { recipient: newEmail, token: tokenNew, tokenHash, label: "email-change-new" },
      );
    } else if (isNonEmptyString(newEmail) && isNonEmptyString(tokenHash)) {
      // Secure Email Change disabled: Supabase may put the OTP in either
      // token field, but the documented hash for the new address is token_hash.
      const newToken = isNonEmptyString(tokenNew) ? tokenNew : token;
      if (isNonEmptyString(newToken)) {
        messages.push({ recipient: newEmail, token: newToken, tokenHash, label: "email-change-new" });
      }
    }
  } else {
    messages.push({
      recipient: payload.user?.email ?? "",
      token: emailData?.token,
      tokenHash: emailData?.token_hash,
      label: "primary",
    });
  }

  if (
    messages.length === 0 ||
    messages.some((message) =>
      !isNonEmptyString(message.recipient) || !isNonEmptyString(message.token) ||
      !isNonEmptyString(message.tokenHash)
    )
  ) {
    return jsonResponse(400, { error: "invalid_email_hook_payload" });
  }

  for (const message of messages) {
    let confirmationUrl: string;
    let idempotencyKey: string;
    try {
      confirmationUrl = makeConfirmationUrl(message.tokenHash as string, action, redirectTo);
      idempotencyKey = await makeIdempotencyKey(webhookId, message.label);
    } catch (error) {
      await reportFunctionError("send-email", error, { stage: "confirmation_url", action });
      return jsonResponse(500, { error: "email_hook_not_configured" });
    }

    // n-plus-one-ok: one email per recipient, at most two (email change); not a database call
    const sent = await sendTemplatedEmail({
      apiKey: resendApiKey,
      sender,
      recipient: message.recipient,
      templateId,
      token: message.token as string,
      confirmationUrl,
      includeConfirmationUrl: action !== "magiclink" && action !== "reauthentication",
      idempotencyKey,
    });
    if (!sent) {
      await reportFunctionError("send-email", new Error("email_provider_rejected_message"), {
        action,
        label: message.label,
      });
      // A retry uses the same per-message key, including when the first email
      // of a two-address email-change flow succeeded but the second failed.
      return jsonResponse(502, { error: "email_provider_rejected_message" });
    }
  }

  return jsonResponse(200, {});
});
