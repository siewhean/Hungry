"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Eye, BarChart2, Star, Tag, PenSquare, Clock, TrendingUp,
  MessageSquare, UserPlus, CheckCircle, ArrowRight, ShieldCheck
} from "lucide-react";
import { merchantMutationFetch } from "@/lib/merchantPortal/csrf";
import { parseMerchantPortalJson } from "@/lib/merchantPortal/fetch";
import styles from "@/app/console/console.module.css";

const VIEWS_7D = [88, 102, 95, 118, 124, 110, 124];
const VIEWS_30D = [72, 81, 95, 103, 88, 99, 111, 124, 108, 115, 120, 99, 102, 88, 107, 119, 114, 103, 98, 112, 124, 117, 109, 103, 98, 118, 121, 110, 115, 124];

interface ReviewItem {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  replied: boolean;
  replyText?: string;
}

interface OperatingHours {
  monFriStart: string;
  monFriEnd: string;
  monFriClosed: boolean;
  satStart: string;
  satEnd: string;
  satClosed: boolean;
  sunStart: string;
  sunEnd: string;
  sunClosed: boolean;
}

interface MenuStats {
  total: number;
  available: number;
  soldOut: number;
}

type MerchantOverviewApiResponse = {
  analytics?: {
    menuClicks: number;
    profileViews: number;
    reviewCount: number;
  };
  dishes?: {
    isSoldOut?: boolean;
  }[];
  error?: string;
  outlet?: {
    floor?: string;
    name?: string;
    operatingHours?: string;
    unitNumber?: string;
  };
  reviews?: ReviewItem[];
  verificationStatus?: string;
};

const DEFAULT_OPERATING_HOURS: OperatingHours = {
  monFriStart: "07:00",
  monFriEnd: "15:00",
  monFriClosed: false,
  satStart: "07:00",
  satEnd: "15:00",
  satClosed: false,
  sunStart: "07:00",
  sunEnd: "15:00",
  sunClosed: true,
};

const DEFAULT_MENU_STATS: MenuStats = { total: 0, available: 0, soldOut: 0 };

function parseOperatingHours(value?: string): OperatingHours {
  if (!value) return DEFAULT_OPERATING_HOURS;
  try {
    return { ...DEFAULT_OPERATING_HOURS, ...JSON.parse(value) };
  } catch {
    return DEFAULT_OPERATING_HOURS;
  }
}

const initialReviews: ReviewItem[] = [
  { id: "r1", author: "Wei Ling", rating: 5, text: "The oyster cake is absolutely amazing! Crispy outside, flavourful inside. Queue is worth it.", date: "Today, 10:24am", replied: false },
  { id: "r2", author: "Ahmad Z.", rating: 4, text: "Solid hawker food, very authentic. Wish the seating was a bit closer to the stall.", date: "Yesterday", replied: true, replyText: "Thank you Ahmad! We appreciate the feedback and hope to see you again." },
  { id: "r3", author: "Sarah T.", rating: 5, text: "Best Fuzhou oyster cake in Singapore. Come early or it'll sell out!", date: "3 days ago", replied: false },
];

const activityItems = [
  { id: "a1", icon: <Star size={16} color="var(--color-primary)" />, title: "New 5★ review from Wei Ling", meta: "10 minutes ago" },
  { id: "a2", icon: <UserPlus size={16} color="var(--color-primary)" />, title: "8 new followers this week", meta: "1 hour ago" },
  { id: "a3", icon: <Eye size={16} color="var(--color-primary)" />, title: "Profile views up 18% vs yesterday", meta: "2 hours ago" },
  { id: "a4", icon: <MessageSquare size={16} color="var(--color-primary)" />, title: "Customer question: \"Do you have vegetarian options?\"", meta: "5 hours ago" },
  { id: "a5", icon: <Tag size={16} color="var(--color-primary)" />, title: "Promotion \"Weekend Special\" ended", meta: "Yesterday" },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <span className={styles.reviewStars} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ color: s <= rating ? "#F59E0B" : "var(--color-border-strong)", fontSize: "14px" }}>★</span>
      ))}
    </span>
  );
}

