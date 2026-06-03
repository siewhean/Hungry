"use client";

import React, { useState } from "react";
import {
  Bell,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Store,
  Megaphone,
  Plus,
  ChevronDown,
  Eye,
  Trash2,
} from "lucide-react";
import styles from "../console.module.css";

type NotifStatus = "draft" | "scheduled" | "sent" | "cancelled" | "failed";
type NotifType =
  | "push_app_wide"
  | "push_targeted"
  | "in_app_banner"
  | "in_app_modal"
  | "activity_feed"
  | "merchant_announcement";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: NotifType;
  audience: string;
  estimatedReach: number;
  status: NotifStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  openRate: number | null;
  createdBy: string;
}

let notificationIdSequence = 47;

function nextNotificationId() {
  notificationIdSequence += 1;
  return `N-00${notificationIdSequence}`;
}

const mockNotifications: Notification[] = [
  {
    id: "N-0041",
    title: "Discover New Hawker Stalls Near You 🍜",
    body: "10 new stalls have joined Hungry in your area. Tap to explore what's fresh.",
    type: "push_targeted",
    audience: "Users within 2km of new stalls",
    estimatedReach: 4200,
    status: "sent",
    scheduledFor: null,
    sentAt: "Yesterday, 12:00 PM",
    openRate: 34.2,
    createdBy: "hean@hungry.sg",
  },
  {
    id: "N-0042",
    title: "Weekend Feature: Chinatown Food Crawl 🏮",
    body: "This weekend, explore curated hawker gems in Chinatown. New dishes added daily.",
    type: "push_app_wide",
    audience: "All active users",
    estimatedReach: 14800,
    status: "scheduled",
    scheduledFor: "Sat, 7 Jun 2025 · 9:00 AM",
    sentAt: null,
    openRate: null,
    createdBy: "hean@hungry.sg",
  },
  {
    id: "N-0043",
    title: "Your stall profile needs attention",
    body: "Your profile is missing opening hours. Update now to improve your discovery.",
    type: "merchant_announcement",
    audience: "Merchants with incomplete profiles",
    estimatedReach: 38,
    status: "sent",
    scheduledFor: null,
    sentAt: "3 days ago, 10:00 AM",
    openRate: 62.1,
    createdBy: "hean@hungry.sg",
  },
  {
    id: "N-0044",
    title: "Maintenance Notice — App Update Required",
    body: "A required app update is available. Please update to continue using Hungry.",
    type: "in_app_modal",
    audience: "Users on app version < 2.8",
    estimatedReach: 892,
    status: "sent",
    scheduledFor: null,
    sentAt: "Last week",
    openRate: 88.0,
    createdBy: "dev@hungry.sg",
  },
  {
    id: "N-0045",
    title: "Taste Quiz Results — Your Food Profile Updated",
    body: "Based on your recent activity, we've refined your taste profile. Tap to see what changed.",
    type: "in_app_banner",
    audience: "Users who completed onboarding this week",
    estimatedReach: 312,
    status: "draft",
    scheduledFor: null,
    sentAt: null,
    openRate: null,
    createdBy: "hean@hungry.sg",
  },
  {
    id: "N-0046",
    title: "Flash Promo: Toa Payoh Stalls (Test)",
    body: "Test campaign — internal preview only.",
    type: "push_targeted",
    audience: "Internal team only",
    estimatedReach: 5,
    status: "cancelled",
    scheduledFor: null,
    sentAt: null,
    openRate: null,
    createdBy: "dev@hungry.sg",
  },
];

const statusConfig: Record<
  NotifStatus,
  { label: string; bg: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: "Draft",
    bg: "#F3F4F6",
    color: "#374151",
    icon: <Clock size={12} />,
  },
  scheduled: {
    label: "Scheduled",
    bg: "#EBF5FF",
    color: "#1E40AF",
    icon: <Clock size={12} />,
  },
  sent: {
    label: "Sent",
    bg: "#ECFDF5",
    color: "#065F46",
    icon: <CheckCircle size={12} />,
  },
  cancelled: {
    label: "Cancelled",
    bg: "#FEF3C7",
    color: "#92400E",
    icon: <XCircle size={12} />,
  },
  failed: {
    label: "Failed",
    bg: "#FEE2E2",
    color: "#991B1B",
    icon: <AlertTriangle size={12} />,
  },
};

