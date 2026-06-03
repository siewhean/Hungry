"use client";

import React, { useState } from "react";
import { Check, X, ExternalLink, UserCheck, CheckCircle, FileText, Building, Video, Award, FileCheck } from "lucide-react";
import styles from "../console.module.css";
import {
  DEMO_MERCHANT_ID,
  DEMO_MERCHANT_NAME,
  updateMerchantVerificationStatus,
  type MerchantVerificationStepStatus,
} from "@/lib/merchantVerification";
import { readConsolePrototypeStorage, writeConsolePrototypeStorage } from "@/lib/console/prototypeStorage";

type AppStatus = "pending" | "approved" | "rejected" | "more_info" | "in_review";

interface ClaimApplication {
  id: string;
  stallName: string;
  applicant: string;
  contact: string;
  evidenceType: string;
  evidenceUrl: string;
  privacySetting: "exact" | "approximate" | "hidden";
  status: AppStatus;
  submittedAt: string;
  acraName: string;
  uen: string;
  sfaLicenceNo: string;
  sfaExpiry: string;
  verificationLink: string;
  applicantRole: string;
  walkaroundStatus: "verified" | "pending" | "failed";
}

const initialApplications: ClaimApplication[] = [
  {
    id: "CLM-104",
    stallName: "Old Airport Road Lor Mee",
    applicant: "Tan Keng Ann",
    contact: "+65 9123 4567",
    evidenceType: "SFA License Upload",
    evidenceUrl: "/evidence/license_tan.pdf",
    privacySetting: "exact",
    status: "pending",
    submittedAt: "2 hours ago",
    acraName: "TAN KENG ANN F&B HOLDINGS PTE. LTD.",
    uen: "202304918C",
    sfaLicenceNo: "SE23194K",
    sfaExpiry: "2027-04-15",
    verificationLink: "https://www.google.com/search?q=old+airport+road+lor+mee",
    applicantRole: "Stall Owner",
    walkaroundStatus: "pending"
  },
  {
    id: "CLM-105",
    stallName: "Ah Seng Braised Duck",
    applicant: "Lim Wei Ming",
    contact: "+65 8234 5678",
    evidenceType: "Singpass MyInfo Business",
    evidenceUrl: "Verified via Singpass Integration",
    privacySetting: "exact",
    status: "pending",
    submittedAt: "4 hours ago",
    acraName: "AH SENG BRAISED DUCK PTE. LTD.",
    uen: "202108192D",
    sfaLicenceNo: "SE21822A",
    sfaExpiry: "2026-11-30",
    verificationLink: "https://www.google.com/search?q=ah+seng+braised+duck",
    applicantRole: "Sole Proprietor",
    walkaroundStatus: "verified"
  },
  {
    id: "SUB-302",
    stallName: "Geylang Lor 9 Frog Porridge",
    applicant: "Chua Kim Hock",
    contact: "+65 9345 6789",
    evidenceType: "Kitchen Video Walkaround",
    evidenceUrl: "/evidence/walkaround_chua.mp4",
    privacySetting: "approximate",
    status: "in_review",
    submittedAt: "1 day ago",
    acraName: "GEYLANG LOR 9 F&B ENTERPRISE",
    uen: "53491822X",
    sfaLicenceNo: "SE18993C",
    sfaExpiry: "2026-08-20",
    verificationLink: "https://www.google.com/search?q=geylang+lor+9+frog+porridge",
    applicantRole: "General Partner",
    walkaroundStatus: "verified"
  },
  {
    id: "CLM-106",
    stallName: "Maxwell Fuzhou Oyster Cake",
    applicant: "Sarah Tan",
    contact: "sarah.tan@gmail.com",
    evidenceType: "SFA License Upload",
    evidenceUrl: "/evidence/license_sarah.pdf",
    privacySetting: "exact",
    status: "pending",
    submittedAt: "2 days ago",
    acraName: "MAXWELL FUZHOU FOOD PARTNERS",
    uen: "53182294M",
    sfaLicenceNo: "SE22104M",
    sfaExpiry: "2027-02-18",
    verificationLink: "https://www.google.com/search?q=maxwell+fuzhou+oyster+cake",
    applicantRole: "Managing Director",
    walkaroundStatus: "pending"
  },
  {
    id: "CLM-107",
    stallName: "Seng Kee Black Chicken Herbal Soup",
    applicant: "Ang Kok Leong",
    contact: "+65 9456 7890",
    evidenceType: "Home-based Declaration",
    evidenceUrl: "Home-based declaration form",
    privacySetting: "hidden",
    status: "pending",
    submittedAt: "3 days ago",
    acraName: "SENG KEE HERBAL FOODS",
    uen: "53001899L",
    sfaLicenceNo: "HBL8291A",
    sfaExpiry: "2026-12-10",
    verificationLink: "https://www.google.com/search?q=seng+kee+black+chicken+herbal+soup",
    applicantRole: "Home Operator",
    walkaroundStatus: "pending"
  }
];

