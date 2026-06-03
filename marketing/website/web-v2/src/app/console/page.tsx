"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  UserCheck,
  Inbox,
  ArrowRight,
  Zap,
  ExternalLink,
  Flame,
  FileSpreadsheet,
  BarChart2,
  X,
  CheckCircle,
} from "lucide-react";
import { readConsolePrototypeString } from "@/lib/console/prototypeStorage";
import styles from "./console.module.css";

function ConsoleLineChart({ points }: { points: number[] }) {
  const max = Math.max(...points);
  const w = 600; const h = 100;
  const step = w / (points.length - 1);
  const coords = points.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; val: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const pctX = relativeX / rect.width;
    const viewBoxX = pctX * w;
    
    const idx = Math.min(points.length - 1, Math.max(0, Math.round(viewBoxX / step)));
    
    const activeX = idx * step;
    const activeY = h - (points[idx] / max) * h;
    
    const tooltipX = (activeX / w) * rect.width;
    const tooltipY = (activeY / h) * rect.height - 38;

    setHoveredIdx(idx);
    setTooltipPos({ x: tooltipX, y: tooltipY, val: points[idx] });
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
    setTooltipPos(null);
  };

  const activeX = hoveredIdx !== null ? hoveredIdx * step : 0;
  const activeY = hoveredIdx !== null ? h - (points[hoveredIdx] / max) * h : 0;

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: "100%", height: "100px", overflow: "visible", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="consoleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <polyline fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinejoin="round" points={coords} />
        <polyline
          fill="url(#consoleGrad)"
          stroke="none"
          points={`0,${h} ${coords} ${(points.length - 1) * step},${h}`}
        />

        {hoveredIdx !== null && (
          <>
            <line
              x1={activeX}
              y1={0}
              x2={activeX}
              y2={h}
              stroke="var(--color-border-strong)"
              strokeDasharray="3"
              strokeWidth="1.5"
            />
            <circle
              cx={activeX}
              cy={activeY}
              r={6}
              fill="var(--color-primary)"
              stroke="white"
              strokeWidth={2}
            />
          </>
        )}
      </svg>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "8px", fontFamily: "var(--font-mono)" }}>
        {days.map((d) => <span key={d}>{d}</span>)}
      </div>

      {tooltipPos && (
        <div
          style={{
            position: "absolute",
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: "translateX(-50%)",
            backgroundColor: "rgba(26, 46, 68, 0.9)",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            padding: "4px 8px",
            borderRadius: "var(--radius-full)",
            color: "white",
            fontSize: "10px",
            fontFamily: "var(--font-mono)",
            pointerEvents: "none",
            boxShadow: "var(--shadow-md)",
            zIndex: 10,
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            transition: "left 0.08s ease-out, top 0.08s ease-out"
          }}
        >
          <span style={{ fontWeight: 800, color: "var(--color-primary)" }}>{tooltipPos.val.toLocaleString()}</span>
          <span style={{ opacity: 0.8 }}>API Requests</span>
        </div>
      )}
    </div>
  );
}

interface MockClaim {
  id: string;
  stallName: string;
  applicant: string;
  type: string;
  status: "pending" | "in_review";
  submitted: string;
}

