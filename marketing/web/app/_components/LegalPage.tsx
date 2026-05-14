import type { ReactNode } from "react";

import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

type LegalSection = {
  title: string;
  body: ReactNode;
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
};

export function LegalPage({ eyebrow, title, intro, lastUpdated, sections }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[#FFF7EE] text-hungry-text">
      <SiteHeader />
      <section className="border-b border-hungry-border bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-hungry-orange">
            {eyebrow}
          </p>
          <div className="mt-5 max-w-4xl space-y-6">
            <h1 className="font-display text-4xl font-extrabold leading-tight text-hungry-text md:text-6xl">
              {title}
            </h1>
            <p className="text-xl leading-9 text-stone-600">{intro}</p>
            <p className="text-base font-semibold text-stone-500">Last updated: {lastUpdated}</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2">
          {sections.map((section) => (
            <article
              className="rounded-[24px] border border-hungry-border bg-white p-7 shadow-[0_18px_50px_-44px_rgba(26,46,68,0.65)]"
              key={section.title}
            >
              <h2 className="font-display text-2xl font-extrabold text-hungry-text">
                {section.title}
              </h2>
              <div className="mt-4 text-lg leading-8 text-stone-600">{section.body}</div>
            </article>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-[28px] border border-hungry-border bg-white p-8 text-center md:p-12">
          <h2 className="font-display text-3xl font-extrabold text-hungry-text">
            Need something updated?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-stone-600">
            Email Hungry if you want to review, correct, or delete waitlist information associated
            with you, or if you have a question about these terms.
          </p>
          <a
            className="mt-8 inline-flex rounded-[18px] bg-hungry-orange px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-hungry-orange-dark"
            href="mailto:hello@hungry.sg"
          >
            Email hello@hungry.sg
          </a>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
