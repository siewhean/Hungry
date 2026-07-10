import type { Metadata } from "next";

import { LegalPage } from "../_components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Plain-language terms for using Hungry's app, website, and merchant tools.",
};

const sections = [
  {
    title: "Using Hungry",
    body: (
      <p>
        Hungry helps people discover dishes, stalls, hawker centres, restaurants, reviews, and
        merchant information in Singapore. Use the service lawfully, provide accurate account
        information, and keep your account secure.
      </p>
    ),
  },
  {
    title: "User-generated content",
    body: (
      <p>
        You are responsible for reviews, posts, comments, messages, photos, videos, and profile
        content you submit. Do not post abusive, harassing, hateful, sexually explicit, violent,
        illegal, deceptive, spam, infringing, or unsafe content.
      </p>
    ),
  },
  {
    title: "Reporting, blocking, and moderation",
    body: (
      <p>
        Hungry provides report, hide, and block controls for community content. We may hide, remove,
        restrict, or retain content and safety records when needed for moderation, fraud prevention,
        legal obligations, or service security.
      </p>
    ),
  },
  {
    title: "Merchant and AI-assisted tools",
    body: (
      <p>
        Merchant profiles, menus, promotions, verification details, and claim requests must be
        accurate and not misleading. OCR, AI-assisted descriptions, replies, and recommendations may
        be incomplete and should be reviewed before relying on them for pricing, dietary, allergen,
        business, or safety decisions.
      </p>
    ),
  },
  {
    title: "Account deletion",
    body: (
      <p>
        If you create an account, you can request deletion in the app under Settings or at
        hungry.sg/account/delete. Hungry will remove or anonymize account-associated personal data
        unless limited retention is required for safety, fraud prevention, legal obligations, or
        audit purposes.
      </p>
    ),
  },
  {
    title: "Contact and requests",
    body: (
      <p>
        If you need help with account deletion, safety reports, privacy requests, or app content,
        contact Hungry at hello@hungry.sg so the request can be reviewed.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms of Service"
      intro="These terms cover Hungry surfaces that link to this page, including the mobile app, public website, community features, and merchant tools."
      lastUpdated="May 18, 2026"
      sections={sections}
      title="Terms of Service"
    />
  );
}