interface AlertItem {
  id: string;
  type: "critical" | "warning";
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

type ConsoleSummaryApiResponse = {
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

const initialClaims: MockClaim[] = [
  { id: "CLM-104", stallName: "Old Airport Road Lor Mee", applicant: "Tan Keng Ann", type: "Stall Claim", status: "pending", submitted: "2 hours ago" },
  { id: "CLM-105", stallName: "Ah Seng Braised Duck", applicant: "Lim Wei Ming", type: "Stall Claim", status: "in_review", submitted: "4 hours ago" },
  { id: "SUB-302", stallName: "Geylang Lor 9 Fresh Frog Porridge", applicant: "Chua Kim Hock", type: "Stall Add", status: "pending", submitted: "1 day ago" },
  { id: "CLM-106", stallName: "Maxwell Fuzhou Oyster Cake", applicant: "Sarah Tan", type: "Stall Claim", status: "pending", submitted: "2 days ago" },
];

export default function ConsoleOverview() {
  const [role, setRole] = useState<string>("Admin");
  const [feedbackCount, setFeedbackCount] = useState<number>(3);
  const [isProd, setIsProd] = useState<boolean>(() =>
    readConsolePrototypeString("env") === "production"
  );
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [summary, setSummary] = useState<ConsoleSummaryApiResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: "alert-sentry",
      type: "critical",
      title: "Sentry: Elevated error rate in app build v1.10.4 (iOS)",
      description: "Network Timeout exceptions increased by 14% among foodie users in Clementi region.",
      actionLabel: "Triage in Sentry",
      actionHref: "https://sentry.io",
    },
    {
      id: "alert-queue",
      type: "warning",
      title: "Pending Verification Queue Backlog",
      description: "Merchant outlet claims are synced from Supabase when the console database is configured.",
      actionLabel: "Review Claims",
      actionHref: "/console/merchant-applications",
    },
  ]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleRoleChange = (e: Event) => {
        setRole((e as CustomEvent).detail);
      };
      const handleEnvChange = (e: Event) => {
        setIsProd((e as CustomEvent).detail === "production");
      };
      window.addEventListener("consoleRoleChanged", handleRoleChange);
      window.addEventListener("consoleEnvChanged", handleEnvChange);
      return () => {
        window.removeEventListener("consoleRoleChanged", handleRoleChange);
        window.removeEventListener("consoleEnvChanged", handleEnvChange);
      };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/console/summary", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as ConsoleSummaryApiResponse;
        if (!response.ok) throw new Error(payload.error ?? "Unable to load console summary.");
        return payload;
      })
      .then((payload) => {
        if (!cancelled) setSummary(payload);
      })
      .catch((error) => {
        if (!cancelled) {
          setSummary({ configured: false, error: error instanceof Error ? error.message : "Unable to load console summary." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const dismissAllAlerts = () => {
    setAlerts([]);
    showToast("All alerts dismissed", "info");
  };

  const handleResolveQuick = () => {
    if (feedbackCount > 0) {
      setFeedbackCount((prev) => prev - 1);
      showToast("Feedback resolved", "success");
    }
  };

  // Env-aware KPI values
  const pendingClaimsCount = summary?.counts?.pendingVerifications ?? initialClaims.length;
  const activeUsers = summary?.counts?.users?.toLocaleString() ?? (isProd ? "142,820" : "14,842");
  const activeMerchants = summary?.counts?.activeMerchants?.toLocaleString() ?? (isProd ? "3,420" : "342");
  const slaRate = isProd ? "99.1%" : "98.4%";

  return (
    <div>
      <section className={styles.workspaceHero} aria-labelledby="console-workspace-title">
        <div>
          <span className={styles.workspaceEyebrow}>Hungry Console</span>
          <h2 id="console-workspace-title">Operating state across app, merchants, and trust queues.</h2>
          <p>
            The console front-loads the decisions that need attention now: claim queues, feedback,
            release health, and rollout controls. Each metric links back to an operating surface.
          </p>
          <div className={styles.statusStrip} aria-label="Current console status">
            <span className={styles.statusPill}>
              <span className={styles.statusPillDot} />
              {summary?.configured ? "Supabase data" : isProd ? "Production fallback" : "Staging fallback"}
            </span>
            <span className={styles.statusPill}>Role: {role}</span>
            <span className={styles.statusPill}>{alerts.length} active alerts</span>
          </div>
        </div>
        <div className={styles.workspaceHeroGrid}>
          <div className={styles.workspaceHeroMetric}>
            <span>SLA resolution</span>
            <strong>{slaRate}</strong>
            <small>Target stays above 95.0%</small>
          </div>
          <div className={styles.workspaceHeroMetric}>
            <span>Pending claims</span>
            <strong>{pendingClaimsCount}</strong>
            <small>Merchant ownership queue</small>
          </div>
          <div className={styles.workspaceHeroMetric}>
            <span>Active foodies</span>
            <strong>{activeUsers}</strong>
            <small>Rolling 7-day audience</small>
          </div>
          <div className={styles.workspaceHeroMetric}>
            <span>Open feedback</span>
            <strong>{feedbackCount}</strong>
            <small>Ready for triage</small>
          </div>
        </div>
      </section>

      {/* HEADER SECTION */}
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Hungry Console</h1>
          <p>Run Hungry from one place: app, website, merchants, trust queues, releases, notifications, and product operations.</p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          <div
            className={styles.badge}
            style={{ backgroundColor: "var(--color-bg-warm)", color: "var(--color-primary)", border: "1px solid var(--color-primary)" }}
          >
            Role: {role} mode
          </div>
          {isProd && (
            <div className={styles.badge} style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}>
              PRODUCTION
            </div>
          )}
        </div>
      </div>

      {/* SLA CRITICAL ALERTS */}
      {alerts.length > 0 && (
        <div className={styles.alertFeed}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-2)" }}>
            <button
              onClick={dismissAllAlerts}
              className={styles.actionButtonSecondary}
              style={{ fontSize: "var(--font-size-xs)", padding: "var(--space-1) var(--space-3)" }}
            >
              Dismiss All
            </button>
          </div>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`${styles.alertBanner} ${alert.type === "critical" ? styles.alertBannerCritical : styles.alertBannerWarning}`}
            >
              <div className={styles.alertContent}>
                {alert.type === "critical" ? (
                  <Flame size={20} style={{ color: "#EF5656" }} />
                ) : (
                  <UserCheck size={20} style={{ color: "var(--color-primary)" }} />
                )}
                <div className={styles.alertText}>
                  <h4>{alert.title}</h4>
                  <p>{alert.description}</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexShrink: 0 }}>
                {alert.actionHref && alert.actionLabel && (
                  alert.actionHref.startsWith("http") ? (
                    <a href={alert.actionHref} target="_blank" rel="noopener noreferrer" className={styles.alertActionBtn}>
                      {alert.actionLabel}
                    </a>
                  ) : (
                    <Link href={alert.actionHref} className={styles.alertActionBtn}>
                      {alert.actionLabel}
                    </Link>
                  )
                )}
                <button
                  onClick={() => dismissAlert(alert.id)}
                  aria-label="Dismiss alert"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-text-muted)",
                    display: "flex",
                    alignItems: "center",
                    padding: "4px",
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* METRIC SUMMARY CARDS */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Active Foodies (7D)</span>
          <span className={styles.kpiValue}>{activeUsers}</span>
          <span className={`${styles.kpiTrend} ${styles.trendUp}`}>+12.4% vs last week</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Active Merchants</span>
          <span className={styles.kpiValue}>{activeMerchants}</span>
          <span className={`${styles.kpiTrend} ${styles.trendUp}`}>+4 new outlets today</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Pending Claims</span>
          <span className={styles.kpiValue}>{pendingClaimsCount}</span>
          <span className={`${styles.kpiTrend} ${styles.trendNeutral}`}>Steady review rate</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>SLA Resolution</span>
          <span className={styles.kpiValue}>{slaRate}</span>
          <span className={`${styles.kpiTrend} ${styles.trendUp}`}>Above 95.0% target</span>
        </div>
      </div>

      {/* SYSTEM REQUEST VOLUME LINE CHART */}
      <div className={styles.chartWrapper} style={{ marginBottom: "var(--space-6)" }}>
        <div className={styles.chartHeader}>
          <span className={styles.chartTitle}>System Request Volume (7D WAU)</span>
        </div>
        <ConsoleLineChart points={[12420, 13180, 11950, 14210, 15842, 13900, 14842]} />
      </div>

      {/* SPLIT DASHBOARD GRID */}
      <div className={styles.dashboardSplitGrid}>
        {/* Left Column: Claims operational queue */}
        <div>
          <div className={styles.dashboardSectionCard}>
            <div className={styles.sectionHeaderRow}>
              <h2>Urgent Merchant Review Queue</h2>
              <Link
                href="/console/merchant-applications"
                style={{ fontSize: "var(--font-size-xs)", color: "var(--color-primary)", display: "flex", alignItems: "center", gap: "2px" }}
              >
                View all queue items <ArrowRight size={14} />
              </Link>
            </div>

            <div className={styles.queueTableWrapper}>
              <table className={styles.queueTable}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Stall Name</th>
                    <th>Applicant</th>
                    <th>Request Type</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {initialClaims.map((claim) => (
                    <tr key={claim.id}>
                      <td style={{ fontWeight: "700", fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}>{claim.id}</td>
                      <td>{claim.stallName}</td>
                      <td>{claim.applicant}</td>
                      <td>{claim.type}</td>
                      <td>
                        <span className={`${styles.badge} ${claim.status === "pending" ? styles.badgePending : styles.badgeNew}`}>
                          {claim.status === "pending" ? "Pending" : "In Review"}
                        </span>
                      </td>
                      <td style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>{claim.submitted}</td>
                      <td>
                        <Link
                          href="/console/merchant-applications"
                          className={styles.rowAction}
                          style={{ fontSize: "var(--font-size-xs)" }}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Quick actions & Debugger deep links */}
        <div>
          {/* Quick operations */}
          <div className={styles.dashboardSectionCard}>
            <div className={styles.sectionHeaderRow}>
              <h2>Quick Operations</h2>
            </div>
            <div className={styles.quickActionsGrid}>
              <button type="button" className={styles.quickActionCard} onClick={handleResolveQuick}>
                <Inbox size={20} style={{ color: "var(--color-primary)" }} />
                <h4>Resolve Feedback</h4>
                <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                  {feedbackCount} open issues
                </span>
              </button>
              <Link href="/console/feature-flags" className={styles.quickActionCard}>
                <Zap size={20} style={{ color: "var(--color-accent)" }} />
                <h4>Configure Flags</h4>
                <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                  3 active rollouts
                </span>
              </Link>
            </div>
          </div>

          {/* External Links */}
          <div className={styles.dashboardSectionCard}>
            <div className={styles.sectionHeaderRow}>
              <h2>External Debugger Tools</h2>
            </div>
            <div className={styles.integrationLinkRow}>
              <a href="https://posthog.com" target="_blank" rel="noopener noreferrer" className={styles.integrationLinkCard}>
                <div className={styles.integrationInfo}>
                  <BarChart2 size={18} style={{ color: "var(--color-primary)" }} />
                  <div>
                    <div className={styles.integrationName}>PostHog</div>
                    <div className={styles.integrationDesc}>Funnel &amp; event tracking</div>
                  </div>
                </div>
                <span className={styles.integrationBtn}>Open <ExternalLink size={12} /></span>
              </a>

              <a href="https://sentry.io" target="_blank" rel="noopener noreferrer" className={styles.integrationLinkCard}>
                <div className={styles.integrationInfo}>
                  <Flame size={18} style={{ color: "#EF5656" }} />
                  <div>
                    <div className={styles.integrationName}>Sentry</div>
                    <div className={styles.integrationDesc}>Crashes and stability</div>
                  </div>
                </div>
                <span className={styles.integrationBtn}>Open <ExternalLink size={12} /></span>
              </a>

              <a href="https://firebase.google.com" target="_blank" rel="noopener noreferrer" className={styles.integrationLinkCard}>
                <div className={styles.integrationInfo}>
                  <Zap size={18} style={{ color: "var(--color-accent)" }} />
                  <div>
                    <div className={styles.integrationName}>Firebase Remote Config</div>
                    <div className={styles.integrationDesc}>Cloud messaging &amp; parameters</div>
                  </div>
                </div>
                <span className={styles.integrationBtn}>Open <ExternalLink size={12} /></span>
              </a>

              <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className={styles.integrationLinkCard}>
                <div className={styles.integrationInfo}>
                  <FileSpreadsheet size={18} style={{ color: "var(--color-text-primary)" }} />
                  <div>
                    <div className={styles.integrationName}>Vercel Deployments</div>
                    <div className={styles.integrationDesc}>Build status and logs</div>
                  </div>
                </div>
                <span className={styles.integrationBtn}>Open <ExternalLink size={12} /></span>
              </a>

              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className={styles.integrationLinkCard}>
                <div className={styles.integrationInfo}>
                  <FileSpreadsheet size={18} style={{ color: "var(--color-text-primary)" }} />
                  <div>
                    <div className={styles.integrationName}>GitHub</div>
                    <div className={styles.integrationDesc}>Pull requests and release evidence</div>
                  </div>
                </div>
                <span className={styles.integrationBtn}>Open <ExternalLink size={12} /></span>
              </a>

              <a href="https://expo.dev" target="_blank" rel="noopener noreferrer" className={styles.integrationLinkCard}>
                <div className={styles.integrationInfo}>
                  <FileSpreadsheet size={18} style={{ color: "var(--color-primary)" }} />
                  <div>
                    <div className={styles.integrationName}>Expo EAS</div>
                    <div className={styles.integrationDesc}>Native builds and submissions</div>
                  </div>
                </div>
                <span className={styles.integrationBtn}>Open <ExternalLink size={12} /></span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`${styles.toast} ${styles[`toast${toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}`]}`}>
          <CheckCircle size={16} />
          {toast.message}
        </div>
      )}
    </div>
  );
}
