import type { Metadata } from "next";

import { MarketingStaticPage, PageSection } from "../_components/MarketingStaticPage";

const DISCOVERY_GAPS = [
  {
    title: "People search by dish, not only by stall name",
    body: "A diner may know they want laksa or satay without knowing which stall serves the best nearby option. Venue-first products hide that demand from smaller operators.",
  },
  {
    title: "Foot traffic is uneven and often accidental",
    body: "Many stalls still rely on walk-bys, regulars, or word of mouth even when people nearby are actively craving the exact dish they sell.",
  },
  {
    title: "Content alone does not create reliable discovery",
    body: "Social posts can drive bursts of attention, but they do not consistently answer practical questions like which unit to walk to, what the stall serves, or whether it is open.",
  },
];

const MERCHANT_VALUE = [
  {
    label: "Core discovery",
    title: "Show the dish before the brand recognition",
    body: "Hungry is designed to let a dish surface first, so a smaller stall can be discovered by what it actually cooks rather than only by name recognition.",
  },
  {
    label: "Local clarity",
    title: "Keep the stall context useful",
    body: "Floor, unit, hours, hygiene grade, and delivery support matter because they reduce friction after someone decides what they want.",
  },
  {
    label: "Roadmap work",
    title: "Roll merchant tools out in a practical order",
    body: "The immediate goal is interest capture and better discovery. Claim flows, verification, and richer menu controls are planned next, not presented as live today.",
  },
];

const MERCHANT_PATH = [
  {
    step: "01",
    title: "Register interest now",
    body: "Today, the merchant path is a low-friction interest list for hawkers and small operators who want to stay close to the rollout.",
  },
  {
    step: "02",
    title: "Confirm the right stall later",
    body: "The roadmap points to a Singapore-specific verification flow: UEN holders through SingPass Myinfo Business, hawker stalls through NEA licence checks, and video walkarounds for edge cases.",
  },
  {
    step: "03",
    title: "Open menu and visibility tooling after pilot",
    body: "Menu clarity, claim handling, and merchant controls follow once the demand side and stall-interest base are warm enough to support them properly.",
  },
];

export const metadata: Metadata = {
  title: "For Merchants",
  description:
    "Hungry is building a dish-first discovery surface for Singapore hawkers and small food operators, starting with low-friction interest capture and practical stall visibility.",
};

export default function ForMerchantsPage() {
  return (
    <MarketingStaticPage
      pageName="For merchants"
      eyebrow="For hawkers and merchants"
      title="Get discovered by the dish people are already craving."
      intro="Hungry is being built around a simple idea: diners usually know the food they want before they know the stall name. That creates a better discovery opportunity for hawkers and smaller operators if the product starts from the dish instead of a venue directory."
      summaryTitle="What this page covers"
      summary="This page explains the merchant-side problem, the visibility thesis behind Hungry, and which parts of the merchant workflow are still roadmap work."
      heroLinks={[
        {
          href: "/about",
          label: "About Hungry",
          description: "Read the consumer-side mission and why dish-first matters.",
        },
        {
          href: "/privacy",
          label: "Privacy",
          description: "See the marketing-site privacy notice before sharing interest details.",
        },
        {
          href: "/#waitlist",
          label: "Main waitlist",
          description: "Return to the homepage for the diner waitlist and product overview.",
        },
      ]}
      cta={{
        title: "Want to stay in the loop as merchant tools take shape?",
        body: "Register hawker or merchant interest if you want updates when there is a concrete pilot, claim flow, or visibility tool worth reviewing.",
        primaryHref: "/for-merchants#waitlist",
        primaryLabel: "Register hawker interest",
        secondaryHref: "/about",
        secondaryLabel: "Read the mission",
        note: "The current website is collecting interest only. Merchant verification, claim workflows, and menu tooling are roadmap work, not live features.",
        formMode: "hawker",
      }}
    >
      <PageSection
        eyebrow="Why this matters"
        title="Smaller stalls still get overlooked for structural reasons."
        description="The problem is not only food quality or social reach. It is that many digital surfaces still make the diner browse the venue first, which hides dish-level demand that smaller operators could capture."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {DISCOVERY_GAPS.map((item) => (
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
        eyebrow="Merchant thesis"
        title="Hungry is trying to make local stall discovery more useful, not more performative."
        description="The merchant-side value is grounded in clearer discovery and better context. The goal is not to turn every stall into a content machine."
        tone="soft"
      >
        <div className="grid gap-5 lg:grid-cols-3">
          {MERCHANT_VALUE.map((item) => (
            <article
              key={item.title}
              className="rounded-[28px] border border-hungry-border bg-white p-6"
            >
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-hungry-text-muted">
                {item.label}
              </p>
              <h3 className="mt-3 font-display text-2xl font-bold text-hungry-navy">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-hungry-text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </PageSection>

      <PageSection
        eyebrow="Rollout path"
        title="The merchant route is intentionally staged."
        description="The roadmap is explicit about sequencing. Consumer demand and passive supply priming come first, then verification and merchant tooling follow once there is enough demand-side proof to make that investment worthwhile."
      >
        <div className="grid gap-5 lg:grid-cols-3">
          {MERCHANT_PATH.map((item) => (
            <article
              key={item.step}
              className="rounded-[28px] border border-hungry-border bg-hungry-bg-soft/50 p-6"
            >
              <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-hungry-orange">
                Step {item.step}
              </p>
              <h3 className="mt-3 font-display text-2xl font-bold text-hungry-navy">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-hungry-text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </PageSection>
    </MarketingStaticPage>
  );
}
