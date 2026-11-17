"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

type SamePageLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
  };

function hrefToString(href: LinkProps["href"]) {
  return typeof href === "string" ? href : href.pathname ?? "/";
}

function getHrefPath(href: string) {
  return href.split("#")[0] || "/";
}

export function SamePageLink({ children, href, onClick, ...props }: SamePageLinkProps) {
  const pathname = usePathname() || "/";

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) {
      return;
    }

    const hrefString = hrefToString(href);
    const hasHash = hrefString.includes("#");
    const isModifiedClick =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

    if (isModifiedClick || hasHash || getHrefPath(hrefString) !== pathname) {
      return;
    }

    event.preventDefault();
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
