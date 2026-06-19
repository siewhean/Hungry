"use client";

import React, { useState, useEffect, useRef } from "react";
import { User, Calendar, Search, Download, CheckCircle, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import styles from "../console.module.css";


interface AuditEntry {
  id: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  notes: string;
  timestamp: string;
}

const initialLogs: AuditEntry[] = [
  { id: "AUD-801", actor: "Hean (Hungry Ops)", role: "Admin", action: "merchant approved", target: "Ah Seng Braised Duck", notes: "Singpass MyInfo business verification details successfully verified.", timestamp: "Just now" },
  { id: "AUD-802", actor: "Hean (Hungry Ops)", role: "Developer", action: "feature flag changed", target: "directMessagesEnabled", notes: "Enabled chat rooms at 25% progressive rollout. Reason: Clementi messaging launch.", timestamp: "10 mins ago" },
  { id: "AUD-803", actor: "Hean (Hungry Ops)", role: "Developer", action: "feature flag changed", target: "gamificationEnabled", notes: "Updated rollout to 100% following successful test campaign.", timestamp: "1 hour ago" },
  { id: "AUD-804", actor: "Sarah Tan", role: "Trust & Safety", action: "content hidden", target: "Review #3912 by FoodieKing", notes: "Offensive language violation: hid content publicly.", timestamp: "3 hours ago" },
  { id: "AUD-805", actor: "Lim Wei Ming", role: "Owner", action: "admin permission changed", target: "Sarah Tan", notes: "Sarah Tan promoted to Trust & Safety group.", timestamp: "1 day ago" },
];

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>(initialLogs);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [toast, setToast] = useState<string | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sortField, setSortField] = useState("timestamp");
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

  const showToast = (msg: string) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast(msg);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleAdminAction = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        const newLog: AuditEntry = {
          id: `AUD-${Math.floor(100 + Math.random() * 900)}`,
          actor: "Hean (Hungry Ops)",
          role: "Admin",
          action: detail.action,
          target: detail.target,
          notes: detail.notes,
          timestamp: "Just now"
        };
        setLogs(prev => [newLog, ...prev]);
      };
      window.addEventListener("consoleAdminAction", handleAdminAction);
      return () => { window.removeEventListener("consoleAdminAction", handleAdminAction); };
    }
  }, []);

  const ACTION_TYPES = ["all", "merchant approved", "feature flag changed", "content hidden", "report dismissed", "admin permission changed"];

  const filtered = React.useMemo(() => {
    const list = logs.filter((l) => {
      const matchSearch = !search || l.actor.toLowerCase().includes(search.toLowerCase()) || l.notes.toLowerCase().includes(search.toLowerCase()) || l.target.toLowerCase().includes(search.toLowerCase()) || l.id.toLowerCase().includes(search.toLowerCase());
      const matchAction = actionFilter === "all" || l.action === actionFilter;
      return matchSearch && matchAction;
    });

    list.sort((a, b) => {
      const fieldA = a[sortField as keyof AuditEntry] ?? "";
      const fieldB = b[sortField as keyof AuditEntry] ?? "";

      if (sortField === "timestamp") {
        const order = ["Just now", "10 mins ago", "1 hour ago", "3 hours ago", "1 day ago"];
        const idxA = order.indexOf(fieldA as string);
        const idxB = order.indexOf(fieldB as string);
        if (idxA !== -1 && idxB !== -1) {
          return sortDirection === "asc" ? idxB - idxA : idxA - idxB;
        }
      }

      if (fieldA < fieldB) return sortDirection === "asc" ? -1 : 1;
      if (fieldA > fieldB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [logs, search, actionFilter, sortField, sortDirection]);


  return (
    <div>
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Operations Audit Log</h1>
          <p>Real-time, immutable ledger of all administrative, moderation, and configuration updates performed in Hungry Console.</p>
        </div>
        <button className={styles.actionButtonSecondary} onClick={() => showToast(`Exported ${filtered.length} audit log entries`)}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <div className={styles.filterSearchWrapper}>
          <Search size={15} style={{ color: "var(--color-text-muted)", marginRight: "8px" }} />
          <input type="search" placeholder="Search actor, target, or notes..." className={styles.filterSearchInput} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={styles.filterSelect} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          {ACTION_TYPES.map((t) => <option key={t} value={t}>{t === "all" ? "All Actions" : t}</option>)}
        </select>
      </div>

      {/* AUDIT LOG TABLE */}
      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}>
          <h2>Administrative Log Entries ({filtered.length})</h2>
        </div>

        <div className={styles.queueTableWrapper}>
          <table className={styles.queueTable}>
            <thead>
              <tr>
                {renderSortHeader("Log ID", "id")}
                {renderSortHeader("Operator (Actor)", "actor")}
                {renderSortHeader("Role Group", "role")}
                {renderSortHeader("Action", "action")}
                {renderSortHeader("Target Entity", "target")}
                {renderSortHeader("Operational Notes", "notes")}
                {renderSortHeader("Timestamp", "timestamp")}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--color-text-muted)" }}>No entries match your filters.</td></tr>
              ) : filtered.map((log) => {
                let badgeClass = styles.badgeNew;
                if (log.action.includes("approved")) badgeClass = styles.badgeResolved;
                if (log.action.includes("hidden") || log.action.includes("rejected")) badgeClass = styles.badgeCritical;
                if (log.action.includes("flag")) badgeClass = styles.badgePending;

                return (
                  <tr key={log.id}>
                    <td style={{ fontWeight: "700", fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}>{log.id}</td>
                    <td style={{ fontWeight: "600" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <User size={14} style={{ color: "var(--color-text-muted)" }} />
                        {log.actor}
                      </div>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-xs)", fontWeight: "600" }}>{log.role}</td>
                    <td>
                      <span className={`${styles.badge} ${badgeClass}`}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontWeight: "700", fontSize: "var(--font-size-xs)" }}>{log.target}</td>
                    <td style={{ maxWidth: "340px", fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>{log.notes}</td>
                    <td style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Calendar size={12} />
                        {log.timestamp}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className={`${styles.toast} ${styles.toastSuccess}`}>
          <CheckCircle size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
