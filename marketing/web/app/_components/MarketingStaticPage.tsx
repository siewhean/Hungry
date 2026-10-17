import type { ReactNode } from "react";
import Link from "next/link";

import { Navbar } from "../../components/Navbar";
import { HungryWordmark } from "../../components/HungryWordmark";
import { WaitlistForm } from "../../components/WaitlistForm";

type StaticPageLink = {
  href: string;
  label: string;
  description: string;
};

type StaticPageCta = {
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  note?: string;
  formMode?: "consumer" | "hawker";
};

type MarketingStaticPageProps = {
  pageName: string;
  eyebrow: string;
  title: string;
  intro: string;
  summaryTitle: string;
  summary: string;
  heroLinks: StaticPageLink[];
  cta: StaticPageCta;
  children: ReactNode;
};

type PageSectionProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
  tone?: "plain" | "soft";
};

const FOOTER_LINKS: StaticPageLink[] = [
  {
    href: "/",
    label: "Home",
    description: "Return to the main waitlist page.",
  },
  {
    href: "/for-merchants",
    label: "For merchants",
    description: "Merchant and hawker-facing overview.",
  },
  {
    href: "/about",
    label: "About",
    description: "Mission and product thesis.",
  },
  {
    href: "/privacy",
    label: "Privacy",
    description: "Marketing-site privacy notice.",
  },
];

function isExternalHref(href: string) {
  return href.startsWith("mailto:") || href.startsWith("http://") || href.startsWith("https://");
}

function TextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  if (isExternalHref(href) || href.startsWith("#")) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

function ActionLink({
  href,
  label,
  tone = "primary",
}: {
  href: string;
  label: string;
  tone?: "primary" | "secondary";
}) {
  const className =
    tone === "primary"
      ? "inline-flex items-center justify-center rounded-pill bg-hungry-orange px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-hungry-orange-dark"
      : "inline-flex items-center justify-center rounded-pill border border-hungry-border px-5 py-3 text-sm font-bold text-hungry-text transition-colors hover:border-hungry-orange hover:text-hungry-orange";

  return (
    <TextLink className={className} href={href}>
      {label}
    </TextLink>
  );
}

