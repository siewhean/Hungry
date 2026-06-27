"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LogOut,
  Menu,
  Search,
  X,
} from "lucide-react";
import { getConsoleRouteGroups, type ConsoleRole } from "@/lib/console/routeRegistry";
import styles from "./console.module.css";

type ConsoleActorView = {
  authMode: "supabase" | "basic";
  email: string;
  role: ConsoleRole;
  status: "active" | "suspended";
};

export default function ConsoleClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [actor, setActor] = useState<ConsoleActorView | null>(null);
  const [authError, setAuthError] = useState<string>("");
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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/console/me", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? "Console access denied.");
        }
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setActor(data.actor ?? null);
          setAuthError("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setActor(null);
          setAuthError(error instanceof Error ? error.message : "Console access denied.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const routeGroups = useMemo(() => getConsoleRouteGroups(actor?.role), [actor?.role]);

  const handleExitConsole = async () => {
    try {
      await router.replace("/");
    } catch {
      window.location.href = "/";
    }
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    router.push(query ? `/console/search?q=${encodeURIComponent(query)}` : "/console/search");
    closeMobileSidebar();
  };

  const isLinkActive = (href: string) => {
    if (href === "/console") {
      return pathname === "/console" || pathname === "/console/overview";
    }
    return pathname?.startsWith(href);
  };

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen((prev) => !prev);
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

  const startSidebarResize = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isMobileViewport) return;
    resizeStartX.current = event.clientX;
    resizeStartWidth.current = sidebarWidth;
    setIsSidebarResizing(true);
    document.body.style.userSelect = "none";

    const onMouseMove = (mouseEvent: MouseEvent) => {
      const deltaX = mouseEvent.clientX - resizeStartX.current;
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
  const sidebarAccessibilityProps: React.HTMLAttributes<HTMLElement> & { inert?: boolean } =
    isSidebarHiddenFromA11y ? { "aria-hidden": true, inert: true } : {};

  return (
    <div className={styles.consoleLayout}>
      {isMobileSidebarOpen && (
        <div
          className={styles.sidebarOverlay}
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

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
              type="button"
            >
              {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          ) : (
            <button
              className={styles.sidebarCloseBtn}
              onClick={closeMobileSidebar}
              aria-label="Close navigation sidebar"
              type="button"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className={styles.operatorBlock}>
          <span className={styles.sidebarMetaPill}>Authenticated Operator</span>
          <span className={styles.operatorName}>
            {actor?.email ?? (authError ? "Access pending" : "Resolving session")}
          </span>
          <span className={styles.operatorDetail}>
            {actor ? `${actor.role.toUpperCase()} via ${actor.authMode}` : authError || "Checking Supabase access"}
          </span>
        </div>

        <nav className={styles.sidebarNav} aria-label="Console Navigation">
          {(["Operations", "Platform"] as const).map((group) => (
            <React.Fragment key={group}>
              {routeGroups[group].length ? <div className={styles.navSectionTitle}>{group}</div> : null}
              {routeGroups[group].map((route) => {
                const Icon = route.icon;
                const active = isLinkActive(route.href);
                return (
                  <Link
                    key={route.section}
                    href={route.href}
                    className={`${styles.sidebarLink} ${active ? styles.sidebarLinkActive : ""}`}
                    onClick={closeMobileSidebar}
                  >
                    <Icon size={16} />
                    <span className={styles.sidebarLinkLabel}>{route.label}</span>
                  </Link>
                );
              })}
            </React.Fragment>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link
            href="/for-merchants"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sidebarLink}
            prefetch={false}
          >
            <ExternalLink size={14} />
            <span className={styles.sidebarLinkLabel}>Open public site</span>
          </Link>
          <div className={styles.sidebarFooterNote}>Supabase gated · audited mutations</div>
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

      <div className={styles.mainContainer}>
        <header className={styles.topBar}>
          <button
            className={styles.hamburgerBtn}
            onClick={toggleMobileSidebar}
            aria-label="Open navigation sidebar"
            type="button"
          >
            <Menu size={22} />
          </button>

          <form className={styles.searchBarWrapper} onSubmit={handleSearchSubmit}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="search"
              placeholder="Search users, stalls, dishes, claims, reports, or audit events..."
              className={styles.searchBarInput}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search Hungry Console"
            />
          </form>

          <div className={styles.topBarActions}>
            {actor ? (
              <span className={styles.sidebarMetaPill}>{actor.role}</span>
            ) : null}
            <div className={styles.topBarDivider} />
            <button
              type="button"
              onClick={handleExitConsole}
              className={styles.topBarButton}
              aria-label="Exit Hungry Console"
            >
              <LogOut size={16} />
              <span className={styles.exitConsoleLabel}>Exit Console</span>
            </button>
          </div>
        </header>

        <main className={styles.contentShell} id="main-content" tabIndex={-1}>
          {authError ? (
            <div className={styles.routeErrorState}>
              <strong>Console access is blocked.</strong>
              <span>{authError}</span>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
