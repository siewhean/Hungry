"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./console.module.css";
import type { ConsoleScaffoldCopy } from "./consoleScaffoldCopy";

type ConsoleScaffoldPageProps = {
  copy: ConsoleScaffoldCopy;
  basePath: "/console" | "/console/product-analytics";
};

type ConsoleSummary = {
  configured?: boolean;
  counts?: {
    activeMerchants: number;
    merchantWaitlist: number;
    openReports: number;
    pendingVerifications: number;
    totalWaitlist: number;
    users: number;
  };
  error?: string;
};

type ConsoleMerchant = {
  dishCount: number;
  id: string;
  location: string;
  name: string;
  type: string;
  verificationStatus: string;
};

type MerchantListResponse = {
  configured?: boolean;
  merchants?: ConsoleMerchant[];
  error?: string;
};

function actionHref(action: string, basePath: ConsoleScaffoldPageProps["basePath"]) {
  const lower = action.toLowerCase();
  if (lower.includes("posthog")) return "https://posthog.com";
  if (lower.includes("sentry")) return "https://sentry.io";
  if (lower.includes("vercel")) return "https://vercel.com";
  if (lower.includes("eas")) return "https://expo.dev";
  if (lower.includes("github")) return "https://github.com";
  if (lower.includes("merchant") || lower.includes("verification") || lower.includes("claim")) return "/console/merchant-applications";
  if (lower.includes("feedback") || lower.includes("issue")) return "/console/feedback";
  if (lower.includes("report") || lower.includes("trust")) return "/console/reports";
  if (lower.includes("flag") || lower.includes("rollout")) return "/console/feature-flags";
  if (lower.includes("notification") || lower.includes("campaign")) return "/console/notifications";
  if (lower.includes("audit") || lower.includes("history")) return "/console/audit-log";
  if (lower.includes("analysis") || lower.includes("metric") || lower.includes("dashboard")) return "/console/product-analytics";
  return basePath;
}

function workflowStatus(copy: ConsoleScaffoldCopy, summary: ConsoleSummary | null, merchants: ConsoleMerchant[]) {
  const counts = summary?.counts;
  if (copy.slug === "inbox") {
    return {
      label: `${(counts?.openReports ?? 0) + (counts?.pendingVerifications ?? 0)} items`,
      note: "Combines open reports and pending merchant verification work from current Console APIs.",
    };
  }
  if (copy.slug === "merchant-applications" || copy.slug === "stall-submissions") {
    return {
      label: `${counts?.pendingVerifications ?? 0} pending`,
      note: "Uses the Console summary pending verification count.",
    };
  }
  if (copy.slug === "merchants" || copy.slug === "data-quality") {
    return {
      label: `${merchants.length || counts?.activeMerchants || 0} merchants`,
      note: "Uses the Console merchant list when configured, with summary fallback.",
    };
  }
  if (copy.slug === "reports" || copy.slug === "issues" || copy.slug === "feedback-and-issues") {
    return {
      label: `${counts?.openReports ?? 0} open`,
      note: "Uses the current Console open report count.",
    };
  }
  if (copy.slug === "website" || copy.slug === "acquisition") {
    return {
      label: `${counts?.totalWaitlist ?? 0} waitlist`,
      note: "Uses waitlist counts from the website database when configured.",
    };
  }
  return {
    label: summary?.configured ? "Live-ready" : "Fallback mode",
    note: summary?.configured
      ? "Console API authorization and summary data are available."
      : "Console copy is ready; live data appears once Supabase service access is configured.",
  };
}

export default function ConsoleScaffoldPage({ copy, basePath }: ConsoleScaffoldPageProps) {
  const [summary, setSummary] = useState<ConsoleSummary | null>(null);
  const [merchants, setMerchants] = useState<ConsoleMerchant[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/console/summary", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error("Unable to load Console summary.");
        return (await response.json()) as ConsoleSummary;
      }),
      fetch("/api/console/merchants", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error("Unable to load Console merchants.");
        return (await response.json()) as MerchantListResponse;
      }),
    ])
      .then(([summaryPayload, merchantPayload]) => {
        if (cancelled) return;
        setSummary(summaryPayload);
        setMerchants(merchantPayload.merchants ?? []);
        setLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const status = useMemo(() => workflowStatus(copy, summary, merchants), [copy, merchants, summary]);
  const merchantRows = merchants.slice(0, 5);

  return (
    <div>
      <div className={styles.headerTitleArea}>
        <div>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>
        <Link href={basePath} className={styles.actionButtonSecondary}>
          Back to {basePath === "/console" ? "Console" : "Product analysis"}
        </Link>
      </div>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Workflow status</div>
          <div className={styles.kpiValue}>{loadState === "loading" ? "Loading" : status.label}</div>
          <div className={styles.kpiDelta}>{loadState === "error" ? "Console API unavailable in this session." : status.note}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Data source</div>
          <div className={styles.kpiValue}>{summary?.configured ? "Supabase" : "Prototype"}</div>
          <div className={styles.kpiDelta}>This page does not fabricate operational totals.</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Owner model</div>
          <div className={styles.kpiValue}>Role-aware</div>
          <div className={styles.kpiDelta}>Actions stay scaffolded until RBAC and workflow owners are connected.</div>
        </div>
      </div>

      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}>
          <h2>Primary actions</h2>
        </div>
        <div className={styles.quickActionGrid}>
          {copy.primaryActions.map((action) => {
            const href = actionHref(action, basePath);
            const isExternal = href.startsWith("http");
            return (
            <Link
              key={action}
              href={href}
              className={styles.quickActionCard}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
            >
              <h4>{action}</h4>
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                {isExternal ? "Open the specialist tool for deeper analysis." : "Open the closest available Console workflow."}
              </span>
            </Link>
          );
          })}
        </div>
      </div>

      {merchantRows.length > 0 ? (
        <div className={styles.dashboardSectionCard}>
          <div className={styles.sectionHeaderRow}>
            <h2>Merchant records</h2>
          </div>
          <div className={styles.queueTableWrapper}>
            <table className={styles.queueTable}>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Type</th>
                  <th>Dishes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {merchantRows.map((merchant) => (
                  <tr key={merchant.id}>
                    <td>
                      <strong>{merchant.name}</strong>
                      <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                        {merchant.location || "Location pending"}
                      </div>
                    </td>
                    <td>{merchant.type}</td>
                    <td>{merchant.dishCount}</td>
                    <td>{merchant.verificationStatus.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}>
          <h2>Empty state</h2>
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyStateTitle}>{copy.emptyState}</div>
          <p className={styles.emptyStateDesc}>
            This route is copy-ready and waits for live data, permissions, and workflow wiring.
          </p>
        </div>
      </div>

      {copy.sections?.map((section) => (
        <div className={styles.dashboardSectionCard} key={section.title}>
          <div className={styles.sectionHeaderRow}>
            <h2>{section.title}</h2>
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-sm)", lineHeight: 1.6 }}>
            {section.body}
          </p>
        </div>
      ))}
    </div>
  );
}