export function MarketingStaticPage({
  pageName,
  eyebrow,
  title,
  intro,
  summaryTitle,
  summary,
  heroLinks,
  cta,
  children,
}: MarketingStaticPageProps) {
  return (
    <main className="min-h-screen bg-hungry-bg text-hungry-text">
      <Navbar />

      <section className="border-b border-hungry-border/80 bg-white">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-24 md:pb-20 md:pt-32">
          <div className="mb-8 flex flex-wrap items-center gap-3 text-xs font-mono uppercase tracking-[0.18em] text-hungry-text-muted">
            <Link className="inline-flex items-center" href="/">
              <HungryWordmark />
            </Link>
            <span className="h-px w-6 bg-hungry-border" />
            <span>{pageName}</span>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.9fr)] lg:items-start">
            <div className="space-y-6">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-hungry-orange">
                {eyebrow}
              </p>
              <div className="max-w-3xl space-y-5">
                <h1 className="font-display text-4xl font-black leading-tight text-hungry-navy md:text-6xl">
                  {title}
                </h1>
                <p className="max-w-2xl text-base leading-8 text-hungry-text-secondary md:text-lg">
                  {intro}
                </p>
              </div>
            </div>

            <aside className="rounded-[28px] border border-hungry-border bg-hungry-bg-soft p-6 shadow-[0_18px_50px_-38px_rgba(26,46,68,0.55)]">
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-xs font-mono uppercase tracking-[0.18em] text-hungry-text-muted">
                    {summaryTitle}
                  </p>
                  <p className="text-sm leading-7 text-hungry-text-secondary">{summary}</p>
                </div>

                <div className="space-y-3 border-t border-hungry-border pt-5">
                  <p className="text-xs font-mono uppercase tracking-[0.18em] text-hungry-text-muted">
                    Linked routes
                  </p>
                  <div className="space-y-3">
                    {heroLinks.map((link) => (
                      <TextLink
                        key={link.href}
                        className="group block rounded-3xl border border-transparent bg-white px-4 py-4 transition-colors hover:border-hungry-border"
                        href={link.href}
                      >
                        <span className="block text-sm font-bold text-hungry-navy transition-colors group-hover:text-hungry-orange">
                          {link.label}
                        </span>
                        <span className="mt-1 block text-sm leading-6 text-hungry-text-secondary">
                          {link.description}
                        </span>
                      </TextLink>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="space-y-16 md:space-y-20">{children}</div>
      </div>

      <section
        id="waitlist"
        className="border-y border-hungry-border bg-[linear-gradient(180deg,#fff7ee_0%,#ffffff_100%)]"
      >
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="rounded-[32px] border border-hungry-border bg-white p-8 shadow-[0_20px_60px_-44px_rgba(26,46,68,0.65)] md:p-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)] lg:items-end">
              <div className="space-y-4">
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-hungry-orange">
                  Next step
                </p>
                <h2 className="font-display text-3xl font-bold leading-tight text-hungry-navy md:text-4xl">
                  {cta.title}
                </h2>
                <p className="max-w-2xl text-base leading-8 text-hungry-text-secondary">
                  {cta.body}
                </p>
                {cta.note ? (
                  <p className="text-sm leading-7 text-hungry-text-muted">{cta.note}</p>
                ) : null}
              </div>

              {cta.formMode ? (
                <div className="max-w-md space-y-3">
                  <WaitlistForm mode={cta.formMode} />
                  {cta.secondaryHref && cta.secondaryLabel ? (
                    <ActionLink
                      href={cta.secondaryHref}
                      label={cta.secondaryLabel}
                      tone="secondary"
                    />
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <ActionLink href={cta.primaryHref} label={cta.primaryLabel} />
                  {cta.secondaryHref && cta.secondaryLabel ? (
                    <ActionLink
                      href={cta.secondaryHref}
                      label={cta.secondaryLabel}
                      tone="secondary"
                    />
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Link className="inline-flex items-center" href="/">
                <HungryWordmark />
              </Link>
              <span className="h-2 w-2 rounded-full bg-hungry-orange" />
            </div>
            <p className="max-w-md text-sm leading-7 text-hungry-text-secondary">
              Dish-first food discovery for Singapore. Practical product pages, no filler.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {FOOTER_LINKS.map((link) => (
              <TextLink
                key={link.href}
                className="rounded-3xl border border-hungry-border px-4 py-3 transition-colors hover:border-hungry-orange"
                href={link.href}
              >
                <span className="block text-sm font-bold text-hungry-navy">{link.label}</span>
                <span className="mt-1 block text-sm leading-6 text-hungry-text-secondary">
                  {link.description}
                </span>
              </TextLink>
            ))}
            <TextLink
              className="rounded-3xl border border-hungry-border px-4 py-3 transition-colors hover:border-hungry-orange"
              href="mailto:usehungrysingapore@gmail.com"
            >
              <span className="block text-sm font-bold text-hungry-navy">Contact</span>
              <span className="mt-1 block text-sm leading-6 text-hungry-text-secondary">
                usehungrysingapore@gmail.com
              </span>
            </TextLink>
          </div>
        </div>
      </footer>
    </main>
  );
}

export function PageSection({
  eyebrow,
  title,
  description,
  children,
  id,
  tone = "plain",
}: PageSectionProps) {
  const sectionClassName =
    tone === "soft"
      ? "rounded-[32px] border border-hungry-border bg-hungry-bg-soft/70 p-8 md:p-10"
      : "";

  return (
    <section className={sectionClassName} id={id}>
      <div className="max-w-3xl space-y-4">
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-hungry-orange">
          {eyebrow}
        </p>
        <h2 className="font-display text-3xl font-bold leading-tight text-hungry-navy md:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="text-base leading-8 text-hungry-text-secondary">{description}</p>
        ) : null}
      </div>
      <div className="mt-8 md:mt-10">{children}</div>
    </section>
  );
}