const typeConfig: Record<
  NotifType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  push_app_wide: {
    label: "Push — App-Wide",
    icon: <Megaphone size={14} />,
    color: "#7C3AED",
  },
  push_targeted: {
    label: "Push — Targeted",
    icon: <Bell size={14} />,
    color: "#2563EB",
  },
  in_app_banner: {
    label: "In-App Banner",
    icon: <Eye size={14} />,
    color: "#0891B2",
  },
  in_app_modal: {
    label: "In-App Modal",
    icon: <AlertTriangle size={14} />,
    color: "#D97706",
  },
  activity_feed: {
    label: "Activity Feed",
    icon: <Users size={14} />,
    color: "#059669",
  },
  merchant_announcement: {
    label: "Merchant Announcement",
    icon: <Store size={14} />,
    color: "#EA580C",
  },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [filterStatus, setFilterStatus] = useState<NotifStatus | "all">("all");
  const [showCompose, setShowCompose] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Draft compose state
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftType, setDraftType] = useState<NotifType>("push_targeted");
  const [draftAudience, setDraftAudience] = useState("targeted_nearby");

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveDraft = () => {
    if (!draftTitle.trim() || !draftBody.trim()) {
      showToast("Title and Body are required", "error");
      return;
    }
    const newNotif: Notification = {
      id: nextNotificationId(),
      title: draftTitle,
      body: draftBody,
      type: draftType,
      audience: draftAudience === "all_foodies" ? "All active users" : 
                draftAudience === "all_merchants" ? "All merchants" : 
                draftAudience === "incomplete_profiles" ? "Merchants with incomplete profiles" :
                draftAudience === "internal" ? "Internal team only" : "Users near new stalls",
      estimatedReach: draftAudience === "all_foodies" ? 14800 : 
                      draftAudience === "all_merchants" ? 342 : 
                      draftAudience === "incomplete_profiles" ? 38 :
                      draftAudience === "internal" ? 5 : 4200,
      status: "draft",
      scheduledFor: null,
      sentAt: null,
      openRate: null,
      createdBy: "hean@hungry.sg",
    };
    setNotifications(prev => [newNotif, ...prev]);
    showToast("Notification draft saved", "success");
    setShowCompose(false);
    resetForm();
  };

  const handlePublishNow = () => {
    if (!draftTitle.trim() || !draftBody.trim()) {
      showToast("Title and Body are required", "error");
      return;
    }
    const newNotif: Notification = {
      id: nextNotificationId(),
      title: draftTitle,
      body: draftBody,
      type: draftType,
      audience: draftAudience === "all_foodies" ? "All active users" : 
                draftAudience === "all_merchants" ? "All merchants" : 
                draftAudience === "incomplete_profiles" ? "Merchants with incomplete profiles" :
                draftAudience === "internal" ? "Internal team only" : "Users near new stalls",
      estimatedReach: draftAudience === "all_foodies" ? 14800 : 
                      draftAudience === "all_merchants" ? 342 : 
                      draftAudience === "incomplete_profiles" ? 38 :
                      draftAudience === "internal" ? 5 : 4200,
      status: "sent",
      scheduledFor: null,
      sentAt: "Just now",
      openRate: 0,
      createdBy: "hean@hungry.sg",
    };
    setNotifications(prev => [newNotif, ...prev]);
    showToast("Notification sent successfully", "success");
    setShowCompose(false);
    resetForm();
  };

  const resetForm = () => {
    setDraftTitle("");
    setDraftBody("");
    setDraftType("push_targeted");
    setDraftAudience("targeted_nearby");
  };

  const handleSchedule = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, status: "scheduled", scheduledFor: "Scheduled for tomorrow, 9:00 AM" } : n)
    );
    showToast("Campaign scheduled successfully", "success");
  };

  const handleCancel = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, status: "cancelled", scheduledFor: null } : n)
    );
    showToast("Scheduled campaign cancelled", "info");
  };

  const handleDelete = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    showToast("Draft deleted successfully", "error");
  };

  const filtered = notifications.filter(
    (n) => filterStatus === "all" || n.status === filterStatus
  );

  const sentCount = notifications.filter((n) => n.status === "sent").length;
  const scheduledCount = notifications.filter(
    (n) => n.status === "scheduled"
  ).length;
  const avgOpenRate =
    notifications
      .filter((n) => n.openRate !== null)
      .reduce((sum, n) => sum + (n.openRate ?? 0), 0) /
    (notifications.filter((n) => n.openRate !== null).length || 1);

  return (
    <div>
      {/* HEADER */}
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Notifications & Messaging</h1>
          <p>
            Draft, schedule, and monitor push notifications, in-app banners, and
            merchant announcements.
          </p>
        </div>
        <button
          className={styles.actionButton}
          onClick={() => setShowCompose(true)}
          id="compose-notification-btn"
        >
          <Plus size={16} />
          Compose Notification
        </button>
      </div>

      {/* KPI */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Campaigns</span>
          <span className={styles.kpiValue}>{notifications.length}</span>
          <span className={`${styles.kpiTrend} ${styles.trendNeutral}`}>
            All-time
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Sent</span>
          <span className={styles.kpiValue} style={{ color: "#059669" }}>
            {sentCount}
          </span>
          <span className={`${styles.kpiTrend} ${styles.trendUp}`}>
            Delivered
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Scheduled</span>
          <span className={styles.kpiValue} style={{ color: "#3B82F6" }}>
            {scheduledCount}
          </span>
          <span className={`${styles.kpiTrend} ${styles.trendNeutral}`}>
            Pending send
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Avg Open Rate</span>
          <span className={styles.kpiValue} style={{ color: "#7C3AED" }}>
            {avgOpenRate.toFixed(1)}%
          </span>
          <span className={`${styles.kpiTrend} ${styles.trendUp}`}>
            Across sent campaigns
          </span>
        </div>
      </div>

      {/* APP-WIDE NOTICE */}
      <div
        className={styles.alertBanner}
        style={{
          borderLeftColor: "#7C3AED",
          backgroundColor: "#F5F3FF",
          marginBottom: "var(--space-6)",
        }}
      >
        <div className={styles.alertContent}>
          <Megaphone size={20} style={{ color: "#7C3AED", flexShrink: 0 }} />
          <div className={styles.alertText}>
            <h4>App-wide push notifications require 2-step approval</h4>
            <p>
              Any notification sent to all users must be confirmed by a second
              admin. Draft and preview before submitting for approval.
            </p>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className={styles.dashboardSectionCard}>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
          {(["all", "draft", "scheduled", "sent", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={styles.analyticsTab}
              style={{
                color:
                  filterStatus === s
                    ? "var(--color-primary)"
                    : "var(--color-text-secondary)",
                cursor: "pointer",
                background: "none",
                border: "none",
                borderBottom:
                  filterStatus === s
                    ? "2px solid var(--color-primary)"
                    : "2px solid transparent",
                paddingBottom: "var(--space-2)",
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== "all" && (
                <span
                  style={{
                    marginLeft: "6px",
                    fontSize: "0.65rem",
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  ({notifications.filter((n) => n.status === s).length})
                </span>
              )}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
            {filtered.length} campaign{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* NOTIFICATION LIST */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {filtered.map((notif) => {
          const sCfg = statusConfig[notif.status];
          const tCfg = typeConfig[notif.type];
          return (
            <div
              key={notif.id}
              className={styles.dashboardSectionCard}
              style={{ marginBottom: 0 }}
            >
              <div style={{ display: "flex", gap: "var(--space-5)", flexWrap: "wrap", alignItems: "flex-start" }}>
                {/* Type icon */}
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "var(--radius-lg)",
                    backgroundColor: tCfg.color + "18",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: tCfg.color,
                  }}
                >
                  {tCfg.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: "700", fontSize: "var(--font-size-md)", color: "var(--color-text-primary)", flex: 1 }}>
                      {notif.title}
                    </span>
                    <span
                      className={styles.badge}
                      style={{
                        backgroundColor: sCfg.bg,
                        color: sCfg.color,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {sCfg.icon}
                      {sCfg.label}
                    </span>
                  </div>
                  <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginTop: "var(--space-1)", lineHeight: 1.5 }}>
                    {notif.body}
                  </p>

                  <div
                    style={{
                      marginTop: "var(--space-3)",
                      display: "flex",
                      gap: "var(--space-5)",
                      flexWrap: "wrap",
                      fontSize: "var(--font-size-xs)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "4px", color: tCfg.color }}>
                      {tCfg.icon}
                      {tCfg.label}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Users size={11} />
                      {notif.estimatedReach.toLocaleString()} reach · {notif.audience}
                    </span>
                    {notif.scheduledFor && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={11} />
                        Scheduled: {notif.scheduledFor}
                      </span>
                    )}
                    {notif.sentAt && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Send size={11} />
                        Sent: {notif.sentAt}
                      </span>
                    )}
                    {notif.openRate !== null && (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontWeight: "700",
                          color: notif.openRate > 50 ? "#059669" : "var(--color-text-muted)",
                        }}
                      >
                        Open rate: {notif.openRate}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
                  {notif.status === "draft" && (
                    <button 
                      className={styles.actionButton} 
                      style={{ fontSize: "var(--font-size-xs)", padding: "var(--space-2) var(--space-4)" }}
                      onClick={() => handleSchedule(notif.id)}
                    >
                      <Send size={12} />
                      Schedule
                    </button>
                  )}
                  {notif.status === "scheduled" && (
                    <button 
                      className={styles.actionButtonDanger} 
                      style={{ fontSize: "var(--font-size-xs)", padding: "var(--space-2) var(--space-4)" }}
                      onClick={() => handleCancel(notif.id)}
                    >
                      <XCircle size={12} />
                      Cancel
                    </button>
                  )}
                  {(notif.status === "draft" || notif.status === "cancelled") && (
                    <button
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "36px",
                        height: "36px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid #FCA5A5",
                        backgroundColor: "#FEF2F2",
                        cursor: "pointer",
                        color: "#DC2626",
                      }}
                      title="Delete draft"
                      onClick={() => handleDelete(notif.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div
                style={{
                  marginTop: "var(--space-3)",
                  paddingTop: "var(--space-2)",
                  borderTop: "1px solid var(--color-border)",
                  fontSize: "0.65rem",
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                ID: {notif.id} · Created by {notif.createdBy}
              </div>
            </div>
          );
        })}
      </div>

      {/* COMPOSE MODAL */}
      {showCompose && (
        <div className={styles.modalOverlay} onClick={() => setShowCompose(false)}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "560px" }}
          >
            <div className={styles.modalHeader}>
              <h3>Compose Notification</h3>
              <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>
                Draft a push notification or in-app message for review.
              </p>
            </div>

            <div className={styles.modalBody}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div>
                  <label style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "var(--space-2)" }}>
                    Notification Type
                  </label>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0 var(--space-3)", height: "44px" }}>
                    <select
                      value={draftType}
                      onChange={(e) => setDraftType(e.target.value as NotifType)}
                      style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "var(--font-size-sm)", color: "var(--color-text-primary)" }}
                    >
                      <option value="push_targeted">Push — Targeted</option>
                      <option value="push_app_wide">Push — App-Wide (requires approval)</option>
                      <option value="in_app_banner">In-App Banner</option>
                      <option value="in_app_modal">In-App Modal</option>
                      <option value="merchant_announcement">Merchant Announcement</option>
                      <option value="activity_feed">Activity Feed</option>
                    </select>
                    <ChevronDown size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "var(--space-2)" }}>
                    Title
                  </label>
                  <input
                    type="text"
                    placeholder="Notification title..."
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-3) var(--space-4)",
                      fontSize: "var(--font-size-sm)",
                      outline: "none",
                      fontFamily: "var(--font-body)",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "var(--space-2)" }}>
                    Body
                  </label>
                  <textarea
                    placeholder="Notification body..."
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    rows={3}
                    style={{
                      width: "100%",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-3) var(--space-4)",
                      fontSize: "var(--font-size-sm)",
                      outline: "none",
                      resize: "vertical",
                      fontFamily: "var(--font-body)",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "var(--space-2)" }}>
                    Audience
                  </label>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "0 var(--space-3)", height: "44px" }}>
                    <select
                      value={draftAudience}
                      onChange={(e) => setDraftAudience(e.target.value)}
                      style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "var(--font-size-sm)", color: "var(--color-text-primary)" }}
                    >
                      <option value="targeted_nearby">Users near new stalls</option>
                      <option value="all_foodies">All active foodie users</option>
                      <option value="all_merchants">All merchants</option>
                      <option value="incomplete_profiles">Merchants with incomplete profiles</option>
                      <option value="internal">Internal team only</option>
                      <option value="taste_match">Taste-match users</option>
                    </select>
                    <ChevronDown size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                  </div>
                </div>

                {draftType === "push_app_wide" && (
                  <div
                    style={{
                      backgroundColor: "#FEF3C7",
                      border: "1px solid #F59E0B",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-3) var(--space-4)",
                      fontSize: "var(--font-size-xs)",
                      color: "#92400E",
                      display: "flex",
                      gap: "var(--space-2)",
                    }}
                  >
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
                    <span>App-wide push notifications require approval from a second admin before sending.</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
              <button
                className={styles.actionButtonSecondary}
                onClick={() => setShowCompose(false)}
              >
                Cancel
              </button>
              <button className={styles.actionButtonSecondary} onClick={handleSaveDraft}>
                <Clock size={14} />
                Save as Draft
              </button>
              <button className={styles.actionButton} onClick={handlePublishNow}>
                <Send size={14} />
                Publish Now
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${styles[`toast${toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}`]}`}>
          <CheckCircle size={16} />
          {toast.message}
        </div>
      )}
    </div>
  );
}
