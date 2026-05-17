export const siteBrand = {
  label: "Hungry",
  href: "/for-foodies",
} as const;

export const waitlistLink = {
  href: "/join-waitlist",
  label: "Join Waitlist",
} as const;

export const mainNavLinks = [
  { href: "/for-foodies", label: "For Foodies" },
  { href: "/for-merchants", label: "For Merchants" },
  { href: "/about", label: "About" },
  { href: "/merchant/login", label: "Merchant Portal" },
] as const;

export const siteLayout = {
  maxWidth: "max-w-7xl",
  xPadding: "px-6",
  navHeight: "h-20",
  navGap: "gap-10",
  footerPadding: "py-10",
  footerBrandText: "text-xl",
  footerTitleText: "text-xs",
  footerBodyText: "text-xs leading-5",
} as const;

export const footerBrand = {
  ...siteBrand,
  copy: "© 2026 Hungry Singapore. Your trusted guide to the local makan scene.",
} as const;

export const footerSections = [
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/account/delete", label: "Account Deletion" },
    ],
  },
  {
    title: "Pages",
    links: mainNavLinks,
  },
  {
    title: "Connect",
    links: [
      waitlistLink,
      { href: "/for-merchants", label: "Merchant Support" },
      { href: "mailto:hello@hungry.sg", label: "Contact Us" },
    ],
  },
] as const;

export function isExternalFooterHref(href: string) {
  return href.startsWith("mailto:") || href.startsWith("http://") || href.startsWith("https://");
}

export function isActiveSiteHref(activeHref: string | undefined, href: string) {
  if (!activeHref) {
    return false;
  }

  return activeHref === href || (href !== "/" && activeHref.startsWith(`${href}/`));
}
