"use client";

import React, { useState } from "react";
import { CheckCircle, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { getConsolePrototypeFallback, readConsolePrototypeStorage, writeConsolePrototypeStorage } from "@/lib/console/prototypeStorage";
import styles from "../console.module.css";

interface MockReport {
  id: string;
  reportedEntity: string;
  reportedUserId: string;
  reportedUsername: string;
  reporter: string;
  category: "Fake Review" | "Abusive Text" | "Duplicate Stall" | "Wrong Price" | "Safety Concern";
  content: string;
  status: "pending" | "hidden" | "dismissed";
  reportedAt: string;
  infractionReason?: string;
  actionTaken?: string;
}

const initialReports: MockReport[] = [
  { id: "REP-401", reportedEntity: "Review #3912", reportedUserId: "U-10044", reportedUsername: "wei_ming_eats", reporter: "Ah Seng Stall Owner", category: "Fake Review", content: "Review claims we don't wash our vegetables, but we pass every SFA inspection. Absolute lie from a competitor.", status: "pending", reportedAt: "1 hour ago" },
  { id: "REP-402", reportedEntity: "Maxwell Chicken Rice Post", reportedUserId: "U-09987", reportedUsername: "spamuser_flagged", reporter: "ModAI System (High Risk)", category: "Abusive Text", content: "Post caption contains aggressive swear words directed at another queue diner.", status: "pending", reportedAt: "3 hours ago" },
  { id: "REP-403", reportedEntity: "Bedok South Lor Mee Stall", reportedUserId: "U-10223", reportedUsername: "ahmad.rider97", reporter: "Lim Gek Lan", category: "Duplicate Stall", content: "There are two identical Lor Mee stalls listed at unit #01-44 on Bedok South Map.", status: "pending", reportedAt: "1 day ago" },
  { id: "REP-404", reportedEntity: "Review photo", reportedUserId: "U-07412", reportedUsername: "old_account_2022", reporter: "TrustOps AI", category: "Safety Concern", content: "Photo shows high blurriness and potentially non-food related content in Maxwell.", status: "pending", reportedAt: "2 days ago" },
];

const INFRACTION_REASONS = [
  "Spam, Scam or Commercial Promotion",
  "False, Misleading or Competitor Defamation",
  "Harassment, Abuse or Profanity",
  "Incorrect geo-coordinates or Duplicate listing",
  "Inappropriate Media or Off-topic image",
];

export default function ModerationReports() {
  const [reports, setReports] = useState<MockReport[]>(() => {
    return readConsolePrototypeStorage("console_reports", getConsolePrototypeFallback(initialReports, []));
  });

  const [activeReport, setActiveReport] = useState<MockReport | null>(null);
  const [hideContent, setHideContent] = useState(true);
  const [issueWarning, setIssueWarning] = useState(false);
  const [suspendUser, setSuspendUser] = useState(false);
  const [infractionReason, setInfractionReason] = useState(INFRACTION_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [sortField, setSortField] = useState("reportedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderSortHeader = (label: string, field: string) => {
    const isActive = sortField === field;
    return (
      <th onClick={() => handleSort(field)} style={{ cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>{label}</span>
          {isActive ? (
            sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
          ) : (
            <ArrowUpDown size={12} style={{ opacity: 0.3 }} />
          )}
        </div>
      </th>
    );
  };

  const processedReports = React.useMemo(() => {
    const list = reports.filter((r) => {
      const matchSearch = !searchQuery ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reportedEntity.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reportedUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reporter.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.content.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory = categoryFilter === "all" || r.category === categoryFilter;
      const matchStatus = statusFilter === "all" || r.status === statusFilter;

      return matchSearch && matchCategory && matchStatus;
    });

    list.sort((a, b) => {
      const fieldA = a[sortField as keyof MockReport] ?? "";
      const fieldB = b[sortField as keyof MockReport] ?? "";

      if (fieldA < fieldB) return sortDirection === "asc" ? -1 : 1;
      if (fieldA > fieldB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [reports, searchQuery, categoryFilter, statusFilter, sortField, sortDirection]);

  const saveReports = (updated: MockReport[]) => {
    setReports(updated);
    writeConsolePrototypeStorage("console_reports", updated);
  };

  const showToast = (message: string, type: "success" | "info" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleQuickDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = reports.map((r) => r.id === id ? { ...r, status: "dismissed" as const, actionTaken: "Report Dismissed" } : r);
    saveReports(updated);
    showToast("Report dismissed statefully", "info");
  };

  const handleOpenModeration = (report: MockReport) => {
    setActiveReport(report);
    setHideContent(true);
    setIssueWarning(report.category === "Abusive Text" || report.category === "Fake Review");
    setSuspendUser(false);
    setInfractionReason(INFRACTION_REASONS[0]);
    setNotes("");
  };

  const handleApplyModeration = () => {
    if (!activeReport) return;
    let finalAction = "Report Resolved: ";
    if (hideContent) finalAction += "[Content Hidden] ";
    if (issueWarning) finalAction += "[Formal Warning Issued] ";
    if (suspendUser) finalAction += "[Account Suspended] ";

    const nextStatus: MockReport["status"] = hideContent ? "hidden" : "dismissed";
    const updatedReports = reports.map((r) =>
      r.id === activeReport.id ? { ...r, status: nextStatus, infractionReason, actionTaken: finalAction } : r
    );
    saveReports(updatedReports);
    showToast("Moderation decisions applied and synced statefully", "success");
    setActiveReport(null);
  };

  const getCategoryColor = (cat: string) => {
    switch(cat) {
      case "Abusive Text": return "#FEE2E2";
      case "Fake Review": return "#FEF3C7";
      case "Safety Concern": return "#FEE2E2";
      case "Duplicate Stall": return "#E0F2FE";
      default: return "#F3E8FF";
    }
  };

  const getCategoryTextColor = (cat: string) => {
    switch(cat) {
      case "Abusive Text": return "#991B1B";
      case "Fake Review": return "#92400E";
      case "Safety Concern": return "#991B1B";
      case "Duplicate Stall": return "#0369A1";
      default: return "#6B21A8";
    }
  };

  return (
    <div>
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Reports and trust</h1>
          <p>Review incorrect information, abuse, safety concerns, impersonation, duplicate listings, and ownership disputes.</p>
        </div>
      </div>

      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}>
          <h2>Moderation Reports Queue ({reports.filter(r => r.status === "pending").length} Open)</h2>
        </div>

        {/* Filters */}
        <div className={styles.filterBar} style={{ marginBottom: "var(--space-4)" }}>
          <div className={styles.filterSearchWrapper} style={{ flex: "1 1 220px", maxWidth: "360px" }}>
            <Search size={15} style={{ color: "var(--color-text-muted)", marginRight: "8px" }} />
            <input
              type="search"
              placeholder="Search reports..."
              className={styles.filterSearchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className={styles.filterSelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="Fake Review">Fake Review</option>
            <option value="Abusive Text">Abusive Text</option>
            <option value="Duplicate Stall">Duplicate Stall</option>
            <option value="Wrong Price">Wrong Price</option>
            <option value="Safety Concern">Safety Concern</option>
          </select>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="hidden">Hidden</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>

        <div className={styles.queueTableWrapper}>
          <table className={styles.queueTable}>
            <thead>
              <tr>
                {renderSortHeader("ID", "id")}
                {renderSortHeader("Reported Item / Creator", "reportedEntity")}
                {renderSortHeader("Category", "category")}
                {renderSortHeader("Report Details / Content Preview", "content")}
                {renderSortHeader("Reporter", "reporter")}
                {renderSortHeader("Status", "status")}
                {renderSortHeader("Date", "reportedAt")}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {processedReports.map((report) => (
                <tr key={report.id} style={{ cursor: "pointer" }} onClick={() => handleOpenModeration(report)}>
                  <td style={{ fontWeight: "700", fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}>{report.id}</td>
                  <td>
                    <div style={{ fontWeight: "700", fontSize: "var(--font-size-sm)" }}>{report.reportedEntity}</div>
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>By: {report.reportedUsername}</div>
                  </td>
                  <td>
                    <span className={styles.badge} style={{ backgroundColor: getCategoryColor(report.category), color: getCategoryTextColor(report.category) }}>
                      {report.category}
                    </span>
                  </td>
                  <td style={{ maxWidth: "340px", fontSize: "var(--font-size-sm)" }}>
                    {report.content}
                    {report.actionTaken && <div style={{ color: "var(--color-primary)", fontWeight: "600", fontSize: "10px" }}>{report.actionTaken}</div>}
                  </td>
                  <td style={{ fontSize: "var(--font-size-xs)" }}>{report.reporter}</td>
                  <td>
                    <span className={`${styles.badge} ${report.status === "pending" ? styles.badgePending : report.status === "hidden" ? styles.badgeCritical : styles.badgeResolved}`}>
                      {report.status === "pending" ? "Pending" : report.status === "hidden" ? "Content Hidden" : "Dismissed"}
                    </span>
                  </td>
                  <td style={{ fontSize: "var(--font-size-xs)" }}>{report.reportedAt}</td>
                  <td>
                    {report.status === "pending" ? (
                      <div style={{ display: "flex", gap: "6px", width: "max-content" }} onClick={(e) => e.stopPropagation()}>
                        <button className={`${styles.rowAction} ${styles.rowActionSecondary}`} onClick={() => handleOpenModeration(report)}>Moderate</button>
                        <button className={`${styles.rowAction} ${styles.rowActionDanger}`} onClick={(e) => handleQuickDismiss(report.id, e)}>Dismiss</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Resolved</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {activeReport && (
        <div className={styles.modalOverlay}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-label="Resolve report"
            style={{ maxWidth: "560px" }}
          >
            <div className={styles.modalHeader}>
              <h3>Moderation Decisions Hub</h3>
              <p>Resolving Report: <strong>{activeReport.id}</strong></p>
            </div>
            <div className={styles.modalBody}>
              <select className={styles.formInput} value={infractionReason} onChange={(e) => setInfractionReason(e.target.value)}>
                {INFRACTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <label><input type="checkbox" checked={hideContent} onChange={(e) => setHideContent(e.target.checked)} /> Hide Content</label>
              <label><input type="checkbox" checked={issueWarning} onChange={(e) => setIssueWarning(e.target.checked)} /> Issue Warning</label>
              <label><input type="checkbox" checked={suspendUser} onChange={(e) => setSuspendUser(e.target.checked)} /> Suspend User</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Justification..." />
            </div>
            <div className={styles.modalFooter}>
              <button onClick={() => setActiveReport(null)}>Cancel</button>
              <button onClick={handleApplyModeration}>Apply</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={styles.toast}><CheckCircle size={16} />{toast.message}</div>}
    </div>
  );
}
