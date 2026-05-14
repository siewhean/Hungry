import type { Metadata } from "next";

import { LegalPage } from "../_components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Plain-language terms for using the Hungry marketing website and waitlist.",
};

const sections = [
  {
    title: "Using this website",
    body: (
      <p>
        You may browse the Hungry marketing website and join the waitlist for early product updates.
        The current site is an information and interest-registration surface, not an ordering,
        payment, or merchant management service.
      </p>
    ),
  },
  {
    title: "Waitlist submissions",
    body: (
      <p>
        Please submit accurate information that belongs to you or your business. Joining the
        waitlist does not guarantee access, launch timing, merchant approval, or availability in a
        specific neighbourhood.
      </p>
    ),
  },
  {
    title: "Website content",
    body: (
      <p>
        Hungry may update pages, waitlist copy, images, and product descriptions as the service
        develops. Public website content is provided for general information and may change without
        notice.
      </p>
    ),
  },
  {
    title: "Contact and requests",
    body: (
      <p>
        If you need help with the waitlist, merchant interest, privacy requests, or website content,
        contact Hungry at hello@hungry.sg so the request can be reviewed.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms of Service"
      intro="These terms cover the current Hungry marketing website and waitlist. They are intentionally short because the full consumer app and merchant portal are not live product services on this website today."
      lastUpdated="May 12, 2026"
      sections={sections}
      title="Terms of Service"
    />
  );
}
