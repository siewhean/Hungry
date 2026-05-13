"use client";

import { useState } from "react";

import { SectionEyebrow } from "./SectionEyebrow";

const FAQS = [
  {
    q: "Is Hungry live yet?",
    a: "Not publicly. The current focus is building the launch waitlist and shaping early access.",
  },
  {
    q: "Is this only for hawker centres?",
    a: "Hawker centres and food courts are central to the story, but the broader product scope covers local dining discovery across Singapore.",
  },
  {
    q: "What makes Hungry different from Google Maps or GrabFood?",
    a: "Hungry starts with the dish, then helps you choose the right stall with more useful local context.",
  },
  {
    q: "Is this another food content app?",
    a: "No. The product is utility-first. Reads and content support discovery, but the main job is helping you decide what to eat.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="site-section-rule bg-white py-24">
      <div className="mx-auto max-w-4xl px-5">
        <div className="max-w-xl">
          <SectionEyebrow>FAQ</SectionEyebrow>
          <h2 className="mt-5 text-4xl font-extrabold tracking-[-0.05em] text-hungry-navy">
            Frequently asked
          </h2>
        </div>

        <div className="mt-12 border-y border-hungry-border">
          {FAQS.map((faq, i) => (
            <div key={faq.q} className="border-t border-hungry-border first:border-t-0">
              <button
                className="flex w-full items-center justify-between gap-4 px-0 py-6 text-left transition-colors hover:text-hungry-orange"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                id={`faq-q-${i}`}
                aria-controls={`faq-a-${i}`}
              >
                <span className="pr-8 text-base font-semibold text-hungry-navy">{faq.q}</span>
                <span
                  className={`font-mono text-hungry-orange transition-transform duration-200 ${
                    open === i ? "rotate-45" : ""
                  }`}
                >
                  +
                </span>
              </button>
              {open === i ? (
                <div
                  id={`faq-a-${i}`}
                  role="region"
                  aria-labelledby={`faq-q-${i}`}
                  className="pb-6 pr-12 text-sm leading-7 text-hungry-text-secondary animate-fade-in"
                >
                  {faq.a}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
