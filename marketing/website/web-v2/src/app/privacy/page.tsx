import { routeMetadata } from "@/app/seo";

export const revalidate = 3600;
export const metadata = routeMetadata("/privacy");

const sections = [
  {
    title: "1. Information Hungry Collects",
    body: "Hungry may collect waitlist sign-up details such as email address, first name, and (for merchants) business name and business type; account details such as name, email address, profile settings, authentication identifiers, and deletion requests; app activity such as searches, likes, saves, follows, reviews, comments, reports, messages, and taste-preference signals; location information when you use nearby discovery or maps; photos, videos, captions, and menu images you upload; merchant profile, claim, team, menu, promotion, and verification details; and technical data such as device, crash, diagnostic, and analytics events.",
  },
  {
    title: "2. How Hungry Uses Information",
    body: "We use waitlist details only to tell you when Hungry opens and to contact you about the list you joined; you can ask us to remove your waitlist entry at any time. We use this information to operate sign-in, onboarding, discovery, reviews, social features, recommendations, merchant tools, safety reporting, abuse prevention, support, analytics, crash diagnostics, and store-compliance processes. Taste and interaction data may be used to personalize Home, Discover, Search, and Decide For Me recommendations.",
  },
  {
    title: "3. Third-Party Processing",
    body: "Hungry uses service providers such as Supabase for authentication, database, storage, realtime, and Edge Functions; Google services for maps, places, OCR, or AI-assisted extraction where enabled; PostHog for analytics where configured; Sentry for crash diagnostics where configured; and Expo/EAS for app build and update infrastructure. Precise latitude and longitude are not sent as PostHog identity properties by default. Resend delivers our sign-in and account emails to the address you give us; Mapbox draws the map and sees the map area you view and your device's IP address; and Google Sign-In is offered on Android and the web where enabled. PostHog stores analytics data in the United States. You can turn analytics off in the app under Settings. These providers process data only for service operation, security, analytics, diagnostics, or app functionality.",
  },
  {
    title: "4. Photos, Videos, OCR, And AI Features",
    body: "If you upload photos, videos, menu images, reviews, or merchant verification media, Hungry stores and processes those files to provide the requested feature. Menu OCR and AI-assisted suggestions may send extracted text, image references, or menu metadata to configured third-party processors. AI suggestions are treated as drafts or assistance and may require review before publication.\n\nThird-party AI. Hungry sends some data to third-party AI providers, and tells you before it does. Today that covers: (a) Mood search, where the words you type are sent to Anthropic (the Claude API) so it can match them to dishes; and (b) menu photos you submit for a stall, where the photo is sent to Google Cloud Vision to read the text on it and that text is sent to Google Gemini to pick out dish names and prices. We ask for your permission before the first time for each, and you can withdraw it later in the app under Settings. We send only what the feature needs: we do not send your name, email address or account identifiers. These providers process the data to return a result and, under their business API terms, do not use it to train their models. If you do not give permission, Mood search is not used and normal search still works, and a menu photo is not sent for reading.\n\nSafety check. Photos you add to a review are also sent to Google Cloud Vision, before the review is posted, to check them for explicit or violent content. This check is part of keeping Hungry safe, so it is not optional, and it is not used for advertising or to identify anyone. A photo that fails the check is not posted.",
  },
  {
    title: "5. User-Generated Content And Safety",
    body: "Reviews, posts, comments, profile content, and messages may be visible to other users depending on the feature and privacy settings. Hungry provides reporting, hiding, and blocking controls and may retain moderation and safety records in limited form to investigate abuse, enforce rules, prevent fraud, or comply with legal obligations. We aim to review every report within 24 hours. Reviews and text you post are checked automatically for banned terms and spam before they are shown.",
  },
  {
    title: "6. Retention, Deletion, And Correction",
    body: "Hungry keeps personal data only as long as needed for the feature, legal obligations, security, fraud prevention, moderation, or legitimate operational needs. You can request account deletion in the app under Settings or at usehungry.com/account/delete. Deletion is scheduled 30 days after the request, and you can cancel it by signing back in before then and choosing Keep my account. After that, account-associated personal data is removed or anonymized. Menu photos you uploaded stay on the stall's page without your name, because they help other diners. Some safety, fraud, legal, or audit records may be retained in minimized or anonymized form.",
  },
  {
    title: "7. Singapore Privacy Rights",
    body: "Hungry is designed for Singapore users and aims to follow the Personal Data Protection Act obligations for consent, purpose limitation, notification, access, correction, protection, retention limitation, accuracy, and accountability. To get a copy of your data, use Download my data in the app under Settings; it covers your profile, reviews, posts, favourites, saves, and follows. For anything it does not include, or to correct or delete personal data, email usehungrysingapore@gmail.com and we will respond within 30 days.",
  },
  {
    title: "8. Contact",
    body: "Hungry's privacy contact (Data Protection Officer) can be reached at usehungrysingapore@gmail.com. For privacy, deletion, access, correction, or safety requests, email usehungrysingapore@gmail.com. Include the email address used for your Hungry account when relevant so we can verify and process the request.",
  },
];

export default function PrivacyPolicy() {
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
          Privacy Policy
        </h1>
        <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
          <em>Last updated: October 31, 2026</em>
        </p>
        <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
          This policy covers the Hungry mobile app, merchant tools, and Hungry website surfaces that
          link to this page.
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
              <p style={{ whiteSpace: "pre-line" }}>{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
