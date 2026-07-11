"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RouteEffects } from "@/components/layout/RouteEffects";

type AppLayoutWrapperProps = {
  children: ReactNode;
  publicFooter: ReactNode;
  publicHeader: ReactNode;
};

export default function AppLayoutWrapper({
  children,
  publicFooter,
  publicHeader,
}: AppLayoutWrapperProps) {
  const pathname = usePathname();
  const isPrivateShell = pathname.startsWith("/console") || pathname.startsWith("/merchant");

  if (isPrivateShell) {
    return (
      <>
        <a className="skipLink" href="#main-content">
          Skip to main content
        </a>
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </>
    );
  }

  return (
    <>
      <a className="skipLink" href="#main-content">
        Skip to main content
      </a>
      {publicHeader}
      <RouteEffects />
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
      {publicFooter}
    </>
  );
}
