const SUPPORT_EMAIL = "usehungrysingapore@gmail.com";
const MERCHANTS_URL = "https://usehungry.com/for-merchants";

type MerchantApprovalEmailInput = {
  stallName?: string;
  to: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildMerchantApprovalEmail({ stallName }: Pick<MerchantApprovalEmailInput, "stallName">) {
  const stall = stallName?.trim() || "your stall";
  const subject = "Your Hungry claim is approved";
  const lines = [
    `Good news: your claim for ${stall} on Hungry is approved.`,
    "Open the Hungry app, sign in with the same account you used to claim, then go to the Merchant Centre. Your stall is there. Add your menu and photos, and submit your licence so we can verify it before your menu goes live to diners.",
    `Need the app or a hand getting started? ${MERCHANTS_URL} has the steps. You can also reply to this email and a real person will get back to you.`,
  ];
  const footer = `You're receiving this because you claimed a stall on Hungry. Questions? Email ${SUPPORT_EMAIL}.`;

  const text = [...lines.flatMap((line) => [line, ""]), "The Hungry team", "", footer].join("\n");
  const html = [
    ...lines.map((line) => `<p>${escapeHtml(line)}</p>`),
    "<p>The Hungry team</p>",
    `<p style="color:#6b6b6b;font-size:12px">${escapeHtml(footer)}</p>`,
  ].join("\n");

  return { html, subject, text };
}

export function buildClaimNotApprovedEmail({ stallName }: Pick<MerchantApprovalEmailInput, "stallName">) {
  const stall = stallName?.trim() || "this stall";
  const subject = "About your Hungry stall claim";
  const lines = [
    `Another claim for ${stall} was approved first, so we could not approve yours.`,
    `If you run ${stall} and think this is a mistake, reply to this email with your name and a photo of your licence, and a real person will look at it again.`,
  ];
  const footer = `You're receiving this because you claimed a stall on Hungry. Questions? Email ${SUPPORT_EMAIL}.`;

  const text = [...lines.flatMap((line) => [line, ""]), "The Hungry team", "", footer].join("\n");
  const html = [
    ...lines.map((line) => `<p>${escapeHtml(line)}</p>`),
    "<p>The Hungry team</p>",
    `<p style="color:#6b6b6b;font-size:12px">${escapeHtml(footer)}</p>`,
  ].join("\n");

  return { html, subject, text };
}

// Best effort: the decision is already saved, so a failed email never fails it. Returns whether
// it was sent so the console can tell ops to follow up by hand.
async function sendEmail(
  to: string,
  { html, subject, text }: { html: string; subject: string; text: string },
  label: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = (process.env.WAITLIST_EMAIL_FROM ?? process.env.RESEND_FROM)?.trim();
  if (!apiKey || !from) return false;

  const apiUrl = (process.env.HUNGRY_EMAIL_API_URL?.trim() || "https://api.resend.com").replace(/\/$/, "");
  try {
    const response = await fetch(`${apiUrl}/emails`, {
      body: JSON.stringify({ from, html, reply_to: SUPPORT_EMAIL, subject, text, to: [to] }),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      console.error(`${label} email rejected`, response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`${label} email failed`, error);
    return false;
  }
}

export function sendMerchantApprovalEmail(input: MerchantApprovalEmailInput): Promise<boolean> {
  return sendEmail(input.to, buildMerchantApprovalEmail(input), "Merchant approval");
}

export function sendClaimNotApprovedEmail(input: MerchantApprovalEmailInput): Promise<boolean> {
  return sendEmail(input.to, buildClaimNotApprovedEmail(input), "Claim not approved");
}
