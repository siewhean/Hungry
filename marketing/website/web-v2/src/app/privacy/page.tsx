import { routeMetadata } from "@/app/seo";
import { PolicyPage } from "@/components/legal/PolicyPage";

export const revalidate = 3600;
export const metadata = routeMetadata("/privacy");

const sections = [
  {
    title: "1. Information Hungry Collects",
    body: "Account and authentication details, profile and taste preferences, searches and saved items, reviews and other content you submit, support or deletion requests, and merchant information are used for the features you choose. Nearby discovery can use location when you allow it. Uploads may contain personal information: avoid including other people, identity documents, or unrelated details unless the feature specifically requires them. We do not need your date of birth to confirm the adult-only launch requirement.",
  },
  {
    title: "2. Purposes And Choices",
    body: "Hungry uses information to provide requested features, authenticate users, personalize discovery, answer support requests, and protect the service. Device permissions can be refused or changed in device settings; nearby results or uploads may then be limited. Optional website analytics stays off until you accept it. Refusing analytics does not prevent use of the public website. Waitlist submission requests updates for your selected list; it is not permission for unrelated marketing.",
  },
  {
    title: "3. Third-Party Processing",
    body: "Supabase provides authentication, database, storage, realtime, and Edge Functions. Mapbox supplies maps where enabled. Google services for maps, places, OCR, or AI-assisted extraction where enabled may process relevant requests. PostHog for analytics where configured and Sentry for crash diagnostics where configured process minimized technical events. Expo/EAS provides build and update infrastructure, Resend delivers configured email, and Vercel hosts the website and supplies consent-controlled website analytics. Precise latitude and longitude are not sent as PostHog identity properties by default. Some providers may process information outside Singapore; configuration and contractual safeguards require review before release. This list describes potential integrations, not a claim that every provider receives your data on every visit.",
  },
  {
    title: "4. Photos, Videos, OCR, And AI Features",
    body: "Uploads are processed to provide the feature you request. Menu OCR or AI-assisted extraction, when enabled, can send images or extracted information to configured processors. Do not upload sensitive or unrelated information. Suggestions require review and do not verify allergen safety, prices, certification, or factual accuracy.",
  },
  {
    title: "5. User-Generated Content And Safety",
    body: "Reviews, posts, profile details, and other content may be public according to the feature. Messages are visible to their recipients and may be processed for service operation and safety. Reporting, hiding, and blocking controls are available where supported. Limited records may be retained to investigate abuse or meet legal requirements.",
  },
  {
    title: "6. Retention, Deletion, And Correction",
    body: "Hungry retains personal data for the purpose for which it is needed and applicable legal or security requirements. Signed-in users can request deletion under Profile, Settings, Delete account. Deletion is scheduled 30 days after the request; signing in alone does not cancel it. To cancel before the deadline, choose Keep my account and wait for successful confirmation. Removal or anonymization depends on the deletion worker processing the request; a scheduled date is not proof of completion. Menu photos may remain without your name, and limited security, moderation, legal, or audit records may remain where needed. Contact support about identifiable content that remains or to request a status update.",
  },
  {
    title: "7. Singapore Privacy Requests",
    body: "The Personal Data Protection Act governs applicable Singapore personal-data obligations. You can ask about access, correction, deletion, retention, or withdrawal of consent. Download my data in app Settings exports supported account data; it may not cover every record. For account, waitlist, or other data requests, email usehungrysingapore@gmail.com. We may verify the request using proportionate information. Do not email passwords, authentication codes, or identity documents. We will explain applicable retention exceptions or any impact on the service rather than promise unconditional deletion.",
  },
  {
    title: "8. Children And Young People",
    body: "Account creation and personal-data submissions for the current launch are restricted to people aged 18 or over. This is a Hungry product restriction, not a statement of the legal age of consent in Singapore. A guardian consent workflow is not available. Do not submit a child’s details. If a child’s data was submitted, contact usehungrysingapore@gmail.com for review and removal where appropriate.",
  },
  {
    title: "9. Cookies And Withdrawal",
    body: "Our Cookie Policy explains browser storage and cookie choices. Use Cookie preferences to refuse or withdraw optional website analytics at any time. To stop waitlist emails, request unsubscribe using the message facility or email usehungrysingapore@gmail.com with the subject Unsubscribe. Essential account and safety messages are separate from marketing.",
  },
  {
    title: "10. Contact",
    body: "The published Hungry support and privacy-request address is usehungrysingapore@gmail.com. The business details page provides the currently published product and contact information. A named Data Protection Officer appointment and registered operator details must be confirmed by the operator; this policy does not verify them.",
  },
];

export default function Page() {
  return (
    <PolicyPage
      title="Privacy Policy"
      intro="This policy covers the Hungry website, mobile app, and merchant tools that link here. Available features and service providers depend on the build and configuration."
      sections={sections}
    />
  );
}
