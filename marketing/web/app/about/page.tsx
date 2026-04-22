import type { Metadata } from "next";

import { MarketingStaticPage, PageSection } from "../_components/MarketingStaticPage";

const PRINCIPLES = [
  {
    title: "Start with the craving",
    body: "Most people know the dish they want before they know which venue to open. Hungry is built around that reality.",
  },
  {
    title: "Reduce decision drag",
    body: "The job is to get someone from indecision to a confident nearby choice faster, not to turn lunch into another browsing session.",
  },
  {
    title: "Keep the answer local",
    body: "Hawker centres, food courts, floors, unit numbers, and local food language are part of the product, not edge cases around it.",
  },
];

const SINGAPORE_CONTEXT = [
  {
    title: "Dense food spaces need clearer context",
    body: "A hawker centre or food court can contain many stalls serving overlapping dishes. Floor and unit context matters when someone is already hungry.",
  },
  {
    title: "Discovery should lead to action",
    body: "Reads, reviews, and recommendations should help someone decide where to walk, queue, or order next. They should not end as disconnected inspiration.",
  },
  {
    title: "Taste is part of the decision",
    body: "People do not just search by cuisine. They often care whether something is rich, spicy, comforting, or bright enough for the exact mood they are in.",
  },
];

const PRODUCT_DIRECTION = [
  {
    title: "Dish-first search",
    body: "Search for laksa, satay, fish soup, curry rice, and other specific cravings instead of working backwards from a list of venues.",
  },
  {
    title: "Nearby comparison with stall context",
    body: "Compare options with ratings, taste cues, and the hawker-centre details that make the choice easier in practice.",
  },
  {
    title: "Utility-first editorial bridges",
    body: "Food stories and recommendations should connect back to real stalls and dishes so they remain useful after the first read.",
  },
];

export const metadata: Metadata = {
  title: "About",
  description:
    "Hungry is building a dish-first way to decide what to eat in Singapore, with clearer hawker-centre context and less time spent browsing venue lists.",
};

export default function AboutPage() {
  return (
    <MarketingStaticPage
      pageName="About"
      eyebrow="About Hungry"
      title="Hungry exists to make everyday food decisions easier in Singapore."
      intro="We are building a dish-first product because most food tools still begin with the wrong object. When people are deciding lunch or dinner, they usually start with the dish they want to eat. Hungry is designed to turn that craving into a more confident nearby choice, especially in hawker centres and food courts where context matters."
      summaryTitle="What guides the mission"
      summary="Dish-first discovery, local usefulness, and practical decision relief sit above everything else. This page covers the product thesis only."
      heroLinks={[
        {
          href: "/for-merchants",
          label: "For merchants",
          description: "See how the same thesis applies to hawker and small-stall discovery.",
        },
        {
          href: "/privacy",
          label: "Privacy",
          description: "Read the marketing-site privacy notice in plain language.",
        },
        {
          href: "/#waitlist",
          label: "Join the waitlist",
          description: "Go to the homepage waitlist form for early-access updates.",
        },
      ]}
      cta={{
        title: "Want early access when Hungry opens up?",
        body: "Join the waitlist if you want launch updates, product previews, and a clearer way to decide what to eat nearby.",
        primaryHref: "/#waitlist",
        primaryLabel: "Join the waitlist",
        secondaryHref: "/for-merchants",
        secondaryLabel: "For merchants",
        formMode: "consumer",
      }}
    >
      <PageSection
        eyebrow="Mission"
        title="We are fixing the wrong starting point."
        description="Most food products are still organized around the venue first. That structure forces people to bounce between restaurant lists, map pins, and menus when they already know what they feel like eating."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {PRINCIPLES.map((item) => (
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
        eyebrow="Singapore context"
        title="The product has to fit how Singapore food decisions actually work."
        description="Hungry is not trying to be a generic global food directory. The product is being shaped around local food habits, dense dining environments, and the small details that help someone move from craving to order."
        tone="soft"
      >
        <div className="grid gap-5 lg:grid-cols-3">
          {SINGAPORE_CONTEXT.map((item) => (
            <article
              key={item.title}
              className="rounded-[28px] border border-hungry-border bg-white p-6"
            >
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-hungry-text-muted">
                Singapore-first
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
        eyebrow="Product direction"
        title="The mission stays utility-first."
        description="Hungry should feel like a knowledgeable local guide in your pocket. Discovery, taste fit, and content all need to point toward a more useful next action."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {PRODUCT_DIRECTION.map((item) => (
            <article
              key={item.title}
              className="rounded-[28px] border border-hungry-border bg-hungry-bg-soft/50 p-6"
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
