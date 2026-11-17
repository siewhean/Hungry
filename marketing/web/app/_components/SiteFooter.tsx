import Link from "next/link";

import { footerBrand, footerSections, isExternalFooterHref, siteLayout } from "./footerData";
import { HungryWordmark } from "../../components/HungryWordmark";

type SiteFooterProps = {
  className?: string;
};

export function SiteFooter({ className = "" }: SiteFooterProps) {
  return (
    <footer
      className={`w-full border-t border-hungry-border bg-white ${siteLayout.footerPadding} ${className}`}
    >
      <div
        className={`mx-auto grid ${siteLayout.maxWidth} grid-cols-1 gap-8 ${siteLayout.xPadding} md:grid-cols-4`}
      >
        <div className="space-y-3">
          <Link
            className={`inline-flex items-center ${siteLayout.footerBrandText}`}
            href={footerBrand.href}
          >
            <HungryWordmark />
          </Link>
          <p className={`max-w-xs ${siteLayout.footerBodyText} text-stone-500`}>
            {footerBrand.copy}
          </p>
        </div>
        {footerSections.map((section) => (
          <div className="space-y-3" key={section.title}>
            <h2 className={`${siteLayout.footerTitleText} font-extrabold text-hungry-text`}>
              {section.title}
            </h2>
            {section.links.map((link) =>
              isExternalFooterHref(link.href) ? (
                <a
                  className={`block ${siteLayout.footerBodyText} text-stone-500 hover:text-hungry-orange`}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  className={`block ${siteLayout.footerBodyText} text-stone-500 hover:text-hungry-orange`}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ),
            )}
          </div>
        ))}
      </div>
    </footer>
  );
}