function MiniBarChart({ data, range }: { data: number[]; range: string }) {
  const subset = range === "30d" ? data.slice(-30) : data.slice(-7);
  const max = Math.max(...subset);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; val: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>, idx: number, val: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgEl = e.currentTarget.ownerSVGElement;
    if (!svgEl) return;
    const svgRect = svgEl.getBoundingClientRect();

    // Position tooltip relative to the SVG container
    const x = rect.left - svgRect.left + rect.width / 2;
    const y = rect.top - svgRect.top - 36;

    setHoveredIndex(idx);
    setTooltipPos({ x, y, val });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setTooltipPos(null);
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${subset.length * 14} 60`} style={{ width: "100%", height: "80px" }}>
        {subset.map((v, i) => {
          const h = Math.round((v / max) * 52);
          const isHovered = hoveredIndex === i;
          return (
            <g key={i}>
              <rect
                x={i * 14 + 2}
                y={60 - h}
                width={10}
                height={h}
                fill={isHovered ? "var(--color-primary-dark)" : "var(--color-primary)"}
                opacity={isHovered ? "1" : "0.85"}
                rx={2}
                style={{ transition: "all var(--duration-fast) var(--ease-out)", cursor: "pointer" }}
                onMouseMove={(e) => handleMouseMove(e, i, v)}
                onMouseLeave={handleMouseLeave}
              />
            </g>
          );
        })}
      </svg>

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
            transition: "left 0.1s ease-out, top 0.1s ease-out"
          }}
        >
          <span style={{ fontWeight: 800, color: "var(--color-primary)" }}>{tooltipPos.val}</span>
          <span style={{ opacity: 0.8 }}>Views</span>
        </div>
      )}
    </div>
  );
}

export default function MerchantDashboard() {
  const [chartRange, setChartRange] = useState<"7d" | "30d">("7d");
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoursDialogRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const [operatingHours, setOperatingHours] = useState<OperatingHours>(DEFAULT_OPERATING_HOURS);
  const [menuStats, setMenuStats] = useState<MenuStats>(DEFAULT_MENU_STATS);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [outletTitle, setOutletTitle] = useState<string>("Merchant outlet");
  const [analytics, setAnalytics] = useState({ menuClicks: 0, profileViews: 0, reviewCount: 0 });

  const showToast = (msg: string) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast(msg);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => () => { if (toastRef.current) clearTimeout(toastRef.current); }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/merchant/overview", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await parseMerchantPortalJson<MerchantOverviewApiResponse>(response)) ?? {};
        if (!response.ok) throw new Error(payload?.error ?? "Unable to load merchant dashboard.");
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        const dishes = payload.dishes ?? [];
        setAnalytics(payload.analytics ?? { menuClicks: 0, profileViews: 0, reviewCount: payload.reviews?.length ?? 0 });
        setIsVerified(payload.verificationStatus === "verified");
        setMenuStats({
          available: dishes.filter((dish) => !dish.isSoldOut).length,
          soldOut: dishes.filter((dish) => dish.isSoldOut).length,
          total: dishes.length,
        });
        setOperatingHours(parseOperatingHours(payload.outlet?.operatingHours));
        setOutletTitle(
          [
            payload.outlet?.name ?? "Merchant outlet",
            payload.outlet?.floor,
            payload.outlet?.unitNumber,
          ]
            .filter(Boolean)
            .join(" · "),
        );
        if (payload.reviews) setReviews(payload.reviews);
      })
      .catch((error) => showToast(error instanceof Error ? error.message : "Unable to load merchant dashboard."));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hoursModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHoursModalOpen(false);
        window.setTimeout(() => lastFocusedElementRef.current?.focus(), 0);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => hoursDialogRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [hoursModalOpen]);

  const handleReply = (id: string) => {
    setReviews((prev) =>
      prev.map((r) => r.id === id ? { ...r, replied: true, replyText } : r)
    );
    setReplyingTo(null);
    setReplyText("");
    showToast("Reply posted successfully");
  };

  const openHoursModal = () => {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      lastFocusedElementRef.current = document.activeElement;
    }
    setHoursModalOpen(true);
  };

  const closeHoursModal = () => {
    setHoursModalOpen(false);
    if (typeof window !== "undefined") {
      window.setTimeout(() => lastFocusedElementRef.current?.focus(), 0);
    }
  };

  const handleHoursDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !hoursDialogRef.current) return;

    const focusable = Array.from(
      hoursDialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !element.hasAttribute("aria-hidden"));

    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleSaveHours = async () => {
    try {
      const response = await merchantMutationFetch("/api/merchant/profile", {
        body: JSON.stringify({ operatingHours: JSON.stringify(operatingHours) }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await parseMerchantPortalJson<MerchantOverviewApiResponse>(response)) ?? {};
      if (!response.ok) throw new Error(payload?.error ?? "Unable to update operating hours.");
      closeHoursModal();
      showToast("Operating hours updated successfully");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to update operating hours.");
    }
  };

  const formatHoursDisplay = () => {
    const monFri = operatingHours.monFriClosed ? "Closed" : `${operatingHours.monFriStart}–${operatingHours.monFriEnd}`;
    const sat = operatingHours.satClosed ? "Closed" : `${operatingHours.satStart}–${operatingHours.satEnd}`;
    const sun = operatingHours.sunClosed ? "Closed" : `${operatingHours.sunStart}–${operatingHours.sunEnd}`;
    return `Mon–Fri: ${monFri} | Sat: ${sat} | Sun: ${sun}`;
  };

  const viewData = chartRange === "7d" ? VIEWS_7D : VIEWS_30D.slice(-14);

  return (
    <div>
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Dashboard</h1>
          <p style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "4px" }}>
            {outletTitle}
          </p>
          <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <Clock size={13} style={{ color: "var(--color-primary)" }} /> {formatHoursDisplay()}
          </p>
        </div>
        <Link href="/merchant/menu" className={styles.actionButton}>
          <PenSquare size={15} />
          Edit Menu
        </Link>
      </div>

      {/* KPI grid */}
      <div className={styles.kpiGrid}>
        {[
          { label: "Profile Views", value: analytics.profileViews.toLocaleString(), trend: "Synced from app events", up: true, icon: <Eye size={18} color="var(--color-primary)" /> },
          { label: "Menu Items", value: menuStats.total.toString(), trend: `${menuStats.available} available · ${menuStats.soldOut} sold out`, up: true, icon: <PenSquare size={18} color="var(--color-primary)" /> },
          { label: "Reviews", value: analytics.reviewCount.toString(), trend: "From Hungry reviews", up: true, icon: <Star size={18} color="var(--color-primary)" /> },
          {
            label: "Verification",
            value: isVerified ? "Verified" : "Unverified",
            trend: isVerified ? "Since Mar 2024" : "Action required!",
            up: isVerified,
            icon: isVerified ? <CheckCircle size={18} color="var(--color-success)" /> : <ShieldCheck size={18} color="var(--color-error)" />
          },
        ].map((k) => (
          <div key={k.label} className={styles.kpiCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span className={styles.kpiLabel}>{k.label}</span>
              {k.icon}
            </div>
            <div className={styles.kpiValue} style={{ color: k.label === "Verification" && !isVerified ? "var(--color-error)" : "inherit" }}>
              {k.value}
            </div>
            <div className={`${styles.kpiTrend} ${k.up ? styles.trendUp : styles.trendDown}`}>
              {k.trend}
            </div>
          </div>
        ))}
      </div>

      {/* 7-day chart */}
      <div className={styles.chartWrapper}>
        <div className={styles.chartHeader}>
          <span className={styles.chartTitle}>Profile Views</span>
          <div className={styles.chartRangeGroup}>
            {(["7d", "30d"] as const).map((r) => (
              <button
                key={r}
                className={`${styles.chartRangeBtn} ${chartRange === r ? styles.chartRangeBtnActive : ""}`}
                onClick={() => setChartRange(r)}
              >
                {r === "7d" ? "7 Days" : "30 Days"}
              </button>
            ))}
          </div>
        </div>
        <MiniBarChart data={viewData} range={chartRange} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
          {chartRange === "7d"
            ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"].map((d) => <span key={d}>{d}</span>)
            : null}
        </div>
      </div>

      <div className={styles.dashboardSplitGrid}>
        {/* Activity feed */}
        <div>
          <div className={styles.dashboardSectionCard}>
            <div className={styles.sectionHeaderRow}>
              <h2>Recent Activity</h2>
            </div>
            <div className={styles.activityFeed}>
              {activityItems.map((a) => (
                <div key={a.id} className={styles.activityItem}>
                  <div className={styles.activityIcon}>{a.icon}</div>
                  <div className={styles.activityContent}>
                    <div className={styles.activityTitle}>{a.title}</div>
                    <div className={styles.activityMeta}>{a.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent reviews */}
          <div className={styles.dashboardSectionCard}>
            <div className={styles.sectionHeaderRow}>
              <h2>Recent Reviews</h2>
              <Link href="/merchant/reviews" style={{ fontSize: "var(--font-size-xs)", color: "var(--color-primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {reviews.slice(0, 3).map((r) => (
              <div key={r.id} className={styles.reviewItem}>
                <div className={styles.reviewHeader}>
                  <span className={styles.reviewAuthor}>{r.author}</span>
                  <StarRating rating={r.rating} />
                  <span className={styles.reviewDate}>{r.date}</span>
                </div>
                <p className={styles.reviewText}>{r.text}</p>
                {r.replied && r.replyText && (
                  <div className={styles.reviewReplied}>
                    <strong>Your reply: </strong>{r.replyText}
                  </div>
                )}
                {!r.replied && (
                  replyingTo === r.id ? (
                    <div className={styles.replyBox}>
                      <textarea
                        className={styles.formTextarea}
                        placeholder="Write your reply..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={3}
                        autoFocus
                      />
                      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                        <button className={styles.actionButtonSecondary} onClick={() => { setReplyingTo(null); setReplyText(""); }}>Cancel</button>
                        <button className={styles.actionButton} disabled={!replyText.trim()} onClick={() => handleReply(r.id)}>
                          <CheckCircle size={14} /> Submit Reply
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className={styles.rowAction} onClick={() => { setReplyingTo(r.id); setReplyText(""); }}>
                      <MessageSquare size={12} /> Reply
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <div className={styles.dashboardSectionCard}>
            <div className={styles.sectionHeaderRow}>
              <h2>Quick Actions</h2>
            </div>
            <div className={styles.quickActionsGrid}>
              <Link href="/merchant/menu" className={styles.quickActionCard}>
                <PenSquare size={20} color="var(--color-primary)" />
                <h4>Edit Menu</h4>
              </Link>
              <button type="button" className={styles.quickActionCard} onClick={openHoursModal}>
                <Clock size={20} color="var(--color-primary)" />
                <h4>Update Hours</h4>
              </button>
              <Link href="/merchant/promotions" className={styles.quickActionCard}>
                <Tag size={20} color="var(--color-primary)" />
                <h4>Build Promotion</h4>
              </Link>
              <Link href="/merchant/analytics" className={styles.quickActionCard}>
                <BarChart2 size={20} color="var(--color-primary)" />
                <h4>View Analytics</h4>
              </Link>
            </div>
          </div>

          {/* Performance snapshot */}
          <div className={styles.dashboardSectionCard}>
            <div className={styles.sectionHeaderRow}>
              <h2>This Week</h2>
            </div>
            {[
              { label: "Total Profile Views", value: "712", delta: "+12%" },
              { label: "Menu Item Clicks", value: "238", delta: "+8%" },
              { label: "Search Appearances", value: "1,041", delta: "+22%" },
              { label: "New Favourites", value: "17", delta: "+5%" },
            ].map((s) => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border)" }}>
                <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>{s.label}</span>
                <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>{s.value}</span>
                  <span className={`${styles.statDelta} ${styles.statDeltaUp}`}>
                    <TrendingUp size={10} />{s.delta}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Update Hours modal */}
      {hoursModalOpen && (
        <div className={styles.modalOverlay} onClick={closeHoursModal}>
          <div
            ref={hoursDialogRef}
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleHoursDialogKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="merchant-hours-dialog-title"
            tabIndex={-1}
            style={{ maxWidth: "500px" }}
          >
            <div className={styles.modalHeader}>
              <h3 id="merchant-hours-dialog-title">Update Operating Hours</h3>
            </div>
            <div className={styles.modalBody}>
              {/* Mon-Fri */}
              <div style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)" }}>Monday – Friday</span>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--font-size-xs)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={operatingHours.monFriClosed}
                      onChange={(e) => setOperatingHours(prev => ({ ...prev, monFriClosed: e.target.checked }))}
                    />
                    Mark Closed
                  </label>
                </div>
                {!operatingHours.monFriClosed && (
                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                    <input
                      type="time"
                      value={operatingHours.monFriStart}
                      onChange={(e) => setOperatingHours(prev => ({ ...prev, monFriStart: e.target.value }))}
                      className={styles.formInput}
                      style={{ width: "100%", margin: 0 }}
                    />
                    <span style={{ color: "var(--color-text-muted)" }}>to</span>
                    <input
                      type="time"
                      value={operatingHours.monFriEnd}
                      onChange={(e) => setOperatingHours(prev => ({ ...prev, monFriEnd: e.target.value }))}
                      className={styles.formInput}
                      style={{ width: "100%", margin: 0 }}
                    />
                  </div>
                )}
              </div>

              {/* Saturday */}
              <div style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)" }}>Saturday</span>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--font-size-xs)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={operatingHours.satClosed}
                      onChange={(e) => setOperatingHours(prev => ({ ...prev, satClosed: e.target.checked }))}
                    />
                    Mark Closed
                  </label>
                </div>
                {!operatingHours.satClosed && (
                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                    <input
                      type="time"
                      value={operatingHours.satStart}
                      onChange={(e) => setOperatingHours(prev => ({ ...prev, satStart: e.target.value }))}
                      className={styles.formInput}
                      style={{ width: "100%", margin: 0 }}
                    />
                    <span style={{ color: "var(--color-text-muted)" }}>to</span>
                    <input
                      type="time"
                      value={operatingHours.satEnd}
                      onChange={(e) => setOperatingHours(prev => ({ ...prev, satEnd: e.target.value }))}
                      className={styles.formInput}
                      style={{ width: "100%", margin: 0 }}
                    />
                  </div>
                )}
              </div>

              {/* Sunday */}
              <div style={{ paddingBottom: "var(--space-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)" }}>Sunday</span>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--font-size-xs)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={operatingHours.sunClosed}
                      onChange={(e) => setOperatingHours(prev => ({ ...prev, sunClosed: e.target.checked }))}
                    />
                    Mark Closed
                  </label>
                </div>
                {!operatingHours.sunClosed && (
                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                    <input
                      type="time"
                      value={operatingHours.sunStart}
                      onChange={(e) => setOperatingHours(prev => ({ ...prev, sunStart: e.target.value }))}
                      className={styles.formInput}
                      style={{ width: "100%", margin: 0 }}
                    />
                    <span style={{ color: "var(--color-text-muted)" }}>to</span>
                    <input
                      type="time"
                      value={operatingHours.sunEnd}
                      onChange={(e) => setOperatingHours(prev => ({ ...prev, sunEnd: e.target.value }))}
                      className={styles.formInput}
                      style={{ width: "100%", margin: 0 }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionButtonSecondary} onClick={closeHoursModal}>Cancel</button>
              <button className={styles.actionButton} onClick={handleSaveHours}>
                <CheckCircle size={14} /> Save Hours
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${styles.toastSuccess}`}>
          <CheckCircle size={16} />{toast}
        </div>
      )}
    </div>
  );
}
