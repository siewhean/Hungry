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
        className={`relative mx-auto flex ${siteLayout.navHeight} ${siteLayout.maxWidth} items-center justify-between ${siteLayout.xPadding}`}
      >
        <Link
          aria-label="Hungry home"
          className="text-2xl font-extrabold tracking-tight text-hungry-orange transition-colors hover:text-hungry-orange-dark md:text-3xl"
          href={siteBrand.href}
        >
          {siteBrand.label}
        </Link>

        <div
          className={`absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:flex ${siteLayout.navGap} items-center text-lg font-semibold text-stone-600`}
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

        <div className="flex items-center justify-end">
          <Link
            className="hidden rounded-[18px] bg-hungry-orange px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-hungry-orange-dark md:inline-flex"
            href={waitlistLink.href}
          >
            {waitlistLink.label}
          </Link>

          <details className="relative md:hidden">
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
      </div>
    </nav>
  );
}
