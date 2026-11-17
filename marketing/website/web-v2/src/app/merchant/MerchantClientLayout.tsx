"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  BarChart2,
  Star,
  Tag,
  Bot,
  ShieldCheck,
  User,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import styles from "@/app/console/console.module.css";
import { merchantMutationFetch } from "@/lib/merchantPortal/csrf";
import { parseMerchantPortalJson } from "@/lib/merchantPortal/fetch";

interface SidebarRoute {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
}

type MerchantPortalOverview = {
  outlet: {
    floor?: string;
    name: string;
    unitNumber?: string;
  };
  verificationStatus: string;
};

type MerchantSessionResponse = {
  authenticated?: boolean;
  error?: string;
  overview?: MerchantPortalOverview;
};

const navRoutes: SidebarRoute[] = [
  { label: "Dashboard", href: "/merchant", icon: LayoutDashboard },
  { label: "Menu", href: "/merchant/menu", icon: UtensilsCrossed },
  { label: "Analytics", href: "/merchant/analytics", icon: BarChart2 },
  { label: "Reviews", href: "/merchant/reviews", icon: Star },
  { label: "Promotions", href: "/merchant/promotions", icon: Tag },
  { label: "AI Assistant", href: "/merchant/ai-assistant", icon: Bot },
  { label: "Verification", href: "/merchant/verification", icon: ShieldCheck },
  { label: "Profile", href: "/merchant/profile", icon: User },
  { label: "Settings", href: "/merchant/settings", icon: Settings },
];

const MERCHANT_AUTH_ROUTES = new Set([
  "/merchant/login",
  "/merchant/signup",
  "/merchant/forgot-password",
]);

