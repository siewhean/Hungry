"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import styles from "../console.module.css";

type ConsoleWaitlistAudience = "foodie" | "merchant" | "both";

type ConsoleWaitlistEntry = {
  audience: ConsoleWaitlistAudience;
  businessName?: string;
  email: string;
  emailRedacted?: boolean;
  establishmentType?: string;
  id: string;
  metadata?: Record<string, unknown> | null;
  updatedAt: string;
  name?: string;
  source: "web_v2" | "marketing_web" | "merchant_portal" | "console" | "unknown";
  submittedAt: string;
};

type ApiPayload = {
  configured?: boolean;
  entries?: ConsoleWaitlistEntry[];
  error?: string;
};

function prettyAudience(audience: ConsoleWaitlistAudience) {
  return audience.replace("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function prettySource(value: ConsoleWaitlistEntry["source"]) {
  return value.replace("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function prettyMetadata(value?: Record<string, unknown> | null) {
  if (!value) return "No metadata";
  const text = JSON.stringify(value, null, 2);
  return text === "{}" ? "No metadata" : text;
}

export default function WaitlistPage() {
  const [loading, setLoading] = useState<"loading" | "ready" | "error">("loading");
  const [configured, setConfigured] = useState(false);
  const [entries, setEntries] = useState<ConsoleWaitlistEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Sorting and Filtering states
  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortField, setSortField] = useState<string>("submittedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const loadEntries = useCallback(
    async ({ initial = false }: { initial?: boolean } = {}) => {
      if (initial) {
        setLoading("loading");
      } else {
        setRefreshing(true);
      }
      setErrorMessage("");

      try {
        const response = await fetch(`/api/console/waitlist?ts=${Date.now()}`, { cache: "no-store" });
        const payload = (await response.json()) as ApiPayload;
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load waitlist submissions.");
        }

        setConfigured(Boolean(payload.configured));
        setEntries(payload.entries ?? []);
        setLoading("ready");
        setLastSyncedAt(new Date());
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load waitlist submissions.");
        setLoading("error");
      } finally {
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadEntries({ initial: true });
    }, 0);

    const intervalId = window.setInterval(() => {
      void loadEntries();
    }, 10_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadEntries();
      }
    };
    const handleFocus = () => {
      void loadEntries();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadEntries]);

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

  const formattedRows = useMemo(() => {
    // 1. Filter
    const filtered = entries.filter((entry) => {
      const matchSearch =
        !search ||
        (entry.name || "").toLowerCase().includes(search.toLowerCase()) ||
        entry.email.toLowerCase().includes(search.toLowerCase()) ||
        (entry.businessName || "").toLowerCase().includes(search.toLowerCase()) ||
        entry.id.toLowerCase().includes(search.toLowerCase());

      const matchAudience = audienceFilter === "all" || entry.audience === audienceFilter;
      const matchSource = sourceFilter === "all" || entry.source === sourceFilter;

      return matchSearch && matchAudience && matchSource;
    });

    // 2. Sort
    filtered.sort((a, b) => {
      let fieldA = a[sortField as keyof ConsoleWaitlistEntry] ?? "";
      let fieldB = b[sortField as keyof ConsoleWaitlistEntry] ?? "";

      if (typeof fieldA === "object" && fieldA !== null) {
        fieldA = JSON.stringify(fieldA);
      }
      if (typeof fieldB === "object" && fieldB !== null) {
        fieldB = JSON.stringify(fieldB);
      }

      if (fieldA < fieldB) return sortDirection === "asc" ? -1 : 1;
      if (fieldA > fieldB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    // 3. Format
    return filtered.map((entry) => ({
      ...entry,
      submittedLocal: new Date(entry.submittedAt).toLocaleString("en-SG", {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        year: "numeric",
      }),
      updatedLocal: new Date(entry.updatedAt || entry.submittedAt).toLocaleString("en-SG", {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        year: "numeric",
      }),
    }));
  }, [entries, search, audienceFilter, sourceFilter, sortField, sortDirection]);

  return (
    <div>
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Waitlist submissions</h1>
          <p>Review every field sent from the Waitlist form, including merchant-specific details.</p>
        </div>
        <Link href="/console" className={styles.actionButtonSecondary}>
          Back to Console
        </Link>
      </div>

      <div className={styles.kpiCard}>
        <div className={styles.kpiLabel}>Data source</div>
        <div className={styles.kpiValue}>{configured ? "Supabase" : "Prototype / not configured"}</div>
        <div className={styles.kpiDelta}>
          {lastSyncedAt
            ? `Synced ${lastSyncedAt.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })}`
            : "All submitted rows are listed in submission order."}
        </div>
      </div>

      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}>
          <h2>Captured submissions ({formattedRows.length})</h2>
          <button
            type="button"
            className={styles.actionButtonSecondary}
            onClick={() => void loadEntries()}
            disabled={refreshing || loading === "loading"}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Filters */}
        <div className={styles.filterBar} style={{ marginBottom: "var(--space-4)" }}>
          <div className={styles.filterSearchWrapper} style={{ flex: "1 1 220px", maxWidth: "360px" }}>
            <Search size={15} style={{ color: "var(--color-text-muted)", marginRight: "8px" }} />
            <input
              type="search"
              placeholder="Search name, email, business..."
              className={styles.filterSearchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search waitlist submissions"
            />
          </div>
          <label className={styles.visuallyHiddenInput} htmlFor="waitlist-audience-filter">
            Filter waitlist submissions by audience
          </label>
          <select
            id="waitlist-audience-filter"
            className={styles.filterSelect}
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
          >
            <option value="all">All Audiences</option>
            <option value="foodie">Foodie</option>
            <option value="merchant">Merchant</option>
            <option value="both">Both</option>
          </select>
          <label className={styles.visuallyHiddenInput} htmlFor="waitlist-source-filter">
            Filter waitlist submissions by source
          </label>
          <select
            id="waitlist-source-filter"
            className={styles.filterSelect}
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="all">All Sources</option>
            <option value="web_v2">Web V2</option>
            <option value="marketing_web">Marketing Web</option>
            <option value="merchant_portal">Merchant Portal</option>
            <option value="console">Console</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        {loading === "loading" ? (
          <p>Loading waitlist submissions…</p>
        ) : loading === "error" ? (
          <p role="alert" style={{ color: "var(--color-critical)" }}>
            {errorMessage}
          </p>
        ) : formattedRows.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>No matching waitlist entries found.</p>
        ) : (
          <div className={`${styles.queueTableWrapper} ${styles.waitlistTableWrapper}`}>
            <table className={`${styles.queueTable} ${styles.waitlistTable}`}>
              <thead>
                <tr>
                  {renderSortHeader("Submitted", "submittedAt")}
                  {renderSortHeader("Updated", "updatedAt")}
                  {renderSortHeader("Audience", "audience")}
                  {renderSortHeader("Name", "name")}
                  {renderSortHeader("Email", "email")}
                  {renderSortHeader("Business name", "businessName")}
                  {renderSortHeader("Business type", "establishmentType")}
                  {renderSortHeader("Source", "source")}
                  <th>Metadata</th>
                  {renderSortHeader("ID", "id")}
                </tr>
              </thead>
              <tbody>
                {formattedRows.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.submittedLocal}</td>
                    <td>{entry.updatedLocal}</td>
                    <td>
                      <span
                        className={styles.badge}
                        style={{
                          backgroundColor:
                            entry.audience === "merchant" ? "var(--console-bg-warm)" : "var(--console-bg-soft)",
                          color: "var(--color-text-primary)",
                        }}
                      >
                        {prettyAudience(entry.audience)}
                      </span>
                    </td>
                    <td>{entry.name || "—"}</td>
                    <td>
                      <span
                        title={entry.emailRedacted ? "Email redacted by default for privacy." : entry.email}
                        style={{ color: "var(--color-primary)" }}
                      >
                        {entry.email}
                      </span>
                    </td>
                    <td>{entry.businessName || "—"}</td>
                    <td>{entry.establishmentType || "—"}</td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <Users size={14} /> {prettySource(entry.source)}
                      </span>
                    </td>
                    <td style={{ maxWidth: "320px", whiteSpace: "pre-wrap" }} title={prettyMetadata(entry.metadata)}>
                      <pre
                        style={{
                          margin: 0,
                          fontSize: "11px",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          lineHeight: 1.35,
                        }}
                      >
                        {prettyMetadata(entry.metadata)}
                      </pre>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-xs)" }}>
                      {entry.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
