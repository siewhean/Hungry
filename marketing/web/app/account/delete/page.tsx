import type { Metadata } from "next";

import { LegalPage } from "../../_components/LegalPage";

export const metadata: Metadata = {
  title: "Delete Your Hungry Account",
  description: "How to request deletion of your Hungry account and associated data.",
};

const sections = [
  {
    title: "In-app deletion",
    body: (
      <p>
        Open Hungry, go to Profile, Settings, Delete account, and confirm the request. Hungry will
        schedule deletion of your account and associated personal data after 30 days, then sign the app out. Signing back in does not cancel deletion. Before the deadline, choose Keep my account in the app and wait for successful cancellation confirmation.
      </p>
    ),
  },
  {
    title: "If you cannot access the app",
    body: (
      <p>
        Email usehungrysingapore@gmail.com from the email address linked to your Hungry account with the subject
        &quot;Account deletion&quot;. We may ask for verification before processing the request.
      </p>
    ),
  },
  {
    title: "What may be retained",
    body: (
      <p>
        Some safety, fraud-prevention, moderation, legal, or audit records may be retained in
        minimized or anonymized form when required to protect users or comply with obligations.
      </p>
    ),
  },
  {
    title: "Expected timeline",
    body: (
      <p>
        Deletion is scheduled 30 days after a confirmed request. After that, account-associated personal data is deleted or anonymized. Required legal, safety, or abuse-prevention records may be retained.
      </p>
    ),
  },
];

export default function AccountDeletePage() {
  return (
    <LegalPage
      eyebrow="Account deletion"
      intro="Use this page if you need to delete your Hungry account or understand what happens after a deletion request."
      lastUpdated="May 18, 2026"
      sections={sections}
      title="Delete your Hungry account"
    />
  );
}
