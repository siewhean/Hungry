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
        queue deletion of your account and associated personal data, then sign the app out.
      </p>
    ),
  },
  {
    title: "If you cannot access the app",
    body: (
      <p>
        Email hello@hungry.sg from the email address linked to your Hungry account with the subject
        "Account deletion". We may ask for verification before processing the request.
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
        Hungry aims to process verified deletion requests within 30 days unless a legal, safety, or
        abuse-prevention exception applies.
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
