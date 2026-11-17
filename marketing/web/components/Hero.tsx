import Image from "next/image";

import { PhonePreview } from "./PhonePreview";
import { SectionEyebrow } from "./SectionEyebrow";
import { SITE_MEDIA } from "./siteMedia";
import { WaitlistForm } from "./WaitlistForm";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-hungry-bg">
      <div className="absolute inset-x-0 top-0 h-[42rem] site-grid opacity-80" aria-hidden="true" />
      <div className="absolute inset-0 site-noise" aria-hidden="true" />

      <div className="relative mx-auto grid min-h-[100svh] max-w-7xl gap-12 px-5 pb-18 pt-30 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:items-center">
        <div className="max-w-xl">
          <SectionEyebrow className="animate-fade-up">
            Singapore dish-first food discovery
          </SectionEyebrow>
          <h1
            className="mt-5 max-w-lg text-5xl font-extrabold tracking-[-0.06em] text-hungry-navy animate-fade-up md:text-7xl"
            style={{ animationDelay: "0.08s" }}
          >
            Find the dish.
            <span className="block text-hungry-orange">Not just the restaurant.</span>
          </h1>
          <p
            className="mt-6 max-w-xl text-lg leading-8 text-hungry-text-secondary animate-fade-up"
            style={{ animationDelay: "0.14s" }}
          >
            Hungry helps you decide what to eat faster by starting with the dish you are craving,
            then guiding you to the right nearby stall, hawker centre, and taste fit.
          </p>
          <p
            className="mt-3 max-w-lg text-sm leading-6 text-hungry-text-muted animate-fade-up"
            style={{ animationDelay: "0.18s" }}
          >
            Built for Singapore hawker centres, food courts, and everyday local cravings.
          </p>

          <div className="mt-8 max-w-lg animate-fade-up" style={{ animationDelay: "0.22s" }}>
            <WaitlistForm id="waitlist" mode="consumer" variant="hero" />
          </div>

          <div
            className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-hungry-text-muted animate-fade-up"
            style={{ animationDelay: "0.28s" }}
          >
            <span>Dish-first search</span>
            <span>Taste-based filtering</span>
            <span>Hawker-centre clarity</span>
          </div>
        </div>

        <div className="relative">
          <div className="grid gap-4 lg:grid-cols-[0.82fr_1.08fr]">
            <div className="order-2 space-y-4 lg:order-1">
              <div className="rounded-[30px] border border-hungry-border bg-hungry-bg-soft p-5 editorial-shadow animate-fade-up">
                <SectionEyebrow>What changes</SectionEyebrow>
                <div className="mt-5 space-y-4">
                  {[
                    "Search by dish, not by venue name",
                    "Compare nearby options side by side",
                    "See the floor and unit before you walk over",
                  ].map((line) => (
                    <div
                      key={line}
                      className="border-t border-hungry-border pt-4 first:border-t-0 first:pt-0"
                    >
                      <p className="text-sm font-semibold text-hungry-navy">{line}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-[30px] border border-hungry-border bg-white editorial-shadow animate-fade-up">
                <Image
                  src={SITE_MEDIA.hawker}
                  alt="Singapore food counter with plated dishes"
                  width={1200}
                  height={900}
                  sizes="(max-width: 1024px) 100vw, 32vw"
                  className="h-[20rem] w-full object-cover"
                />
              </div>
            </div>

            <div className="order-1 space-y-4 lg:order-2 lg:pt-10">
              <PhonePreview
                title="Dish-first search"
                eyebrow="Search"
                meta="Nearby now"
                className="animate-fade-up"
              >
                <div className="rounded-2xl border border-hungry-border bg-hungry-bg-soft px-3 py-2 text-sm text-hungry-text-secondary">
                  Laksa near City Hall
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    {
                      name: "328 Katong Laksa",
                      meta: "4.8 rating · 420 m · S$6.50",
                      tags: "Rich · Fragrant · Fast queue",
                    },
                    {
                      name: "Beach Road Laksa",
                      meta: "4.6 rating · 680 m · S$5.80",
                      tags: "Spicy · Coconut broth · Unit #02-14",
                    },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className="rounded-2xl border border-hungry-border px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-hungry-navy">{item.name}</p>
                          <p className="mt-1 text-xs text-hungry-text-muted">{item.meta}</p>
                        </div>
                        <span className="font-mono text-xs text-hungry-orange">Dish</span>
                      </div>
                      <p className="mt-3 text-xs text-hungry-text-secondary">{item.tags}</p>
                    </div>
                  ))}
                </div>
              </PhonePreview>

              <div className="grid gap-4 md:grid-cols-2">
                <PhonePreview
                  title="Taste fit"
                  eyebrow="Profile"
                  meta="6 axes"
                  className="animate-fade-up"
                  bodyClassName="space-y-3"
                >
                  {[
                    ["Spicy", "84%"],
                    ["Rich", "78%"],
                    ["Aromatic", "71%"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="mb-2 flex items-center justify-between text-xs text-hungry-text-secondary">
                        <span>{label}</span>
                        <span className="font-mono">{value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-hungry-bg-soft">
                        <div
                          className="h-2 rounded-full bg-hungry-orange"
                          style={{ width: value }}
                        />
                      </div>
                    </div>
                  ))}
                </PhonePreview>

                <div className="overflow-hidden rounded-[30px] border border-hungry-border bg-white editorial-shadow animate-fade-up">
                  <Image
                    src={SITE_MEDIA.laksa}
                    alt="Close-up of a bowl of noodles with broth"
                    width={1200}
                    height={900}
                    sizes="(max-width: 768px) 100vw, 22vw"
                    className="h-full min-h-[17rem] w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