const statusBadge: Record<AppStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "badgePending" },
  in_review: { label: "In Review", cls: "badgeNew" },
  approved: { label: "Approved", cls: "badgeResolved" },
  rejected: { label: "Rejected", cls: "badgeCritical" },
  more_info: { label: "Need Info", cls: "badgeNew" },
};

type TabFilter = "all" | "pending" | "in_review" | "approved" | "rejected";

export default function MerchantApplications() {
  const [applications, setApplications] = useState<ClaimApplication[]>(() => {
    return readConsolePrototypeStorage("console_merchant_applications", initialApplications);
  });

  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [selectedApp, setSelectedApp] = useState<ClaimApplication | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ClaimApplication | null>(null);
  const [infoModal, setInfoModal] = useState<ClaimApplication | null>(null);
  const [infoMessage, setInfoMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const saveApplications = (updated: ClaimApplication[]) => {
    setApplications(updated);
    writeConsolePrototypeStorage("console_merchant_applications", updated);
  };

  const syncMerchantPortalVerification = (
    app: ClaimApplication | undefined,
    status: "pending" | "in_review" | "more_info" | "rejected" | "approved",
    message: string,
    stepUpdates: {
      documents?: MerchantVerificationStepStatus;
      walkaround?: MerchantVerificationStepStatus;
      corppass?: MerchantVerificationStepStatus;
    } = {}
  ) => {
    if (!app || (app.id !== DEMO_MERCHANT_ID && app.stallName !== DEMO_MERCHANT_NAME)) return;

    updateMerchantVerificationStatus(status, {
      updatedBy: "Hungry Console",
      message,
      stepUpdates,
    });
  };

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "in_review", label: "In Review" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  const filtered = applications.filter((a) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return a.status === "pending" || a.status === "more_info";
    return a.status === activeTab;
  });

  const handleApprove = (id: string) => {
    const updated = applications.map((a) => (a.id === id ? { ...a, status: "approved" as AppStatus, walkaroundStatus: "verified" as const } : a));
    const app = applications.find((a) => a.id === id);
    saveApplications(updated);
    if (selectedApp?.id === id) {
      setSelectedApp({ ...selectedApp, status: "approved" as AppStatus, walkaroundStatus: "verified" as const });
    }
    syncMerchantPortalVerification(app, "approved", "Hungry Ops approved your merchant verification. Your full merchant dashboard is now available.", {
      documents: "verified",
      walkaround: "verified",
      corppass: "verified",
    });
    showToast("Application approved statefully", "success");
    // Trigger custom event for general audit trail
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("consoleAdminAction", { detail: { action: "merchant approved", target: app?.stallName || id, notes: notes || "Approved via Claim Verification Centre" } }));
    }
    setNotes("");
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    const updated = applications.map((a) => (a.id === rejectTarget.id ? { ...a, status: "rejected" as AppStatus, walkaroundStatus: "failed" as const } : a));
    saveApplications(updated);
    if (selectedApp?.id === rejectTarget.id) setSelectedApp(null);
    syncMerchantPortalVerification(rejectTarget, "rejected", "Hungry Ops rejected this verification. Review the failed step and submit updated evidence.", {
      walkaround: "failed",
    });
    showToast("Application rejected", "error");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("consoleAdminAction", { detail: { action: "merchant rejected", target: rejectTarget.stallName, notes: "Rejected via Claim Verification Centre" } }));
    }
    setRejectTarget(null);
  };

  const handleSendInfo = () => {
    if (!infoModal) return;
    const updated = applications.map((a) => (a.id === infoModal.id ? { ...a, status: "more_info" as AppStatus } : a));
    saveApplications(updated);
    syncMerchantPortalVerification(infoModal, "more_info", infoMessage || "Hungry Ops needs more information before this merchant account can be verified.", {
      documents: "needs_action",
    });
    showToast("Info request sent to applicant", "info");
    setInfoModal(null);
    setInfoMessage("");
  };

  const handleUpdateWalkaround = (id: string, status: "verified" | "pending" | "failed") => {
    const updated = applications.map((a) => (a.id === id ? { ...a, walkaroundStatus: status } : a));
    const app = applications.find((a) => a.id === id);
    saveApplications(updated);
    if (selectedApp?.id === id) {
      setSelectedApp({ ...selectedApp, walkaroundStatus: status });
    }
    syncMerchantPortalVerification(
      app,
      status === "failed" ? "rejected" : "in_review",
      status === "failed"
        ? "Hungry Ops could not verify the physical stall walkthrough. Please upload a clearer walkthrough."
        : "Hungry Ops updated the physical stall walkthrough status.",
      { walkaround: status === "failed" ? "failed" : status }
    );
    showToast(`Walkaround status updated to ${status}`, "success");
  };

  return (
    <div>
      {/* HEADER SECTION */}
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Merchant applications</h1>
          <p>Approve claims, review new stall submissions, verify home-based businesses, and resolve ownership disputes before listings go live.</p>
        </div>
      </div>

      {/* TABS */}
      <div className={styles.dashboardSectionCard}>
        <div className={styles.tabNav}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`${styles.tabNavItem} ${activeTab === t.key ? styles.tabNavItemActive : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              <span style={{ marginLeft: "6px", fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
                ({applications.filter((a) => {
                  if (t.key === "all") return true;
                  if (t.key === "pending") return a.status === "pending" || a.status === "more_info";
                  return a.status === t.key;
                }).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* TABLE */}
      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}>
          <h2>Review Applications</h2>
        </div>

        <div className={styles.queueTableWrapper}>
          <table className={styles.queueTable}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Stall Name</th>
                <th>Applicant Details</th>
                <th>Evidence Submitted</th>
                <th>Location Privacy</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => {
                const badge = statusBadge[app.status];
                return (
                  <tr key={app.id} style={{ cursor: "pointer" }} onClick={() => setSelectedApp(app)}>
                    <td style={{ fontWeight: "700", fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}>{app.id}</td>
                    <td style={{ fontWeight: "700" }}>{app.stallName}</td>
                    <td>
                      <div>{app.applicant}</div>
                      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                        {app.applicantRole} · {app.contact}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <FileCheck size={14} style={{ color: "var(--color-primary)" }} />
                        <span>{app.evidenceType}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.badge} style={{
                        borderRadius: "var(--radius-full)",
                        backgroundColor: app.privacySetting === "exact" ? "#ECFDF5" : app.privacySetting === "approximate" ? "#FEF3C7" : "#FEE2E2",
                        color: app.privacySetting === "exact" ? "#065F46" : app.privacySetting === "approximate" ? "#92400E" : "#991B1B"
                      }}>
                        {app.privacySetting === "exact" ? "EXACT (Unit)" : app.privacySetting === "approximate" ? "APPROX (Region)" : "HIDDEN"}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[badge.cls as keyof typeof styles]}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{app.submittedAt}</td>
                    <td>
                      {(app.status === "pending" || app.status === "in_review" || app.status === "more_info") ? (
                        <div style={{ display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className={styles.rowActionPrimary}
                            style={{ fontSize: "var(--font-size-xs)", padding: "4px 8px" }}
                            onClick={() => handleApprove(app.id)}
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            className={styles.rowAction}
                            style={{ fontSize: "var(--font-size-xs)", padding: "4px 8px" }}
                            onClick={() => { setInfoModal(app); }}
                          >
                            Request Info
                          </button>
                          <button
                            className={styles.rowActionDanger}
                            style={{ fontSize: "var(--font-size-xs)", padding: "4px 8px" }}
                            onClick={() => setRejectTarget(app)}
                          >
                            <X size={12} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontWeight: "600" }}>
                          {badge.label}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className={styles.emptyState}>
            <UserCheck size={36} />
            <div className={styles.emptyStateTitle}>No applications</div>
            <div className={styles.emptyStateDesc}>No applications match the selected filter.</div>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER */}
      {selectedApp && (
        <>
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 100 }} onClick={() => setSelectedApp(null)} />
          <div className={styles.drawerPanel}>
            <div className={styles.drawerHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>{selectedApp.stallName}</h2>
                <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>{selectedApp.id}</p>
              </div>
              <button className={styles.drawerCloseBtn} onClick={() => setSelectedApp(null)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.drawerBody}>
              {/* Applicant block */}
              <div style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-4)", marginBottom: "var(--space-4)" }}>
                <h3 style={{ fontSize: "var(--font-size-xs)", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "var(--space-2)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <UserCheck size={14} /> Applicant Identity
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", fontSize: "var(--font-size-sm)" }}>
                  <div><span style={{ color: "var(--color-text-secondary)" }}>Name:</span> <strong style={{ color: "var(--color-text)" }}>{selectedApp.applicant}</strong></div>
                  <div><span style={{ color: "var(--color-text-secondary)" }}>Role:</span> <strong style={{ color: "var(--color-text)" }}>{selectedApp.applicantRole}</strong></div>
                  <div><span style={{ color: "var(--color-text-secondary)" }}>Contact:</span> <strong style={{ color: "var(--color-text)" }}>{selectedApp.contact}</strong></div>
                  <div><span style={{ color: "var(--color-text-secondary)" }}>Submitted:</span> <strong style={{ color: "var(--color-text)" }}>{selectedApp.submittedAt}</strong></div>
                </div>
              </div>

              {/* ACRA registration block */}
              <div style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-4)", marginBottom: "var(--space-4)" }}>
                <h3 style={{ fontSize: "var(--font-size-xs)", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "var(--space-2)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Building size={14} /> ACRA Business Registration
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--font-size-sm)" }}>
                  <div><span style={{ color: "var(--color-text-secondary)" }}>Registered Name:</span> <strong style={{ color: "var(--color-text)" }}>{selectedApp.acraName}</strong></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                    <div><span style={{ color: "var(--color-text-secondary)" }}>UEN:</span> <strong style={{ color: "var(--color-text)", fontFamily: "var(--font-mono)" }}>{selectedApp.uen}</strong></div>
                    <div><span style={{ color: "var(--color-text-secondary)" }}>Status:</span> <span className={styles.badge} style={{ backgroundColor: "#ECFDF5", color: "#065F46", borderRadius: "var(--radius-full)" }}>Live</span></div>
                  </div>
                </div>
              </div>

              {/* SFA Licence block */}
              <div style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-4)", marginBottom: "var(--space-4)" }}>
                <h3 style={{ fontSize: "var(--font-size-xs)", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "var(--space-2)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Award size={14} /> SFA Food Hygiene Licensing
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--font-size-sm)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                    <div><span style={{ color: "var(--color-text-secondary)" }}>Licence No:</span> <strong style={{ color: "var(--color-text)", fontFamily: "var(--font-mono)" }}>{selectedApp.sfaLicenceNo}</strong></div>
                    <div><span style={{ color: "var(--color-text-secondary)" }}>Expiry:</span> <strong style={{ color: "var(--color-text)" }}>{selectedApp.sfaExpiry}</strong></div>
                  </div>
                  <div><span style={{ color: "var(--color-text-secondary)" }}>Evidence Type:</span> <strong style={{ color: "var(--color-text)" }}>{selectedApp.evidenceType}</strong></div>
                  {selectedApp.evidenceUrl.startsWith("/") && (
                    <div>
                      <span style={{ color: "var(--color-text-secondary)" }}>Licence File:</span>{" "}
                      <a href={selectedApp.evidenceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: "700" }}>
                        <FileText size={12} /> View Uploaded PDF
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Physical Verification Block */}
              <div style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-4)", marginBottom: "var(--space-4)" }}>
                <h3 style={{ fontSize: "var(--font-size-xs)", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "var(--space-2)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Video size={14} /> Physical Walkaround Verification
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--font-size-sm)" }}>
                  <div>
                    <span style={{ color: "var(--color-text-secondary)" }}>Verification File:</span>{" "}
                    <a href={selectedApp.verificationLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: "700" }}>
                      <ExternalLink size={12} /> Inspect Walkaround Proof
                    </a>
                  </div>
                  <div>
                    <span style={{ color: "var(--color-text-secondary)" }}>Walkaround Status:</span>{" "}
                    <span className={styles.badge} style={{
                      borderRadius: "var(--radius-full)",
                      backgroundColor: selectedApp.walkaroundStatus === "verified" ? "#ECFDF5" : selectedApp.walkaroundStatus === "failed" ? "#FEE2E2" : "#FEF3C7",
                      color: selectedApp.walkaroundStatus === "verified" ? "#065F46" : selectedApp.walkaroundStatus === "failed" ? "#991B1B" : "#92400E"
                    }}>
                      {selectedApp.walkaroundStatus.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                    <button
                      className={styles.rowAction}
                      style={{ padding: "4px 8px", fontSize: "0.7rem", color: "var(--color-success)", borderColor: "var(--color-success)" }}
                      onClick={() => handleUpdateWalkaround(selectedApp.id, "verified")}
                    >
                      Mark Verified
                    </button>
                    <button
                      className={styles.rowAction}
                      style={{ padding: "4px 8px", fontSize: "0.7rem", color: "#DC2626", borderColor: "#FCA5A5" }}
                      onClick={() => handleUpdateWalkaround(selectedApp.id, "failed")}
                    >
                      Mark Failed
                    </button>
                  </div>
                </div>
              </div>

              {/* General details */}
              <div style={{ marginBottom: "var(--space-6)" }}>
                <div className={styles.drawerFieldRow}><span className={styles.drawerFieldLabel}>Location Privacy</span><span className={styles.drawerFieldValue}>{selectedApp.privacySetting.toUpperCase()}</span></div>
                <div className={styles.drawerFieldRow}>
                  <span className={styles.drawerFieldLabel}>Claim Status</span>
                  <span className={styles.drawerFieldValue}>
                    <span className={`${styles.badge} ${styles[statusBadge[selectedApp.status].cls as keyof typeof styles]}`}>
                      {statusBadge[selectedApp.status].label}
                    </span>
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <a
                  href="/merchant"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.rowAction}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "var(--space-2)",
                    color: "var(--color-primary)",
                    borderColor: "var(--color-primary)",
                    fontWeight: "700"
                  }}
                >
                  <ExternalLink size={14} /> Preview Merchant Mode
                </a>
              </div>

              {(selectedApp.status === "pending" || selectedApp.status === "in_review" || selectedApp.status === "more_info") && (
                <div style={{ marginTop: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  <button className={styles.rowActionPrimary} onClick={() => { handleApprove(selectedApp.id); }}>
                    <Check size={14} /> Approve &amp; Sync Badge
                  </button>
                  <button className={styles.rowAction} onClick={() => { setInfoModal(selectedApp); setSelectedApp(null); }}>
                    Request More Info
                  </button>
                  <button className={styles.rowActionDanger} onClick={() => { setRejectTarget(selectedApp); setSelectedApp(null); }}>
                    <X size={14} /> Reject Claim
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* REQUEST INFO MODAL */}
      {infoModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3>Request More Info</h3>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "4px" }}>
                Application: {infoModal.id} — {infoModal.stallName}
              </p>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.formLabel}>Message to Applicant</label>
              <textarea
                className={styles.formTextarea}
                placeholder="Describe what additional information or documents are required..."
                value={infoMessage}
                onChange={(e) => setInfoMessage(e.target.value)}
                rows={4}
              />
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionButtonSecondary} onClick={() => { setInfoModal(null); setInfoMessage(""); }}>Cancel</button>
              <button className={styles.actionButton} onClick={handleSendInfo} disabled={!infoMessage.trim()} style={{ opacity: infoMessage.trim() ? 1 : 0.5 }}>
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT CONFIRMATION MODAL */}
      {rejectTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3>Reject Application?</h3>
            </div>
            <div className={styles.modalBody}>
              <p>This will reject <strong>{rejectTarget.stallName}</strong> by <strong>{rejectTarget.applicant}</strong>. The applicant will be notified.</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionButtonSecondary} onClick={() => setRejectTarget(null)}>Cancel</button>
              <button className={styles.actionButtonDanger} onClick={confirmReject}>Confirm Reject</button>
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
