import Link from "next/link";

import { isActiveSiteHref, mainNavLinks, siteBrand, siteLayout, waitlistLink } from "./footerData";

type SiteHeaderProps = {
  activeHref?: string;
  className?: string;
};

export function SiteHeader({ activeHref, className = "" }: SiteHeaderProps) {
  return (
    <nav
      className={`sticky top-0 z-50 border-b border-hungry-border bg-white font-display ${className}`}
    >
      <div
        className={`mx-auto grid ${siteLayout.navHeight} ${siteLayout.maxWidth} grid-cols-[auto_1fr_auto] items-center ${siteLayout.xPadding}`}
      >
        <Link
          aria-label="Hungry home"
          className="justify-self-start text-2xl font-extrabold tracking-tight text-hungry-orange transition-colors hover:text-hungry-orange-dark md:text-3xl"
          href={siteBrand.href}
        >
          {siteBrand.label}
        </Link>

        <div
          className={`hidden justify-self-center md:flex ${siteLayout.navGap} items-center text-lg font-semibold text-stone-600`}
        >
          {mainNavLinks.map((link) => {
            const active = isActiveSiteHref(activeHref, link.href);

            return (
              <Link
                className={`border-b-2 pb-2 transition-colors ${
                  active
                    ? "border-hungry-orange text-hungry-orange"
                    : "border-transparent hover:text-hungry-orange"
                }`}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <Link
          className="hidden justify-self-end rounded-[18px] bg-hungry-orange px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-hungry-orange-dark md:inline-flex"
          href={waitlistLink.href}
        >
          {waitlistLink.label}
        </Link>

        <details className="relative justify-self-end md:hidden">
          <summary className="list-none cursor-pointer text-hungry-orange">
            <span className="sr-only">Open navigation</span>
            <span className="block h-0.5 w-8 bg-current" />
            <span className="mt-1.5 block h-0.5 w-8 bg-current" />
            <span className="mt-1.5 block h-0.5 w-8 bg-current" />
          </summary>
          <div className="absolute right-0 top-10 flex w-64 flex-col items-center gap-4 rounded-[18px] border border-hungry-border bg-white p-5 text-center text-lg font-semibold text-stone-600 shadow-lg">
            {mainNavLinks.map((link) => {
              const active = isActiveSiteHref(activeHref, link.href);

              return (
                <Link
                  className={`border-b-2 pb-1 ${
                    active
                      ? "border-hungry-orange text-hungry-orange"
                      : "border-transparent hover:text-hungry-orange"
                  }`}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              className="mt-1 rounded-[18px] bg-hungry-orange px-5 py-3 font-bold text-white"
              href={waitlistLink.href}
            >
              {waitlistLink.label}
            </Link>
          </div>
        </details>
      </div>
    </nav>
  );
}
