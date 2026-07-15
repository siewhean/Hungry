"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function RouteEffects() {
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const currentPathname = pathname ?? null;
    if (previousPathnameRef.current !== null && previousPathnameRef.current !== currentPathname) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    previousPathnameRef.current = currentPathname;
  }, [pathname]);

  return null;
}
