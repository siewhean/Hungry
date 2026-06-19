"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BarChart2,
  UserCheck,
  Inbox,
  Sliders,
  ClipboardList,
  Search,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  Store,
  Users,
  Bell,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Users2
} from "lucide-react";
import styles from "./console.module.css";

interface SidebarRoute {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const operationalRoutes: SidebarRoute[] = [
  { label: "Overview", href: "/console", icon: LayoutDashboard },
  { label: "Search", href: "/console/search", icon: Search },
  { label: "Unified Inbox", href: "/console/inbox", icon: Inbox },
  { label: "Merchants", href: "/console/merchants", icon: Store },
  { label: "Stall Submissions", href: "/console/stall-submissions", icon: ClipboardList },
  { label: "Users", href: "/console/users", icon: Users },
  { label: "Waitlist", href: "/console/waitlist", icon: Users2 },
  { label: "Merchant Claims", href: "/console/merchant-applications", icon: UserCheck },
  { label: "User Feedback", href: "/console/feedback", icon: Inbox },
  { label: "Moderation Queue", href: "/console/reports", icon: ShieldAlert },
  { label: "Content Review", href: "/console/content", icon: ClipboardList },
  { label: "Notifications", href: "/console/notifications", icon: Bell },
  { label: "Activity", href: "/console/activity", icon: BarChart2 },
  { label: "Messages", href: "/console/messages", icon: Inbox },
  { label: "Releases", href: "/console/releases", icon: ClipboardList },
];

const configRoutes: SidebarRoute[] = [
  { label: "Product Analytics", href: "/console/product-analytics", icon: BarChart2 },
  { label: "Feature Flags", href: "/console/feature-flags", icon: Sliders },
  { label: "Experiments", href: "/console/experiments", icon: Sliders },
  { label: "App Config", href: "/console/app-config", icon: Sliders },
  { label: "Data Quality", href: "/console/data-quality", icon: ClipboardList },
  { label: "Issues", href: "/console/issues", icon: ShieldAlert },
  { label: "Audit Log", href: "/console/audit-log", icon: ClipboardList },
  { label: "Team", href: "/console/team", icon: Users },
  { label: "Settings", href: "/console/settings", icon: Sliders },
];

export default function ConsoleClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeRole, setActiveRole] = useState<string>("Admin");
  const [environment, setEnvironment] = useState<string>("staging");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(280);
  const [isSidebarResizing, setIsSidebarResizing] = useState<boolean>(false);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(280);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  // Dynamic console operator actions
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const role = e.target.value;
    setActiveRole(role);
    // Emit event to update sub-screens dynamically if listening
    if (typeof window !== "undefined") {
      const event = new CustomEvent("consoleRoleChanged", { detail: role });
      window.dispatchEvent(event);
    }
  };

  const handleEnvChange = (env: string) => {
    setEnvironment(env);
    if (typeof window !== "undefined") {
      const event = new CustomEvent("consoleEnvChanged", { detail: env });
      window.dispatchEvent(event);
    }
  };

  const handleExitConsole = async () => {
    try {
      await router.replace("/");
    } catch {
      window.location.href = "/";
    }
  };

  const isLinkActive = (href: string) => {
    if (href === "/console") {
      return pathname === "/console" || pathname === "/console/overview";
    }
    return pathname?.startsWith(href);
  };

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(prev => !prev);
  };

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  const toggleSidebarSize = () => {
    if (isSidebarCollapsed) {
      setSidebarWidth(280);
      setIsSidebarCollapsed(false);
    } else {
      setSidebarWidth(92);
      setIsSidebarCollapsed(true);
    }
  };

  const startSidebarResize = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isMobileViewport) return;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
    setIsSidebarResizing(true);
    document.body.style.userSelect = "none";

    const onMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - resizeStartX.current;
      const nextWidth = Math.min(420, Math.max(92, Math.round(resizeStartWidth.current + deltaX)));
      setSidebarWidth(nextWidth);
      setIsSidebarCollapsed(nextWidth <= 120);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setIsSidebarResizing(false);
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const isSidebarHiddenFromA11y = isMobileViewport && !isMobileSidebarOpen;
  const sidebarAccessibilityProps: React.HTMLAttributes<HTMLElement> =
    isSidebarHiddenFromA11y ? { "aria-hidden": true, inert: true } : {};

  return (
    <div className={styles.consoleLayout}>
      {/* SIDEBAR OVERLAY BACKDROP FOR MOBILE */}
      {isMobileSidebarOpen && (
        <div
          className={styles.sidebarOverlay}
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside
        className={`${styles.sidebar} ${isMobileSidebarOpen ? styles.sidebarOpen : ""} ${!isMobileViewport && isSidebarCollapsed ? styles.sidebarCollapsed : ""} ${isSidebarResizing ? styles.sidebarResizing : ""}`}
        style={{ "--console-sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
        {...sidebarAccessibilityProps}
      >
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.consoleTitleWrap} onClick={closeMobileSidebar}>
            <span className={styles.shellBrandText}>Hungry</span>
            <span className={styles.consoleBadge}>Console</span>
          </Link>
          {!isMobileViewport ? (
            <button
              className={styles.sidebarCollapseBtn}
              onClick={toggleSidebarSize}
              aria-label={isSidebarCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          ) : (
            <button
              className={styles.sidebarCloseBtn}
              onClick={closeMobileSidebar}
              aria-label="Close navigation sidebar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* STAFF OPERATOR INFO & ROLE SELECTOR */}
        <div className={styles.operatorBlock}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span className={styles.sidebarMetaPill}>Active Operator</span>
            <span style={{ fontSize: "var(--font-size-sm)", fontWeight: "700", color: "#FFF" }}>
              Hean (Hungry Ops)
            </span>
            <select
              className={styles.operatorRoleSelect}
              value={activeRole}
              onChange={handleRoleChange}
              title="Operator Role Selector"
            >
              <option value="Owner">Owner (All Controls)</option>
              <option value="Admin">Admin (Moderation / Claims)</option>
              <option value="Developer">Developer (Flags / Health)</option>
              <option value="Support">Support (Feedback / Inbox)</option>
              <option value="Growth">Growth (Analytics / Notifications)</option>
            </select>
          </div>
        </div>

        {/* SIDEBAR NAVIGATION ITEMS */}
        <nav className={styles.sidebarNav} aria-label="Console Navigation">
          <div className={styles.navSectionTitle}>Operations</div>
          {operationalRoutes.map((route) => {
            const Icon = route.icon;
            const active = isLinkActive(route.href);
            return (
              <Link
                key={route.label}
                href={route.href}
                className={`${styles.sidebarLink} ${active ? styles.sidebarLinkActive : ""}`}
                onClick={closeMobileSidebar}
              >
                <Icon size={16} />
                <span className={styles.sidebarLinkLabel}>{route.label}</span>
              </Link>
            );
          })}

          <div className={styles.navSectionTitle}>Configuration</div>
          {configRoutes.map((route) => {
            const Icon = route.icon;
            const active = isLinkActive(route.href);
            return (
              <Link
                key={route.label}
                href={route.href}
                className={`${styles.sidebarLink} ${active ? styles.sidebarLinkActive : ""}`}
                onClick={closeMobileSidebar}
              >
                <Icon size={16} />
                <span className={styles.sidebarLinkLabel}>{route.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* SIDEBAR FOOTER */}
        <div className={styles.sidebarFooter}>
          <Link
            href="/merchant"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sidebarLink}
            style={{ padding: "var(--space-2) 0", color: "rgba(255,255,255,0.55)" }}
            prefetch={false}
          >
            <ExternalLink size={14} />
            <span className={styles.sidebarLinkLabel} style={{ fontSize: "var(--font-size-xs)" }}>
              Open Merchant Mode
            </span>
          </Link>
          <div style={{ marginTop: "var(--space-2)", color: "rgba(255,255,255,0.3)" }}>Ver: 2.10.4-beta · Expo SDK 55</div>
        </div>
        {!isMobileViewport ? (
          <button
            className={styles.sidebarResizeHandle}
            onMouseDown={startSidebarResize}
            onDoubleClick={() => {
              setSidebarWidth(280);
              setIsSidebarCollapsed(false);
            }}
            aria-label="Resize sidebar width"
            type="button"
          />
        ) : null}
      </aside>

      {/* MAIN LAYOUT BLOCK */}
      <div className={styles.mainContainer}>
        {/* TOP INTERACTIVE CONTROL BAR */}
        <header className={styles.topBar}>
          {/* Hamburger toggle button for mobile/tablet */}
          <button
            className={styles.hamburgerBtn}
            onClick={toggleMobileSidebar}
            aria-label="Open navigation sidebar"
          >
            <Menu size={22} />
          </button>

          {/* Global search mockup */}
          <div className={styles.searchBarWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search users, stalls, dishes, claims, or feedback..."
              className={styles.searchBarInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search Hungry Console"
            />
          </div>

          {/* Staging/Prod Switcher */}
          <div className={styles.topBarActions}>
            <span className={styles.envSwitcherLabel}>
              Target Env:
            </span>
            <div style={{ display: "flex", gap: "4px" }}>
              {(["production", "staging", "preview"] as const).map((env) => {
                const isActive = environment === env;
                const indClass =
                  env === "production" ? styles.envProd :
                  env === "staging" ? styles.envStaging :
                  styles.envPreview;

                return (
                  <button
                    key={env}
                    className={`${styles.envSwitcher} ${isActive ? "" : styles.envSwitcherInactive}`}
                    style={{
                      opacity: isActive ? 1 : 0.44,
                      backgroundColor: isActive ? "var(--color-ink-deep)" : "transparent",
                      border: isActive ? "none" : "1px solid var(--color-border-strong)",
                      color: isActive ? "white" : "var(--color-text-secondary)"
                    }}
                    onClick={() => handleEnvChange(env)}
                  >
                    <span className={`${styles.envIndicator} ${indClass}`} />
                    {env === "production" ? "PROD" : env === "staging" ? "STAGING" : "PREV"}
                  </button>
                );
              })}
            </div>

            <div className={styles.topBarDivider} />
            <button
              type="button"
              onClick={handleExitConsole}
              className={styles.sidebarLink}
              style={{ color: "var(--color-primary)", padding: "var(--space-2) var(--space-4)", border: "none", background: "transparent", cursor: "pointer" }}
              aria-label="Exit Hungry Console"
            >
              <LogOut size={16} />
              <span className={styles.exitConsoleLabel}>Exit Console</span>
            </button>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className={styles.contentShell} id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
