"use client";

import React, { useState } from "react";
import {
  Search,
  User,
  Star,
  Ban,
  MessageSquare,
  Flag,
  ShieldAlert,
  CheckCircle,
  Download,
} from "lucide-react";
import { readConsolePrototypeStorage, writeConsolePrototypeStorage } from "@/lib/console/prototypeStorage";
import styles from "../console.module.css";

type AccountStatus = "active" | "warned" | "suspended" | "deleted";

interface AppUser {
  id: string;
  displayName: string;
  email: string;
  platform: "iOS" | "Android";
  appVersion: string;
  accountStatus: AccountStatus;
  reviewCount: number;
  postCount: number;
  reportsMade: number;
  reportsAgainst: number;
  joinedDate: string;
  lastActive: string;
  tasteProfile: string[];
  stallCount: number;
  foodCred?: number;
}

const initialUsers: AppUser[] = [
  { id: "U-10044", displayName: "wei_ming_eats", email: "wei.ming@gmail.com", platform: "iOS", appVersion: "2.10.4", accountStatus: "active", reviewCount: 87, postCount: 34, reportsMade: 2, reportsAgainst: 0, joinedDate: "Jan 2024", lastActive: "Today", tasteProfile: ["Spicy", "Aromatic", "Sour"], stallCount: 12, foodCred: 480 },
  { id: "U-10091", displayName: "sarah_foodie_sg", email: "sarah.tan@outlook.com", platform: "iOS", appVersion: "2.10.4", accountStatus: "active", reviewCount: 43, postCount: 18, reportsMade: 0, reportsAgainst: 0, joinedDate: "Feb 2024", lastActive: "Yesterday", tasteProfile: ["Sweet", "Rich"], stallCount: 7, foodCred: 250 },
  { id: "U-10223", displayName: "ahmad.rider97", email: "ahmad.delivery@proton.me", platform: "Android", appVersion: "2.9.1", accountStatus: "active", reviewCount: 12, postCount: 5, reportsMade: 1, reportsAgainst: 0, joinedDate: "Mar 2024", lastActive: "2 days ago", tasteProfile: ["Salty", "Spicy"], stallCount: 3, foodCred: 120 },
  { id: "U-09987", displayName: "spamuser_flagged", email: "spamtest9912@yopmail.com", platform: "Android", appVersion: "2.8.0", accountStatus: "warned", reviewCount: 4, postCount: 2, reportsMade: 0, reportsAgainst: 3, joinedDate: "Apr 2024", lastActive: "5 days ago", tasteProfile: [], stallCount: 0, foodCred: 15 },
  { id: "U-08821", displayName: "wei_ling_family", email: "wl.family@singtel.com", platform: "iOS", appVersion: "2.10.4", accountStatus: "active", reviewCount: 29, postCount: 11, reportsMade: 0, reportsAgainst: 0, joinedDate: "Dec 2023", lastActive: "Today", tasteProfile: ["Sweet", "Salty", "Rich"], stallCount: 5, foodCred: 310 },
  { id: "U-07412", displayName: "old_account_2022", email: "oldacct@live.com", platform: "iOS", appVersion: "1.9.0", accountStatus: "suspended", reviewCount: 1, postCount: 0, reportsMade: 0, reportsAgainst: 7, joinedDate: "Oct 2022", lastActive: "3 months ago", tasteProfile: [], stallCount: 0, foodCred: 0 },
];

const accountStatusConfig: Record<AccountStatus, { label: string; bg: string; color: string }> = {
  active: { label: "Active", bg: "#ECFDF5", color: "#065F46" },
  warned: { label: "Warned", bg: "#FEF3C7", color: "#92400E" },
  suspended: { label: "Suspended", bg: "#FEE2E2", color: "#991B1B" },
  deleted: { label: "Deleted", bg: "#F3F4F6", color: "#374151" },
};

const TASTE_AXES = ["Sweet", "Spicy", "Sour", "Salty", "Rich", "Aromatic"];

type TabFilter = "all" | "active" | "warned" | "suspended";

