"use client";

import React, { useState, useRef } from "react";
import { CheckCircle, Plus, X, Trash2 } from "lucide-react";
import styles from "../../console/console.module.css";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Manager" | "Staff";
  joinedDate: string;
}

const INITIAL_TEAM: TeamMember[] = [
  { id: "tm1", name: "Tan Beng Huat", email: "demo@hungry.sg", role: "Owner", joinedDate: "Mar 2024" },
  { id: "tm2", name: "Lim Ah Kow", email: "manager@maxwell.sg", role: "Manager", joinedDate: "Jun 2024" },
];

export default function MerchantSettingsPage() {
  const [displayName, setDisplayName] = useState("Tan Beng Huat");
  const [language, setLanguage] = useState("English");
  const [notifs, setNotifs] = useState({ newReviews: true, newFollowers: true, promoExpiring: true, weeklySummary: false });
  const [team, setTeam] = useState<TeamMember[]>(INITIAL_TEAM);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Manager" | "Staff">("Manager");
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateText, setDeactivateText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast(msg);
    setToastType(type);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  const sendInvite = () => {
    if (!inviteEmail.trim()) return;
    setInviteOpen(false);
    showToast(`Invitation sent to ${inviteEmail}`);
    setInviteEmail("");
    setInviteRole("Manager");
  };

  const removeTeamMember = (id: string) => {
    const m = team.find((t) => t.id === id);
    setTeam((p) => p.filter((t) => t.id !== id));
    if (m) showToast(`${m.name} removed from team`);
  };

  return (
    <div>
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Settings</h1>
          <p>Manage your account, notifications, and team.</p>
        </div>
      </div>

      {/* Account settings */}
      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}><h2>Account</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Display Name</label>
            <input className={styles.formInput} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Email (read-only)</label>
            <input className={styles.formInput} value="demo@hungry.sg" readOnly style={{ opacity: 0.6, cursor: "not-allowed" }} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Preferred Language</label>
            <select className={styles.formSelect} value={language} onChange={(e) => setLanguage(e.target.value)}>
              {["English", "简体中文", "Bahasa Melayu", "தமிழ்"].map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-4)" }}>
          <button className={styles.actionButton} onClick={() => showToast("Account settings saved")}>
            <CheckCircle size={14} /> Save Settings
          </button>
        </div>
      </div>

      {/* Notification preferences */}
      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}><h2>Notification Preferences</h2></div>
        {([
          ["newReviews", "New Reviews", "Get notified when customers leave a review on your stall."],
          ["newFollowers", "New Followers", "Get notified when someone follows your stall on Hungry."],
          ["promoExpiring", "Promotions Expiring", "Get alerted 24 hours before a promotion ends."],
          ["weeklySummary", "Weekly Summary", "Receive a weekly email with your performance highlights."],
        ] as const).map(([key, label, desc]) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-4) 0", borderBottom: "1px solid var(--color-border)" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "var(--font-size-sm)" }}>{label}</div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{desc}</div>
            </div>
            <label className={styles.toggleSwitch} aria-label={`Toggle ${label}`}>
              <input type="checkbox" checked={notifs[key]} onChange={(e) => {
                setNotifs((p) => ({ ...p, [key]: e.target.checked }));
                showToast(`${label} notifications ${e.target.checked ? "enabled" : "disabled"}`);
              }} />
              <span className={styles.slider} />
            </label>
          </div>
        ))}
      </div>

      {/* Team members */}
      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}>
          <h2>Team Members</h2>
          <button className={styles.actionButton} style={{ fontSize: "var(--font-size-xs)", padding: "var(--space-2) var(--space-4)" }} onClick={() => setInviteOpen(true)}>
            <Plus size={13} /> Invite Member
          </button>
        </div>
        <div className={styles.queueTableWrapper}>
          <table className={styles.queueTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-xs)" }}>{m.email}</td>
                  <td><span className={`${styles.badge} ${m.role === "Owner" ? styles.badgeActive : styles.badgePending}`}>{m.role}</span></td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-xs)" }}>{m.joinedDate}</td>
                  <td>
                    {m.role !== "Owner" && (
                      <button className={`${styles.rowAction} ${styles.rowActionDanger}`} onClick={() => removeTeamMember(m.id)} aria-label="Remove team member">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Danger zone */}
      <div className={styles.dangerZone}>
        <div className={styles.dangerZoneTitle}>Danger Zone</div>
        <p className={styles.dangerZoneDesc}>
          Deactivating your account will remove your stall from Hungry and disable Merchant Mode access. This action cannot be undone.
        </p>
        <button className={styles.actionButtonDanger} onClick={() => setDeactivateOpen(true)}>
          Deactivate Account
        </button>
      </div>

      {/* Invite modal */}
      {inviteOpen && (
        <div className={styles.modalOverlay} onClick={() => setInviteOpen(false)}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Invite team member"
          >
            <div className={styles.modalHeader}><h3>Invite Team Member</h3></div>
            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Email Address</label>
                <input type="email" className={styles.formInput} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@email.com" autoFocus />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Role</label>
                <select className={styles.formSelect} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "Manager" | "Staff")}>
                  <option value="Manager">Manager</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionButtonSecondary} onClick={() => setInviteOpen(false)}>Cancel</button>
              <button className={styles.actionButton} onClick={sendInvite} disabled={!inviteEmail.trim()}>
                <CheckCircle size={14} /> Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirm modal */}
      {deactivateOpen && (
        <div className={styles.modalOverlay} onClick={() => setDeactivateOpen(false)}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Deactivate account"
          >
            <div className={styles.modalHeader}><h3 style={{ color: "#DC2626" }}>Deactivate Account</h3></div>
            <div className={styles.modalBody}>
              <p style={{ marginBottom: "var(--space-4)" }}>
                This will permanently remove your stall from Hungry. Type <strong>DEACTIVATE</strong> to confirm.
              </p>
              <input
                className={styles.formInput}
                value={deactivateText}
                onChange={(e) => setDeactivateText(e.target.value)}
                placeholder="Type DEACTIVATE to confirm"
              />
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionButtonSecondary} onClick={() => { setDeactivateOpen(false); setDeactivateText(""); }}>Cancel</button>
              <button
                className={styles.actionButtonDanger}
                disabled={deactivateText !== "DEACTIVATE"}
                onClick={() => { setDeactivateOpen(false); showToast("Account deactivation requested", "error"); setDeactivateText(""); }}
              >
                <X size={14} /> Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${toastType === "error" ? styles.toastError : styles.toastSuccess}`}>
          <CheckCircle size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
