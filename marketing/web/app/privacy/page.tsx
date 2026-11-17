import type { Metadata } from "next";

import { MarketingStaticPage, PageSection } from "../_components/MarketingStaticPage";

const COLLECTED_DATA = [
  {
    title: "Account and profile details",
    body: "Hungry may collect your name, email address, authentication identifiers, profile settings, location preferences, and account deletion requests when you use the app.",
  },
  {
    title: "Discovery and community activity",
    body: "Hungry may process searches, likes, saves, reviews, posts, comments, follows, reports, messages, taste-preference signals, and uploaded photos or videos to operate the app.",
  },
  {
    title: "Merchant and support details",
    body: "Merchant claim, verification, menu, promotion, team, OCR, support, analytics, crash, and diagnostic information may be processed when those features are used.",
  },
];

const DATA_USES = [
  "Operate sign-in, onboarding, discovery, reviews, social features, recommendations, and merchant tools.",
  "Personalize Home, Discover, Search, and Decide For Me using taste and interaction signals.",
  "Process account deletion, privacy, access, correction, and support requests.",
  "Detect abuse, enforce moderation, secure the service, and diagnose crashes or reliability issues.",
];

const DATA_PRACTICES = [
  {
    title: "No sale of personal information",
    body: "Hungry does not sell or rent the contact details collected through the marketing site.",
  },
  {
    title: "Limited sharing",
    body: "Information may be shared only when necessary to operate the site, comply with law, or protect the service and the people using it.",
  },
  {
    title: "Retention and updates",
    body: "Waitlist and contact details are kept only while they remain useful for the launch process or related communications. You can ask for deletion or correction at any time. Account deletion is scheduled 30 days after a confirmed request. Signing in does not cancel deletion: choose Keep my account in the app before the deadline and wait for successful cancellation confirmation.",
  },
];

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Plain-language privacy notice for the Hungry marketing website and waitlist, covering what is collected today and how it is used.",
};

export default function PrivacyPage() {
  return (
    <MarketingStaticPage
      pageName="Privacy"
      eyebrow="Privacy"
      title="Privacy policy for Hungry."
      intro="This page covers Hungry's public website, mobile app, and merchant tools. It explains what information Hungry collects, how it is used, and how to request deletion, access, or correction."
      summaryTitle="Scope"
      summary="This notice applies to Hungry surfaces that link to this policy, including app accounts, discovery, reviews, posts, comments, messages, merchant tools, OCR/AI-assisted workflows, analytics, and support requests."
      heroLinks={[
        {
          href: "/about",
          label: "About Hungry",
          description: "Read the product mission and dish-first thesis.",
        },
        {
          href: "/for-merchants",
          label: "For merchants",
          description: "See how Hungry is thinking about hawker and merchant discovery.",
        },
        {
          href: "mailto:usehungrysingapore@gmail.com",
          label: "Contact",
          description: "Email usehungrysingapore@gmail.com for privacy, deletion, access, correction, or safety requests.",
        },
      ]}
      cta={{
        title: "Need something updated or removed?",
        body: "Use the in-app Delete account flow from Settings, visit the account deletion page, or email Hungry if you need help with privacy, access, correction, or deletion.",
        primaryHref: "mailto:usehungrysingapore@gmail.com",
        primaryLabel: "Email usehungrysingapore@gmail.com",
        secondaryHref: "/account/delete",
        secondaryLabel: "Delete account help",
        note: "Last updated: May 18, 2026.",
      }}
    >
      <PageSection
        eyebrow="Coverage"
        title="What this notice covers right now."
            description="Hungry processes data for the public website, app accounts, discovery, reviews, community features, merchant tools, and store-compliance support."
        tone="soft"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <article className="rounded-[28px] border border-hungry-border bg-white p-6">
            <h3 className="font-display text-2xl font-bold text-hungry-navy">Included in scope</h3>
            <p className="mt-3 text-sm leading-7 text-hungry-text-secondary">
              Account, profile, discovery, recommendation, community, merchant, analytics,
              diagnostics, support, deletion, and safety workflows.
            </p>
          </article>
          <article className="rounded-[28px] border border-hungry-border bg-white p-6">
            <h3 className="font-display text-2xl font-bold text-hungry-navy">
              Outside current scope
            </h3>
            <p className="mt-3 text-sm leading-7 text-hungry-text-secondary">
              Data that belongs entirely to third-party services outside Hungry, except where those
              providers process data for Hungry features.
            </p>
          </article>
        </div>
      </PageSection>

      <PageSection
        eyebrow="Collected information"
        title="What Hungry collects through the site."
        description="The site keeps data collection narrow and tied to the waitlist or direct communication."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {COLLECTED_DATA.map((item) => (
            <article
              key={item.title}
              className="rounded-[28px] border border-hungry-border bg-white p-6 shadow-[0_18px_40px_-36px_rgba(26,46,68,0.75)]"
            >
              <h3 className="font-display text-2xl font-bold text-hungry-navy">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-hungry-text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </PageSection>

      <PageSection
        eyebrow="Use of information"
        title="How that information is used."
        description="Hungry uses collected information only for the practical work of operating the launch site and staying in touch about relevant updates."
      >
        <div className="rounded-[28px] border border-hungry-border bg-hungry-bg-soft/50 p-6 md:p-8">
          <ul className="grid gap-4 md:grid-cols-2">
            {DATA_USES.map((item) => (
              <li
                key={item}
                className="rounded-[24px] border border-hungry-border bg-white px-5 py-4 text-sm leading-7 text-hungry-text-secondary"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </PageSection>

      <PageSection
        eyebrow="Sharing and retention"
        title="How Hungry handles data after collection."
        description="The goal is to keep handling restrained, understandable, and proportional to a pre-launch marketing site."
      >
        <div className="grid gap-5 lg:grid-cols-3">
          {DATA_PRACTICES.map((item) => (
            <article
              key={item.title}
              className="rounded-[28px] border border-hungry-border bg-white p-6"
            >
              <h3 className="font-display text-2xl font-bold text-hungry-navy">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-hungry-text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </PageSection>
    </MarketingStaticPage>
  );
}
