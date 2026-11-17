import { PhonePreview } from "./PhonePreview";
import { SectionEyebrow } from "./SectionEyebrow";

const STEPS = [
  {
    num: "01",
    title: "Search the dish you want",
    body: "Start with the food, not the venue.",
    preview: (
      <div className="space-y-3">
        <div className="rounded-2xl bg-hungry-bg-soft px-3 py-2 text-xs text-hungry-text-muted">
          Search: chicken rice
        </div>
        {["Roasted chicken rice", "Steamed chicken rice", "Value lunch set"].map((line) => (
          <div
            key={line}
            className="rounded-2xl border border-hungry-border px-3 py-2.5 text-sm text-hungry-text-secondary"
          >
            {line}
          </div>
        ))}
      </div>
    ),
  },
  {
    num: "02",
    title: "Compare the best nearby options",
    body: "See dish details, ratings, taste tags, and stall context side by side.",
    preview: (
      <div className="space-y-3">
        {[
          "4.8 · fragrant rice · 420 m",
          "4.7 · best roast skin · unit #02-11",
          "4.6 · shorter queue · open now",
        ].map((line) => (
          <div
            key={line}
            className="rounded-2xl border border-hungry-border px-3 py-3 text-sm text-hungry-text-secondary"
          >
            {line}
          </div>
        ))}
      </div>
    ),
  },
  {
    num: "03",
    title: "Go straight to the right stall",
    body: "Get the floor, unit, and local context you need to order with more confidence.",
    preview: (
      <div className="space-y-4">
        <div className="rounded-[24px] border border-hungry-border bg-hungry-bg-soft px-4 py-5">
          <p className="text-sm font-semibold text-hungry-navy">Maxwell Food Centre</p>
          <p className="mt-2 text-xs text-hungry-text-muted">
            Unit #01-18 · 6 min walk · open until 8:30 PM
          </p>
        </div>
      </div>
    ),
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-hungry-bg-soft py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionEyebrow>How Hungry works</SectionEyebrow>
          <h2 className="mt-5 text-4xl font-extrabold tracking-[-0.05em] text-hungry-navy md:text-5xl">
            Built for the way people actually decide what to eat.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-hungry-text-secondary">
            Search, compare, then head straight to the right stall with context that makes
            hawker-centre discovery easier.
          </p>
        </div>

        <div className="space-y-6">
          {STEPS.map((step) => (
            <article
              key={step.num}
              className="grid gap-5 rounded-[32px] border border-hungry-border bg-white p-5 shadow-[0_30px_70px_-58px_rgba(26,46,68,0.34)] md:grid-cols-[72px_minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-start md:p-6"
            >
              <div>
                <span className="font-mono text-sm text-hungry-orange">{step.num}</span>
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-[-0.03em] text-hungry-navy">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-hungry-text-secondary">{step.body}</p>
              </div>
              <PhonePreview title={step.title} eyebrow="Step proof">
                {step.preview}
              </PhonePreview>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
