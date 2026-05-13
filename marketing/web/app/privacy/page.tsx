import type { Metadata } from "next";

import { MarketingStaticPage, PageSection } from "../_components/MarketingStaticPage";

const COLLECTED_DATA = [
  {
    title: "Waitlist details",
    body: "If you use the waitlist form, Hungry collects your email address, your optional first name, and whether you joined as a diner, hawker, or both.",
  },
  {
    title: "Direct contact messages",
    body: "If you email Hungry directly, we receive whatever information you include in that message so we can reply or continue the conversation.",
  },
];

const DATA_USES = [
  "Operate the waitlist and prevent duplicate entries.",
  "Send launch updates, early-access notes, or relevant follow-up for the category you selected.",
  "Respond to inbound questions or merchant-interest messages.",
  "Maintain and secure the marketing site.",
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
    body: "Waitlist and contact details are kept only while they remain useful for the launch process or related communications. You can ask for deletion or correction at any time.",
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
      title="A short privacy notice for the Hungry marketing site."
      intro="This page covers the Hungry marketing website and the waitlist flow that exists today. It is meant to explain, in plain language, what information the site collects, what it is used for, and how to contact us if you want it updated or removed."
      summaryTitle="Scope"
      summary="This notice applies to the current marketing site and waitlist only. If the consumer app launches with additional data features later, that product experience may require a separate notice."
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
          href: "mailto:hello@hungry.sg",
          label: "Contact",
          description: "Email hello@hungry.sg for privacy, waitlist, or removal requests.",
        },
      ]}
      cta={{
        title: "Need something updated or removed?",
        body: "Email Hungry if you want to review, correct, or delete waitlist information associated with you, or if you have a question about this notice.",
        primaryHref: "mailto:hello@hungry.sg",
        primaryLabel: "Email hello@hungry.sg",
        secondaryHref: "/about",
        secondaryLabel: "Read about Hungry",
        note: "Last updated: April 23, 2026.",
      }}
    >
      <PageSection
        eyebrow="Coverage"
        title="What this notice covers right now."
        description="The current marketing site is a simple public surface for the Hungry story and waitlist. It is not the full consumer app, merchant portal, or ordering product."
        tone="soft"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <article className="rounded-[28px] border border-hungry-border bg-white p-6">
            <h3 className="font-display text-2xl font-bold text-hungry-navy">Included in scope</h3>
            <p className="mt-3 text-sm leading-7 text-hungry-text-secondary">
              Public marketing pages, the waitlist form, and direct email contact related to the
              launch site.
            </p>
          </article>
          <article className="rounded-[28px] border border-hungry-border bg-white p-6">
            <h3 className="font-display text-2xl font-bold text-hungry-navy">
              Outside current scope
            </h3>
            <p className="mt-3 text-sm leading-7 text-hungry-text-secondary">
              Future app accounts, ordering, merchant dashboards, or other product features that are
              not live on this marketing site today.
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