export default function UsersPage() {
  const [users, setUsers] = React.useState<AppUser[]>(() => {
    return readConsolePrototypeStorage("console_users", initialUsers);
  });

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AppUser | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Expanded Row Editor states
  const [editFoodCred, setEditFoodCred] = useState<number>(0);
  const [editReportsAgainst, setEditReportsAgainst] = useState<number>(0);
  const [editReportsMade, setEditReportsMade] = useState<number>(0);

  const saveUsers = (updated: AppUser[]) => {
    setUsers(updated);
    writeConsolePrototypeStorage("console_users", updated);
  };

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenExpand = (user: AppUser) => {
    if (expandedId === user.id) {
      setExpandedId(null);
    } else {
      setExpandedId(user.id);
      setEditFoodCred(user.foodCred || 0);
      setEditReportsAgainst(user.reportsAgainst);
      setEditReportsMade(user.reportsMade);
    }
  };

  const handleUpdateUserMetrics = (userId: string) => {
    const updated = users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          foodCred: editFoodCred,
          reportsAgainst: editReportsAgainst,
          reportsMade: editReportsMade
        };
      }
      return u;
    });
    saveUsers(updated);
    showToast("User metrics updated statefully", "success");
  };

  const handleWarn = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = users.map((u) => (u.id === id ? { ...u, accountStatus: "warned" as AccountStatus } : u));
    saveUsers(updated);
    showToast(`Warning issued to ${name}`, "info");
  };

  const handleUnsuspend = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = users.map((u) => (u.id === id ? { ...u, accountStatus: "active" as AccountStatus } : u));
    saveUsers(updated);
    showToast("Account activated successfully", "success");
  };

  const confirmSuspend = () => {
    if (!suspendTarget) return;
    const updated = users.map((u) => (u.id === suspendTarget.id ? { ...u, accountStatus: "suspended" as AccountStatus } : u));
    saveUsers(updated);
    showToast(`${suspendTarget.displayName} has been suspended`, "error");
    setSuspendTarget(null);
  };

  const handleExport = () => {
    showToast("Exporting user list...", "info");
  };

  const filtered = users.filter((u) => {
    const matchSearch =
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === "all" || u.accountStatus === activeTab;
    return matchSearch && matchTab;
  });

  const activeCount = users.filter((u) => u.accountStatus === "active").length;
  const warnedCount = users.filter((u) => u.accountStatus === "warned").length;
  const suspendedCount = users.filter((u) => u.accountStatus === "suspended").length;

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: users.length },
    { key: "active", label: "Active", count: activeCount },
    { key: "warned", label: "Warned", count: warnedCount },
    { key: "suspended", label: "Suspended", count: suspendedCount },
  ];

  return (
    <div>
      {/* HEADER */}
      <div className={styles.headerTitleArea}>
        <div>
          <h1>User Management</h1>
          <p>Search and manage foodie user accounts, taste profiles, review history, and trust actions.</p>
        </div>
        <button className={styles.actionButtonSecondary} onClick={handleExport}>
          <Download size={14} /> Export
        </button>
      </div>

      {/* KPI CARDS */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Users</span>
          <span className={styles.kpiValue}>{users.length}</span>
          <span className={`${styles.kpiTrend} ${styles.trendNeutral}`}>Mock dataset</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Active</span>
          <span className={styles.kpiValue} style={{ color: "#059669" }}>{activeCount}</span>
          <span className={`${styles.kpiTrend} ${styles.trendUp}`}>{Math.round((activeCount / users.length) * 100)}% healthy</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Warned</span>
          <span className={styles.kpiValue} style={{ color: "#F59E0B" }}>{warnedCount}</span>
          <span className={`${styles.kpiTrend} ${styles.trendNeutral}`}>Trust watchlist</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Suspended</span>
          <span className={styles.kpiValue} style={{ color: "#EF4444" }}>{suspendedCount}</span>
          <span className={`${styles.kpiTrend} ${styles.trendDown}`}>Requires review</span>
        </div>
      </div>

      {/* TAB NAV + SEARCH */}
      <div className={styles.dashboardSectionCard}>
        <div className={styles.tabNav} style={{ marginBottom: "var(--space-4)" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`${styles.tabNavItem} ${activeTab === t.key ? styles.tabNavItemActive : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              <span style={{ marginLeft: "6px", fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
                ({t.count})
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
          <div className={styles.filterSearchWrapper} style={{ flex: "1 1 220px", maxWidth: "360px" }}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by username, email, or ID..."
              className={styles.filterSearchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginLeft: "auto" }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* USER TABLE */}
      <div className={styles.dashboardSectionCard} style={{ padding: 0, overflow: "hidden" }}>
        <div className={styles.queueTableWrapper}>
          <table className={styles.queueTable}>
            <thead>
              <tr>
                <th>User</th>
                <th>Platform</th>
                <th>Reviews</th>
                <th>Posts</th>
                <th>Reports Against</th>
                <th>Status</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const statusCfg = accountStatusConfig[user.accountStatus] || accountStatusConfig.active;
                return (
                  <React.Fragment key={user.id}>
                    <tr
                      style={{ cursor: "pointer" }}
                      onClick={() => handleOpenExpand(user)}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "var(--color-bg-warm)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <User size={16} style={{ color: "var(--color-primary)" }} />
                          </div>
                          <div>
                            <div style={{ fontWeight: "700", fontSize: "var(--font-size-sm)" }}>{user.displayName}</div>
                            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                              {user.id} · {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={styles.badge} style={{ backgroundColor: user.platform === "iOS" ? "#EBF5FF" : "#ECFDF5", color: user.platform === "iOS" ? "#1E40AF" : "#065F46" }}>
                          {user.platform}
                        </span>
                        <div style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>v{user.appVersion}</div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Star size={12} style={{ color: "#F59E0B" }} />
                          <span style={{ fontWeight: "700" }}>{user.reviewCount}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <MessageSquare size={12} style={{ color: "var(--color-text-muted)" }} />
                          <span>{user.postCount}</span>
                        </div>
                      </td>
                      <td>
                        {user.reportsAgainst > 0 ? (
                          <span className={styles.badge} style={{ backgroundColor: user.reportsAgainst >= 3 ? "#FEE2E2" : "#FEF3C7", color: user.reportsAgainst >= 3 ? "#991B1B" : "#92400E" }}>
                            <Flag size={11} />{user.reportsAgainst}
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={styles.badge} style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>{user.lastActive}</td>
                      <td>
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                          {user.accountStatus !== "warned" && user.accountStatus !== "suspended" && (
                            <button
                              className={styles.rowAction}
                              title="Warn user"
                              onClick={(e) => handleWarn(user.id, user.displayName, e)}
                            >
                              <ShieldAlert size={13} />
                            </button>
                          )}
                          {user.accountStatus === "suspended" ? (
                            <button
                              className={styles.rowAction}
                              style={{ color: "var(--color-success)", borderColor: "var(--color-success)" }}
                              title="Activate user"
                              onClick={(e) => handleUnsuspend(user.id, e)}
                            >
                              <CheckCircle size={13} />
                            </button>
                          ) : (
                            <button
                              title="Suspend account"
                              className={styles.rowActionDanger}
                              onClick={(e) => { e.stopPropagation(); setSuspendTarget(user); }}
                            >
                              <Ban size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {expandedId === user.id && (
                      <tr>
                        <td colSpan={8} style={{ backgroundColor: "var(--color-bg-soft)", padding: "var(--space-4) var(--space-6)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-6)" }}>
                            {/* Taste profile bars */}
                            <div>
                              <div style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "var(--space-3)" }}>
                                Taste Profile
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                                {TASTE_AXES.map((axis) => {
                                  const val = user.tasteProfile.includes(axis) ? 80 : 15;
                                  return (
                                    <div key={axis} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", fontSize: "var(--font-size-xs)" }}>
                                      <span style={{ width: "60px", color: "var(--color-text-secondary)" }}>{axis}</span>
                                      <div style={{ width: "100px", height: "6px", backgroundColor: "var(--color-border)", borderRadius: "3px", overflow: "hidden" }}>
                                        <div style={{ width: `${val}%`, height: "100%", backgroundColor: "var(--color-primary)", borderRadius: "3px" }} />
                                      </div>
                                      <span style={{ color: "var(--color-text-muted)" }}>{val}%</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Loyalty & Gamification (FoodCred) */}
                            <div>
                              <div style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "var(--space-3)" }}>
                                Loyalty & Gamification
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div>
                                  <label style={{ display: "block", fontSize: "10px", color: "var(--color-text-muted)", fontWeight: "bold", marginBottom: "4px" }}>FoodCred Balance</label>
                                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                    <input 
                                      type="number"
                                      value={editFoodCred}
                                      onChange={(e) => setEditFoodCred(parseInt(e.target.value) || 0)}
                                      style={{ width: "90px", padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-bg)", fontSize: "var(--font-size-sm)" }}
                                    />
                                    <button 
                                      className={styles.rowAction} 
                                      style={{ padding: "4px 8px" }} 
                                      onClick={() => setEditFoodCred(prev => prev + 50)}
                                    >
                                      +50
                                    </button>
                                    <button 
                                      className={styles.rowAction} 
                                      style={{ padding: "4px 8px" }} 
                                      onClick={() => setEditFoodCred(prev => Math.max(0, prev - 50))}
                                    >
                                      -50
                                    </button>
                                  </div>
                                </div>
                                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", marginTop: "4px" }}>
                                  Tier: <span style={{ fontWeight: "700", color: "var(--color-primary)" }}>{editFoodCred >= 300 ? "Gold Foodie" : editFoodCred >= 100 ? "Silver Diner" : "Bronze Discovery"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Trust Overrides */}
                            <div>
                              <div style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "var(--space-3)" }}>
                                Trust Controls Override
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div style={{ display: "flex", gap: "10px" }}>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", fontSize: "9px", color: "var(--color-text-muted)", marginBottom: "2px" }}>Reports Received</label>
                                    <input 
                                      type="number"
                                      value={editReportsAgainst}
                                      onChange={(e) => setEditReportsAgainst(parseInt(e.target.value) || 0)}
                                      style={{ width: "100%", padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-bg)", fontSize: "var(--font-size-sm)" }}
                                    />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", fontSize: "9px", color: "var(--color-text-muted)", marginBottom: "2px" }}>Reports Made</label>
                                    <input 
                                      type="number"
                                      value={editReportsMade}
                                      onChange={(e) => setEditReportsMade(parseInt(e.target.value) || 0)}
                                      style={{ width: "100%", padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-bg)", fontSize: "var(--font-size-sm)" }}
                                    />
                                  </div>
                                </div>
                                
                                <button 
                                  className={styles.rowActionPrimary}
                                  style={{ padding: "6px 12px", width: "100%", fontSize: "var(--font-size-xs)", fontWeight: "700", marginTop: "4px" }}
                                  onClick={() => handleUpdateUserMetrics(user.id)}
                                >
                                  Save User Metrics & FoodCred
                                </button>
                              </div>
                            </div>

                            {/* Account History */}
                            <div>
                              <div style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "var(--space-2)" }}>
                                Account Activity
                              </div>
                              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", display: "flex", flexDirection: "column", gap: "4px" }}>
                                <span>Joined: {user.joinedDate}</span>
                                <span>Stalls contributed: {user.stallCount}</span>
                                <span>Last Active: {user.lastActive}</span>
                                <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                                  {user.accountStatus !== "warned" && user.accountStatus !== "suspended" && (
                                    <button
                                      className={styles.actionButtonSecondary}
                                      style={{ fontSize: "0.7rem", padding: "var(--space-2) var(--space-3)" }}
                                      onClick={(e) => handleWarn(user.id, user.displayName, e)}
                                    >
                                      <ShieldAlert size={12} /> Warn User
                                    </button>
                                  )}
                                  {user.accountStatus === "suspended" ? (
                                    <button
                                      className={styles.actionButtonSecondary}
                                      style={{ fontSize: "0.7rem", padding: "var(--space-2) var(--space-3)", color: "var(--color-success)", borderColor: "var(--color-success)" }}
                                      onClick={(e) => handleUnsuspend(user.id, e)}
                                    >
                                      Activate User
                                    </button>
                                  ) : (
                                    <button
                                      className={styles.actionButtonSecondary}
                                      style={{ fontSize: "0.7rem", padding: "var(--space-2) var(--space-3)", color: "#DC2626", borderColor: "#FCA5A5" }}
                                      onClick={() => setSuspendTarget(user)}
                                    >
                                      <Ban size={12} /> Suspend
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className={styles.emptyState}>
          <User size={40} />
          <div className={styles.emptyStateTitle}>No users found</div>
          <div className={styles.emptyStateDesc}>Try adjusting your search or tab filter.</div>
        </div>
      )}

      {/* SUSPEND CONFIRMATION MODAL */}
      {suspendTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3>Suspend Account?</h3>
            </div>
            <div className={styles.modalBody}>
              <p>This will suspend <strong>{suspendTarget.displayName}</strong> and prevent them from accessing the app. This action can be reversed.</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionButtonSecondary} onClick={() => setSuspendTarget(null)}>Cancel</button>
              <button className={styles.actionButtonDanger} onClick={confirmSuspend}>Confirm Suspend</button>
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
