import Image from "next/image";

import { PhonePreview } from "./PhonePreview";
import { SectionEyebrow } from "./SectionEyebrow";
import { SITE_MEDIA } from "./siteMedia";

export function PreviewSection() {
  return (
    <section className="bg-hungry-bg-soft py-24">
      <div className="mx-auto max-w-7xl px-5">
        <div className="max-w-2xl">
          <SectionEyebrow>Product preview</SectionEyebrow>
          <h2 className="mt-5 text-4xl font-extrabold tracking-[-0.05em] text-hungry-navy md:text-5xl">
            What you can expect
          </h2>
        </div>

        <div className="mt-14 grid auto-rows-[minmax(180px,auto)] gap-4 lg:grid-cols-12">
          <PhonePreview
            title="Dish-first search"
            eyebrow="Search"
            className="lg:col-span-7 lg:row-span-2"
            bodyClassName="space-y-3"
          >
            <div className="grid gap-3 md:grid-cols-2">
              {[
                "Laksa · 420 m · best fit",
                "Fish soup · unit #02-14",
                "Satay · open now",
                "Chicken rice · under S$7",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-hungry-border px-3 py-3 text-sm text-hungry-text-secondary"
                >
                  {item}
                </div>
              ))}
            </div>
          </PhonePreview>

          <div className="overflow-hidden rounded-[32px] border border-hungry-border bg-white editorial-shadow lg:col-span-5 lg:row-span-2">
            <Image
              src={SITE_MEDIA.bowl}
              alt="Close-up of plated food arranged for sharing"
              width={1200}
              height={1400}
              sizes="(max-width: 1024px) 100vw, 35vw"
              className="h-full min-h-[22rem] w-full object-cover"
            />
          </div>

          <PhonePreview title="Taste profile" eyebrow="Profile" className="lg:col-span-4">
            <div className="space-y-3">
              {[
                ["Spicy", "80%"],
                ["Salty", "68%"],
                ["Aromatic", "74%"],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="mb-2 flex justify-between text-xs text-hungry-text-muted">
                    <span>{label}</span>
                    <span className="font-mono">{value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-hungry-bg-soft">
                    <div className="h-2 rounded-full bg-hungry-orange" style={{ width: value }} />
                  </div>
                </div>
              ))}
            </div>
          </PhonePreview>

          <PhonePreview title="Hawker clarity" eyebrow="Stall detail" className="lg:col-span-4">
            <div className="rounded-[24px] border border-hungry-border bg-hungry-bg-soft px-4 py-4">
              <p className="text-sm font-semibold text-hungry-navy">Golden Mile Food Centre</p>
              <p className="mt-2 text-xs text-hungry-text-muted">
                Floor 2 · Unit #02-31 · open until 9:00 PM
              </p>
            </div>
          </PhonePreview>

          <PhonePreview title="Stall detail and reviews" eyebrow="Proof" className="lg:col-span-4">
            <div className="space-y-3">
              <div className="rounded-2xl border border-hungry-border px-3 py-3">
                <p className="text-sm font-semibold text-hungry-navy">4.8 average rating</p>
                <p className="mt-1 text-xs text-hungry-text-muted">
                  Rich broth · short queue · worth the walk
                </p>
              </div>
              <div className="rounded-2xl border border-hungry-border px-3 py-3">
                <p className="text-sm font-semibold text-hungry-navy">Reviews tied to the dish</p>
                <p className="mt-1 text-xs text-hungry-text-muted">
                  Useful before you walk over or order
                </p>
              </div>
            </div>
          </PhonePreview>

          <PhonePreview
            title="Reads that lead somewhere"
            eyebrow="Reads"
            className="lg:col-span-7"
            bodyClassName="grid gap-4 md:grid-cols-[0.95fr_1.05fr]"
          >
            <div className="space-y-2">
              <p className="text-sm font-semibold text-hungry-navy">
                Food stories and editorial content that connect back to real discovery.
              </p>
              <p className="text-sm leading-6 text-hungry-text-secondary">
                Reads stay useful by feeding back into dishes, stalls, and nearby decisions.
              </p>
            </div>
            <div className="overflow-hidden rounded-[22px] border border-hungry-border">
              <Image
                src={SITE_MEDIA.salad}
                alt="Fresh dish photographed for editorial coverage"
                width={1200}
                height={900}
                sizes="(max-width: 768px) 100vw, 22vw"
                className="h-full min-h-[11rem] w-full object-cover"
              />
            </div>
          </PhonePreview>
        </div>
      </div>
    </section>
  );
}
