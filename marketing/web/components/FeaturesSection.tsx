import { PhonePreview } from "./PhonePreview";
import { SectionEyebrow } from "./SectionEyebrow";

const FEATURES = [
  {
    title: "Search by dish",
    body: "Find the exact food you want, not just a list of places nearby.",
    preview: (
      <div className="space-y-3">
        <div className="rounded-2xl bg-hungry-bg-soft px-3 py-2 text-xs text-hungry-text-muted">
          Search: fish soup
        </div>
        {["Sliced fish soup", "Batang fish soup", "Bitter gourd fish soup"].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-hungry-border px-3 py-2.5 text-sm text-hungry-text-secondary"
          >
            {item}
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Filter by taste",
    body: "Tune for sweet, spicy, sour, salty, rich, and aromatic when the craving is more specific than the cuisine.",
    preview: (
      <div className="space-y-3">
        {[
          ["Spicy", "80%"],
          ["Sour", "54%"],
          ["Aromatic", "72%"],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="mb-2 flex justify-between text-xs text-hungry-text-muted">
              <span>{label}</span>
              <span className="font-mono">{value}</span>
            </div>
            <div className="h-2 rounded-full bg-hungry-bg-soft">
              <div className="h-2 rounded-full bg-hungry-amber" style={{ width: value }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Decide faster",
    body: "Use Decide For Me when you want one strong nearby answer instead of another ten minutes of indecision.",
    preview: (
      <div className="space-y-3">
        <div className="rounded-[22px] border border-hungry-border bg-hungry-bg-soft px-4 py-4">
          <p className="text-xs font-mono uppercase tracking-[0.18em] text-hungry-text-muted">
            Nearby answer
          </p>
          <p className="mt-3 text-sm font-semibold text-hungry-navy">Char kway teow</p>
          <p className="mt-1 text-xs text-hungry-text-muted">
            420 m away · rich · smoky · unit #01-07
          </p>
        </div>
      </div>
    ),
  },
] as const;

export function FeaturesSection() {
  return (
    <section className="site-section-rule bg-white py-24">
      <div className="mx-auto max-w-7xl px-5">
        <div className="max-w-2xl">
          <SectionEyebrow>Why dish-first matters</SectionEyebrow>
          <h2 className="mt-5 text-4xl font-extrabold tracking-[-0.05em] text-hungry-navy md:text-5xl">
            Start with the craving.
            <span className="block text-hungry-text">Then choose with confidence.</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3 md:divide-x md:divide-hungry-border">
          {FEATURES.map((feature, index) => (
            <div
              key={feature.title}
              className={
                index === 0 ? "md:pr-8" : index === FEATURES.length - 1 ? "md:pl-8" : "md:px-8"
              }
            >
              <h3 className="text-xl font-bold tracking-[-0.03em] text-hungry-navy">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-hungry-text-secondary">{feature.body}</p>
              <PhonePreview
                title={feature.title}
                eyebrow="Preview"
                className="mt-6"
                bodyClassName="space-y-3"
              >
                {feature.preview}
              </PhonePreview>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
