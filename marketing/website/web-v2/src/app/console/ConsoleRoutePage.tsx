import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getConsoleRouteBySection } from "@/lib/console/routeRegistry";
import ConsoleRouteClient from "./ConsoleRouteClient";
import styles from "./console.module.css";

export default function ConsoleRoutePage({ section }: { section: string }) {
  const normalizedSection = section === "overview" ? "overview" : section;
  const route = getConsoleRouteBySection(normalizedSection);

  if (!route || route.status === "hidden") {
    notFound();
  }

  return (
    <Suspense fallback={<div className={styles.routeShell}>Loading console route...</div>}>
      <ConsoleRouteClient initialSection={route.section} />
    </Suspense>
  );
}
