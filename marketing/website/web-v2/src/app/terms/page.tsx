import { routeMetadata } from "@/app/seo";

export const revalidate = 3600;
export const metadata = routeMetadata("/terms");

const sections = [
  {
    title: "1. Using Hungry",
    body:
      "Hungry helps people discover dishes, stalls, hawker centres, restaurants, reviews, and merchant information in Singapore. You must use Hungry lawfully, provide accurate account information, and keep your account secure.",
  },
  {
    title: "2. User-Generated Content",
    body:
      "You are responsible for reviews, posts, comments, messages, photos, videos, profile content, reports, and other content you submit. Do not post abusive, harassing, hateful, sexually explicit, violent, illegal, deceptive, spam, infringing, or unsafe content. Hungry may hide, remove, restrict, or preserve content when needed for safety, moderation, legal, or abuse-prevention reasons.",
  },
  {
    title: "3. Reporting, Blocking, And Moderation",
    body:
      "Hungry provides report, hide, and block controls for community content. Reports are reviewed for safety and policy enforcement. Blocking reduces visibility between users where supported, but it may not remove already processed safety records or legal/audit records.",
  },
  {
    title: "4. Merchant And Menu Information",
    body:
      "Merchant profiles, menus, promotions, verification evidence, and claim details must be accurate and must not mislead users. Hungry may review merchant submissions before publishing changes and may reject claims or edits that cannot be verified.",
  },
  {
    title: "5. AI, OCR, And Recommendations",
    body:
      "AI-assisted menu extraction, replies, descriptions, and recommendations are provided to support discovery and merchant workflows. They may be incomplete or inaccurate and should be reviewed before relying on them for business, dietary, allergen, pricing, or safety decisions.",
  },
  {
    title: "6. Account Deletion",
    body:
      "If you create an account, you can request account deletion in the app under Settings or at hungry.sg/account/delete. Hungry will remove or anonymize account-associated personal data unless limited retention is required for safety, fraud prevention, legal obligations, or audit purposes.",
  },
  {
    title: "7. Changes And Contact",
    body:
      "Hungry may update these terms as the app and merchant tools evolve. For support, safety, privacy, or deletion requests, email tryhungrysingapore@gmail.com.",
  },
];

export default function TermsOfService() {
  return (
    <main
      className="container"
      style={{
        paddingTop: "calc(var(--header-height) + var(--space-16))",
        paddingBottom: "var(--space-24)",
        minHeight: "80vh",
      }}
    >
      <article style={{ maxWidth: "860px", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "3rem",
            fontWeight: 800,
            marginBottom: "var(--space-4)",
            color: "var(--color-text-primary)",
          }}
        >
          Terms of Service
        </h1>
        <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
          <em>Last updated: May 18, 2026</em>
        </p>
        <div
          style={{
            color: "var(--color-text-secondary)",
            lineHeight: 1.8,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
            marginTop: "var(--space-8)",
          }}
        >
          {sections.map((section) => (
            <section key={section.title}>
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                  marginBottom: "var(--space-2)",
                }}
              >
                {section.title}
              </h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
