import type { WaitlistAudience } from "@/lib/supabase/websiteData";

const SUPPORT_EMAIL = "usehungrysingapore@gmail.com";

type WelcomeEmailInput = {
  audience: WaitlistAudience;
  name?: string;
  to: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildWaitlistWelcomeEmail({ audience, name }: Omit<WelcomeEmailInput, "to">) {
  const isMerchant = audience === "merchant";
  const greeting = name ? `Hi ${name},` : "Hi,";
  const subject = isMerchant
    ? "You're on the Hungry merchant list"
    : "You're on the Hungry list";
  const lines = isMerchant
    ? [
        "Thanks for joining the Hungry merchant waitlist. Listing your food business on Hungry is free.",
        "When Merchant Mode opens we'll email you so you can add your menu, prices, photos and opening hours, and be found by the dish you sell.",
        "Want to be listed sooner, or have a question? Reply to this email and a real person will get back to you.",
      ]
    : [
        "Thanks for joining the Hungry waitlist. Hungry helps you decide what to eat in Singapore by starting with the dish, not just the stall.",
        "We'll email you when early access opens. Until then, tell a friend who always asks \"eat what?\"",
        "Questions or a stall you think we should know about? Just reply to this email.",
      ];
  const footer = `You're receiving this because you joined the Hungry waitlist. To be removed, reply "remove" or email ${SUPPORT_EMAIL}.`;

  const text = [greeting, "", ...lines.flatMap((line) => [line, ""]), "The Hungry team", "", footer].join("\n");
  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    ...lines.map((line) => `<p>${escapeHtml(line)}</p>`),
    "<p>The Hungry team</p>",
    `<p style="color:#6b6b6b;font-size:12px">${escapeHtml(footer)}</p>`,
  ].join("\n");

  return { html, subject, text };
}

// Best effort: a failed welcome email must never fail the signup.
export async function sendWaitlistWelcomeEmail(input: WelcomeEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = (process.env.WAITLIST_EMAIL_FROM ?? process.env.RESEND_FROM)?.trim();
  if (!apiKey || !from) return false;

  const apiUrl = (process.env.HUNGRY_EMAIL_API_URL?.trim() || "https://api.resend.com").replace(/\/$/, "");
  const { html, subject, text } = buildWaitlistWelcomeEmail(input);

  try {
    const response = await fetch(`${apiUrl}/emails`, {
      body: JSON.stringify({
        from,
        headers: { "List-Unsubscribe": `<mailto:${SUPPORT_EMAIL}?subject=Remove%20me>` },
        html,
        reply_to: SUPPORT_EMAIL,
        subject,
        text,
        to: [input.to],
      }),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      console.error("Waitlist welcome email rejected", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Waitlist welcome email failed", error);
    return false;
  }
}
