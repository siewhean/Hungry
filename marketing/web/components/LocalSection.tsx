import Image from "next/image";

import { SectionEyebrow } from "./SectionEyebrow";
import { SITE_MEDIA } from "./siteMedia";

export function LocalSection() {
  return (
    <section className="site-section-rule bg-white py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[minmax(0,0.98fr)_minmax(0,0.92fr)] lg:items-center">
        <div className="overflow-hidden rounded-[36px] border border-hungry-border bg-white editorial-shadow">
          <Image
            src={SITE_MEDIA.counter}
            alt="Table of shared Singapore dishes"
            width={1200}
            height={1200}
            sizes="(max-width: 1024px) 100vw, 48vw"
            className="h-full min-h-[30rem] w-full object-cover"
          />
        </div>

        <div>
          <SectionEyebrow>Why it feels local</SectionEyebrow>
          <h2 className="mt-5 text-4xl font-extrabold tracking-[-0.05em] text-hungry-navy md:text-5xl">
            Made for Singapore, not a generic global food directory.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-hungry-text-secondary">
            Hungry is built around the reality of hawker centres, food courts, local dishes, nearby
            lunch decisions, and the way people in Singapore actually talk about cravings.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["25,000+", "Licensed F&B businesses"],
              ["114", "Hawker centres"],
              ["6,000+", "Stalls across the island"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-[28px] border border-hungry-border bg-hungry-bg-soft px-5 py-5"
              >
                <p className="font-mono text-2xl text-hungry-orange">{value}</p>
                <p className="mt-3 text-sm leading-6 text-hungry-text-secondary">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[28px] border border-hungry-border bg-white px-5 py-5">
            <p className="text-sm leading-7 text-hungry-text-secondary">
              The product is not trying to be another premium restaurant app. It is trying to be
              more useful when you need to makan nearby.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