export default function MerchantClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(280);
  const [isSidebarResizing, setIsSidebarResizing] = useState<boolean>(false);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(280);
  const [notifOpen, setNotifOpen] = useState<boolean>(false);
  const [overview, setOverview] = useState<MerchantPortalOverview | null>(null);
  const [sessionStatus, setSessionStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const notifHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifCount = 2;
  const verified = overview?.verificationStatus === "verified";

  useEffect(() => {
    if (pathname && MERCHANT_AUTH_ROUTES.has(pathname)) return;
    let cancelled = false;

    fetch("/api/merchant/session", { cache: "no-store" })
      .then(async (response) => {
        const payload = await parseMerchantPortalJson<MerchantSessionResponse>(response);
        if (!response.ok || !payload?.authenticated || !payload.overview) {
          throw new Error(payload?.error ?? "Merchant sign-in is required.");
        }
        return payload.overview;
      })
      .then((nextOverview) => {
        if (cancelled) return;
        setOverview(nextOverview);
        setSessionStatus("authenticated");

        const isVerified = nextOverview.verificationStatus === "verified";
        if (!isVerified && pathname !== "/merchant/verification") {
          router.replace("/merchant/verification");
          return;
        }
        if (isVerified && pathname === "/merchant/verification") {
          router.replace("/merchant");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setOverview(null);
        setSessionStatus("unauthenticated");
        const returnTo = encodeURIComponent(pathname ?? "/merchant");
        router.replace(`/merchant/login?returnTo=${returnTo}`);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  const isLinkActive = (href: string): boolean => {
    if (href === "/merchant") {
      return pathname === "/merchant";
    }
    return pathname?.startsWith(href) ?? false;
  };

  const closeSidebar = () => setIsMobileSidebarOpen(false);
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
  const sidebarAccessibilityProps: React.HTMLAttributes<HTMLElement> = isSidebarHiddenFromA11y
    ? { "aria-hidden": true, inert: true }
    : {};

  const handleLogout = async () => {
    await merchantMutationFetch("/api/merchant/logout", { method: "POST" }).catch(() => undefined);
    router.push("/merchant/login");
    router.refresh();
  };

  const openNotifications = () => {
    if (notifHoverTimer.current) {
      clearTimeout(notifHoverTimer.current);
      notifHoverTimer.current = null;
    }
    setNotifOpen(true);
  };

  const hideNotifications = () => {
    if (notifHoverTimer.current) {
      clearTimeout(notifHoverTimer.current);
    }
    notifHoverTimer.current = setTimeout(() => {
      setNotifOpen(false);
    }, 120);
  };

  const toggleNotifications = () => {
    if (notifHoverTimer.current) {
      clearTimeout(notifHoverTimer.current);
      notifHoverTimer.current = null;
    }
    setNotifOpen((open) => !open);
  };

  if (pathname && MERCHANT_AUTH_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  if (sessionStatus === "loading" || sessionStatus === "unauthenticated") {
    return (
      <div className={styles.consoleLayout}>
        <main className={styles.contentShell} id="main-content" tabIndex={-1}>
          <div className={styles.dashboardSectionCard}>
            {sessionStatus === "loading"
              ? "Loading merchant portal..."
              : "Redirecting to sign in..."}
          </div>
        </main>
      </div>
    );
  }

  const outletName = overview?.outlet.name ?? "Merchant outlet";
  const outletMeta =
    [overview?.outlet.floor, overview?.outlet.unitNumber].filter(Boolean).join(" ") ||
    "Linked to Hungry app";

  return (
    <div className={styles.consoleLayout}>
      {/* Mobile overlay */}
      {isMobileSidebarOpen && (
        <div className={styles.sidebarOverlay} onClick={closeSidebar} aria-hidden="true" />
      )}

      {/* Sidebar */}
      <aside
        className={`${styles.sidebar} ${isMobileSidebarOpen ? styles.sidebarOpen : ""} ${!isMobileViewport && isSidebarCollapsed ? styles.sidebarCollapsed : ""} ${isSidebarResizing ? styles.sidebarResizing : ""}`}
        style={{ "--console-sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
        {...sidebarAccessibilityProps}
      >
        <div className={styles.sidebarHeader}>
          <Link href="/merchant" className={styles.consoleTitleWrap} onClick={closeSidebar}>
            <span className={styles.shellBrandText}>Hungry</span>
            <span className={styles.consoleBadge}>Merchant</span>
          </Link>
          {!isMobileViewport ? (
            <button
              className={styles.sidebarCollapseBtn}
              onClick={toggleSidebarSize}
              aria-label={
                isSidebarCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"
              }
            >
              {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          ) : (
            <button
              className={styles.sidebarCloseBtn}
              onClick={closeSidebar}
              aria-label="Close navigation sidebar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {verified && (
          <div className={styles.operatorBlock}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span className={styles.sidebarMetaPill}>Active Outlet</span>
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: "700", color: "#FFF" }}>
                {outletName}
              </span>
              <div className={styles.operatorRoleSelect} aria-label="Linked merchant outlet">
                {outletMeta}
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className={styles.sidebarNav} aria-label="Merchant navigation">
          <div className={styles.navSectionTitle}>Manage</div>
          {navRoutes
            .filter((route) => verified || route.href === "/merchant/verification")
            .map((route) => {
              const Icon = route.icon;
              const active = isLinkActive(route.href);
              return (
                <Link
                  key={route.label}
                  href={route.href}
                  className={`${styles.sidebarLink} ${active ? styles.sidebarLinkActive : ""}`}
                  onClick={closeSidebar}
                >
                  <Icon size={16} />
                  <span className={styles.sidebarLinkLabel}>{route.label}</span>
                </Link>
              );
            })}
        </nav>

        {/* Footer */}
        <div className={styles.sidebarFooter}>
          <button
            onClick={handleLogout}
            className={styles.sidebarLink}
            style={{
              width: "100%",
              cursor: "pointer",
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.6)",
              marginBottom: "8px",
            }}
          >
            <LogOut size={16} />
            <span className={styles.sidebarLinkLabel}>Sign out</span>
          </button>
          <div style={{ color: "rgba(255,255,255,0.3)" }}>Hungry Merchant · v1.0</div>
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

      {/* Main */}
      <div className={styles.mainContainer}>
        {/* Top bar */}
        <header className={styles.topBar}>
          <button
            className={styles.hamburgerBtn}
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Open navigation sidebar"
          >
            <Menu size={22} />
          </button>

          <div style={{ flex: 1 }} />

          <div className={styles.topBarActions}>
            <div
              style={{ position: "relative" }}
              onMouseEnter={openNotifications}
              onMouseLeave={hideNotifications}
              onFocus={openNotifications}
              onBlur={hideNotifications}
            >
              <button
                onMouseEnter={openNotifications}
                onClick={toggleNotifications}
                onFocus={openNotifications}
                onBlur={hideNotifications}
                className={`${styles.notificationButton} ${notifOpen ? styles.notificationButtonActive : ""}`}
                aria-label={`${notifCount} notifications`}
                aria-expanded={notifOpen}
              >
                <Bell size={20} />
                {notifCount > 0 && <span className={styles.notificationDot}>{notifCount}</span>}
              </button>

              {notifOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 299 }}
                    onClick={() => setNotifOpen(false)}
                    aria-hidden="true"
                  />
                  {/* Dropdown panel */}
                  <div
                    onMouseEnter={openNotifications}
                    onMouseLeave={hideNotifications}
                    onFocus={openNotifications}
                    onBlur={hideNotifications}
                    className={styles.notificationPanel}
                  >
                    <div className={styles.notificationHeader}>
                      <span>Notifications</span>
                      <button onClick={() => setNotifOpen(false)}>Mark all read</button>
                    </div>
                    {[
                      {
                        icon: "★",
                        title: "New 5-star review received",
                        body: "Wei Ling left a glowing review on your oyster cake.",
                        time: "10 min ago",
                        dot: "var(--color-success)",
                      },
                      {
                        icon: "!",
                        title: "Promotion ending soon",
                        body: 'Your "Weekend Special" promo expires in 2 days.',
                        time: "1 hr ago",
                        dot: "var(--color-accent)",
                      },
                    ].map((n, i) => (
                      <button
                        key={i}
                        type="button"
                        className={styles.notificationItem}
                        onClick={() => setNotifOpen(false)}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: n.dot,
                            flexShrink: 0,
                            marginTop: 6,
                          }}
                        />
                        <div className={styles.notificationText}>
                          <strong>{n.title}</strong>
                          <p>{n.body}</p>
                          <small>{n.time}</small>
                        </div>
                      </button>
                    ))}
                    <div className={styles.notificationFooter}>
                      <button
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          router.push("/merchant/settings");
                        }}
                      >
                        Manage notification settings
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className={styles.topBarDivider} />

            <Link
              href="hungry://merchant"
              className={styles.sidebarLink}
              style={{ color: "var(--color-primary)", padding: "var(--space-2) var(--space-4)" }}
            >
              <ExternalLink size={16} />
              <span className={styles.sidebarLinkLabel}>Open in app</span>
            </Link>
          </div>
        </header>

        <main className={styles.contentShell} id="main-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
