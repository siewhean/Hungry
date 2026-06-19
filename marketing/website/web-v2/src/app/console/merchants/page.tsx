"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Search,
  Store,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  MapPin,
  Star,
  ShieldCheck,
  X,
  Eye,
  ExternalLink,
} from "lucide-react";
import styles from "../console.module.css";
import {
  PROTOTYPE_MERCHANT_NAME,
  updateMerchantVerificationStatus,
} from "@/lib/merchantVerification";
import { redactIdentifier } from "@/lib/console/redaction";
import { getConsolePrototypeFallback, readConsolePrototypeStorage, writeConsolePrototypeStorage } from "@/lib/console/prototypeStorage";

type VerificationStatus =
  | "verified"
  | "in_review"
  | "rejected"
  | "not_started"
  | "more_info_needed";

type AccountStatus = "active" | "warned" | "suspended";

interface Merchant {
  id: string;
  name: string;
  type: string;
  location: string;
  cuisine: string;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  dishCount: number;
  rating: number;
  joinedDate: string;
  lastActive: string;
  teamSize: number;
  uen?: string;
  registeredEntity?: string;
  lat?: number;
  lng?: number;
  auditLog?: string[];
}

type ConsoleMerchantsApiResponse = {
  configured?: boolean;
  error?: string;
  merchants?: Merchant[];
};

const initialMockMerchants: Merchant[] = [
  { id: "M-001", name: "Old Airport Road Lor Mee", type: "Hawker Stall", location: "Old Airport Road Food Centre, #01-12", cuisine: "Hokkien", verificationStatus: "verified", accountStatus: "active", dishCount: 8, rating: 4.7, joinedDate: "Mar 2024", lastActive: "Today", teamSize: 2, uen: "202408101C", registeredEntity: "OLD AIRPORT ROAD LOR MEE PTE. LTD.", lat: 1.3082, lng: 103.8858, auditLog: ["System initialized - Mar 2024", "Verified by ops - Apr 2024"] },
  { id: "M-002", name: "Ah Seng Braised Duck", type: "Hawker Stall", location: "Toa Payoh Lorong 8, #01-05", cuisine: "Teochew", verificationStatus: "in_review", accountStatus: "active", dishCount: 5, rating: 4.4, joinedDate: "Apr 2024", lastActive: "2 days ago", teamSize: 1, uen: "202409021Z", registeredEntity: "AH SENG DUCK SPECIALIST", lat: 1.3384, lng: 103.8502, auditLog: ["System initialized - Apr 2024", "Application received - Apr 2024"] },
  { id: "M-003", name: "Grain & Grind", type: "Cafe", location: "Tiong Bahru Plaza, #02-18", cuisine: "Western / Coffee", verificationStatus: "verified", accountStatus: "active", dishCount: 22, rating: 4.6, joinedDate: "Jan 2024", lastActive: "Today", teamSize: 4, uen: "202302482E", registeredEntity: "GRAIN & GRIND CAFE PTE. LTD.", lat: 1.2863, lng: 103.8271, auditLog: ["System initialized - Jan 2024"] },
  { id: "M-004", name: PROTOTYPE_MERCHANT_NAME, type: "Hawker Stall", location: "Prototype Food Centre, #01-28", cuisine: "Prototype cuisine", verificationStatus: "rejected", accountStatus: "active", dishCount: 3, rating: 4.1, joinedDate: "May 2024", lastActive: "1 week ago", teamSize: 1, uen: "PROTOTYPE-UEN", registeredEntity: "PROTOTYPE MERCHANT ENTITY", lat: 1.2804, lng: 103.8448, auditLog: ["System initialized - May 2024", "Rejected due to missing SFA license - May 2024"] },
  { id: "M-005", name: "Betsy's Kitchen", type: "Home-Based", location: "Buona Vista (Approximate)", cuisine: "Peranakan", verificationStatus: "more_info_needed", accountStatus: "active", dishCount: 12, rating: 4.8, joinedDate: "Feb 2024", lastActive: "3 days ago", teamSize: 1, uen: "53491823B", registeredEntity: "BETSY HOME KITCHEN ENTERPRISE", lat: 1.3062, lng: 103.7906, auditLog: ["System initialized - Feb 2024"] },
  { id: "M-006", name: "Spice Garden Restaurant", type: "Restaurant", location: "Orchard Gateway, #03-11", cuisine: "Indian", verificationStatus: "verified", accountStatus: "warned", dishCount: 41, rating: 3.9, joinedDate: "Nov 2023", lastActive: "Yesterday", teamSize: 6, uen: "202309123M", registeredEntity: "SPICE GARDEN CATERING PTE. LTD.", lat: 1.3009, lng: 103.8394, auditLog: ["System initialized - Nov 2023", "Warned for low rating - May 2024"] },
  { id: "M-007", name: "Koh Family Noodles", type: "Food Court", location: "Jurong Point, Level 2", cuisine: "Cantonese", verificationStatus: "not_started", accountStatus: "active", dishCount: 0, rating: 0, joinedDate: "May 2024", lastActive: "5 days ago", teamSize: 1, uen: "53489124L", registeredEntity: "KOH FAMILY NOODLES", lat: 1.3396, lng: 103.7067, auditLog: ["System initialized - May 2024"] },
  { id: "M-008", name: "Tan's Satay House", type: "Hawker Stall", location: "Lau Pa Sat, #01-30", cuisine: "Malay", verificationStatus: "verified", accountStatus: "suspended", dishCount: 15, rating: 4.2, joinedDate: "Jan 2023", lastActive: "2 weeks ago", teamSize: 3, uen: "202300121H", registeredEntity: "TAN SATAY GROUP PTE. LTD.", lat: 1.2806, lng: 103.8504, auditLog: ["System initialized - Jan 2023", "Suspended for repeated service absence - Apr 2024"] },
];

const verificationConfig: Record<VerificationStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  verified: { label: "Verified", color: "#065F46", bg: "#ECFDF5", icon: <CheckCircle size={13} /> },
  in_review: { label: "In Review", color: "#1E40AF", bg: "#EBF5FF", icon: <Clock size={13} /> },
  rejected: { label: "Rejected", color: "#991B1B", bg: "#FEE2E2", icon: <XCircle size={13} /> },
  not_started: { label: "Not Started", color: "#6B7280", bg: "#F3F4F6", icon: <AlertCircle size={13} /> },
  more_info_needed: { label: "More Info", color: "#92400E", bg: "#FEF3C7", icon: <AlertCircle size={13} /> },
};

const accountStatusConfig: Record<AccountStatus, { bg: string; color: string }> = {
  active: { bg: "#ECFDF5", color: "#065F46" },
  warned: { bg: "#FEF3C7", color: "#92400E" },
  suspended: { bg: "#FEE2E2", color: "#991B1B" },
};

export default function MerchantsPage() {
  const [merchants, setMerchants] = React.useState<Merchant[]>(() => {
    return readConsolePrototypeStorage("console_merchants", getConsolePrototypeFallback(initialMockMerchants, []));
  });

  const [search, setSearch] = useState("");
  const [filterVerification, setFilterVerification] = useState<VerificationStatus | "all">("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Merchant | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [isDbBacked, setIsDbBacked] = useState(false);

  // Editable Drawer State
  const [editUen, setEditUen] = useState("");
  const [editEntity, setEditEntity] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [newAuditNote, setNewAuditNote] = useState("");

  const saveMerchants = (updated: Merchant[]) => {
    setMerchants(updated);
    if (!isDbBacked && typeof window !== "undefined") {
      writeConsolePrototypeStorage("console_merchants", updated);
    }
  };

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/console/merchants", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as ConsoleMerchantsApiResponse;
        if (!response.ok) throw new Error(payload.error ?? "Unable to load merchants.");
        return payload;
      })
      .then((payload) => {
        if (cancelled || !payload.configured || !payload.merchants) return;
        setMerchants(payload.merchants);
        setIsDbBacked(true);
      })
      .catch((error) => {
        if (!cancelled) showToast(error instanceof Error ? error.message : "Using local merchant fallback.", "info");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function showToast(message: string, type: "success" | "error" | "info" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const handleSelectMerchant = (m: Merchant) => {
    setSelectedMerchant(m);
    setEditUen("");
    setEditEntity(m.registeredEntity || "");
    setEditLat(m.lat !== undefined ? String(m.lat) : "");
    setEditLng(m.lng !== undefined ? String(m.lng) : "");
    setNewAuditNote("");
  };

  const handleSaveBusinessDetails = () => {
    if (!selectedMerchant) return;
    const parsedLat = parseFloat(editLat);
    const parsedLng = parseFloat(editLng);

    const updated = merchants.map((m) => {
      if (m.id === selectedMerchant.id) {
        const logs = [...(m.auditLog || [])];
        const nextUen = editUen.trim() || m.uen;
        if (editUen.trim() && m.uen !== nextUen) logs.push("UEN updated - Today");
        if (m.registeredEntity !== editEntity) logs.push(`Registered Entity updated to ${editEntity} - Today`);
        if (m.lat !== parsedLat || m.lng !== parsedLng) logs.push(`GPS Coordinates updated to ${parsedLat}, ${parsedLng} - Today`);

        return {
          ...m,
          uen: nextUen,
          registeredEntity: editEntity,
          lat: isNaN(parsedLat) ? undefined : parsedLat,
          lng: isNaN(parsedLng) ? undefined : parsedLng,
          auditLog: logs,
        };
      }
      return m;
    });

    saveMerchants(updated);
    const syncObj = updated.find(m => m.id === selectedMerchant.id);
    if (syncObj) {
      setSelectedMerchant(syncObj);
    }
    showToast("Business details updated successfully", "success");
  };

  const handleAddAuditNote = () => {
    if (!selectedMerchant || !newAuditNote.trim()) return;
    const updated = merchants.map((m) => {
      if (m.id === selectedMerchant.id) {
        return {
          ...m,
          auditLog: [...(m.auditLog || []), `${newAuditNote.trim()} - Today`],
        };
      }
      return m;
    });

    saveMerchants(updated);
    const syncObj = updated.find(m => m.id === selectedMerchant.id);
    if (syncObj) {
      setSelectedMerchant(syncObj);
    }
    setNewAuditNote("");
    showToast("Audit note added", "success");
  };

  const filtered = merchants.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.location.toLowerCase().includes(search.toLowerCase()) ||
      m.type.toLowerCase().includes(search.toLowerCase()) ||
      m.cuisine.toLowerCase().includes(search.toLowerCase());
    const matchVerification = filterVerification === "all" || m.verificationStatus === filterVerification;
    const matchType = filterType === "all" || m.type === filterType;
    return matchSearch && matchVerification && matchType;
  });

  const verifiedCount = merchants.filter((m) => m.verificationStatus === "verified").length;
  const inReviewCount = merchants.filter((m) => m.verificationStatus === "in_review").length;
  const pendingInfoCount = merchants.filter((m) => m.verificationStatus === "more_info_needed").length;
  const suspendedCount = merchants.filter((m) => m.accountStatus === "suspended").length;

  const handleVerify = async (id: string) => {
    const merchant = merchants.find((m) => m.id === id);
    if (isDbBacked) {
      const response = await fetch(`/api/console/merchants/${id}/verification`, {
        body: JSON.stringify({ status: "verified" }),
        headers: { "Content-Type": "application/json", "x-hungry-csrf": "same-origin" },
        method: "PATCH",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Unable to verify merchant.", "error");
        return;
      }
    }
    const updated = merchants.map((m) => {
      if (m.id === id) {
        return {
          ...m,
          verificationStatus: "verified" as VerificationStatus,
          auditLog: [...(m.auditLog || []), "Verification granted - Today"]
        };
      }
      return m;
    });
    saveMerchants(updated);
    const syncObj = updated.find(m => m.id === id);
    if (syncObj) {
      setSelectedMerchant(syncObj);
    }
    if (merchant?.name === PROTOTYPE_MERCHANT_NAME) {
      updateMerchantVerificationStatus("approved", {
        updatedBy: "Hungry Console",
        message: "Hungry Ops granted verification from the merchant account record. Your full merchant dashboard is now available.",
        stepUpdates: {
          documents: "verified",
          walkaround: "verified",
          corppass: "verified",
        },
      });
    }
    showToast("Merchant verified successfully", "success");
  };

  const handleWarn = (id: string, name: string) => {
    const updated = merchants.map((m) => {
      if (m.id === id) {
        return {
          ...m,
          accountStatus: "warned" as AccountStatus,
          auditLog: [...(m.auditLog || []), "Account warned for compliance review - Today"]
        };
      }
      return m;
    });
    saveMerchants(updated);
    const syncObj = updated.find(m => m.id === id);
    if (syncObj) {
      setSelectedMerchant(syncObj);
    }
    showToast(`Warning issued to ${name}`, "info");
  };

  const handleUnsuspend = (id: string) => {
    const updated = merchants.map((m) => {
      if (m.id === id) {
        return {
          ...m,
          accountStatus: "active" as AccountStatus,
          auditLog: [...(m.auditLog || []), "Account unsuspended and activated - Today"]
        };
      }
      return m;
    });
    saveMerchants(updated);
    const syncObj = updated.find(m => m.id === id);
    if (syncObj) {
      setSelectedMerchant(syncObj);
    }
    showToast("Account activated successfully", "success");
  };

  const confirmSuspend = () => {
    if (!suspendTarget) return;
    const updated = merchants.map((m) => {
      if (m.id === suspendTarget.id) {
        return {
          ...m,
          accountStatus: "suspended" as AccountStatus,
          auditLog: [...(m.auditLog || []), "Account suspended - Today"]
        };
      }
      return m;
    });
    saveMerchants(updated);
    const syncObj = updated.find(m => m.id === suspendTarget.id);
    if (syncObj) {
      setSelectedMerchant(syncObj);
    }
    showToast(`${suspendTarget.name} has been suspended`, "error");
    setSuspendTarget(null);
  };

  return (
    <div>
      {/* HEADER */}
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Merchant Management</h1>
          <p>Search, review, and manage merchant accounts, verification status, and profiles.</p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <Link href="/console/merchant-applications" className={styles.actionButtonSecondary}>
            <Clock size={14} />
            Review Applications
          </Link>
        </div>
      </div>

      {/* KPI SUMMARY */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Merchants</span>
          <span className={styles.kpiValue}>{merchants.length}</span>
          <span className={`${styles.kpiTrend} ${styles.trendNeutral}`}>Across all types</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Verified</span>
          <span className={styles.kpiValue} style={{ color: "#059669" }}>{verifiedCount}</span>
          <span className={`${styles.kpiTrend} ${styles.trendUp}`}>{merchants.length > 0 ? Math.round((verifiedCount / merchants.length) * 100) : 0}% verification rate</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>In Review</span>
          <span className={styles.kpiValue} style={{ color: "#3B82F6" }}>{inReviewCount}</span>
          <span className={`${styles.kpiTrend} ${styles.trendNeutral}`}>Awaiting ops review</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Needs Attention</span>
          <span className={styles.kpiValue} style={{ color: "#F59E0B" }}>{pendingInfoCount + suspendedCount}</span>
          <span className={`${styles.kpiTrend} ${styles.trendDown}`}>{pendingInfoCount} more info · {suspendedCount} suspended</span>
        </div>
      </div>

      {/* FILTERS */}
      <div className={styles.dashboardSectionCard}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
          <div className={styles.filterSearchWrapper} style={{ flex: "1 1 220px", maxWidth: "360px" }}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search merchants, location, type..."
              className={styles.filterSearchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            value={filterVerification}
            onChange={(e) => setFilterVerification(e.target.value as VerificationStatus | "all")}
            className={styles.filterSelect}
          >
            <option value="all">All Verification</option>
            <option value="verified">Verified</option>
            <option value="in_review">In Review</option>
            <option value="more_info_needed">More Info Needed</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Types</option>
            <option value="Hawker Stall">Hawker Stall</option>
            <option value="Food Court">Food Court</option>
            <option value="Restaurant">Restaurant</option>
            <option value="Cafe">Cafe</option>
            <option value="Home-Based">Home-Based</option>
          </select>

          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginLeft: "auto" }}>
            {filtered.length} of {merchants.length} merchants
          </span>
        </div>
      </div>

      {/* MERCHANT LIST */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {filtered.map((merchant) => {
          const vConfig = verificationConfig[merchant.verificationStatus] || verificationConfig.more_info_needed;
          const aConfig = accountStatusConfig[merchant.accountStatus];
          return (
            <div
              key={merchant.id}
              className={styles.dashboardSectionCard}
              style={{ marginBottom: 0, cursor: "pointer" }}
              onClick={() => handleSelectMerchant(merchant)}
            >
              <div style={{ display: "flex", gap: "var(--space-5)", alignItems: "flex-start", flexWrap: "wrap" }}>
                {/* Icon + Name */}
                <div style={{ display: "flex", gap: "var(--space-4)", flex: "1 1 280px", alignItems: "center" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "var(--radius-lg)", background: "var(--color-bg-warm)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Store size={22} style={{ color: "var(--color-primary)" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "var(--font-size-md)", color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      {merchant.name}
                      {merchant.verificationStatus === "verified" && (
                        <ShieldCheck size={15} style={{ color: "#059669" }} aria-label="Verified" />
                      )}
                    </div>
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "2px" }}>
                      <MapPin size={11} />{merchant.location}
                    </div>
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>
                      {merchant.type} · {merchant.cuisine}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", gap: "var(--space-6)", alignItems: "center", flexWrap: "wrap", flex: "1 1 auto" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: "800", fontSize: "1.1rem", color: "var(--color-text-primary)" }}>{merchant.dishCount}</div>
                    <div style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>Dishes</div>
                  </div>
                  {merchant.rating > 0 && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: "800", fontSize: "1.1rem", color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "3px" }}>
                        <Star size={13} style={{ color: "#F59E0B", fill: "#F59E0B" }} />{merchant.rating}
                      </div>
                      <div style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>Rating</div>
                    </div>
                  )}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: "800", fontSize: "1.1rem", color: "var(--color-text-primary)" }}>{merchant.teamSize}</div>
                    <div style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>Team</div>
                  </div>
                </div>

                {/* Badges + Actions */}
                <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
                  <span className={styles.badge} style={{ backgroundColor: vConfig.bg, color: vConfig.color, display: "flex", alignItems: "center", gap: "4px" }}>
                    {vConfig.icon}{vConfig.label}
                  </span>
                  <span className={styles.badge} style={{ backgroundColor: aConfig.bg, color: aConfig.color }}>
                    {merchant.accountStatus.charAt(0).toUpperCase() + merchant.accountStatus.slice(1)}
                  </span>
                  <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                    Active {merchant.lastActive}
                  </span>
                  <button
                    className={styles.rowAction}
                    onClick={(e) => { e.stopPropagation(); handleSelectMerchant(merchant); }}
                    style={{ fontSize: "var(--font-size-xs)" }}
                  >
                    <Eye size={13} /> View
                  </button>
                </div>
              </div>

              {/* Footer row */}
              <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-border)", display: "flex", gap: "var(--space-4)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", flexWrap: "wrap" }}>
                <span>ID: {merchant.id}</span>
                <span>Joined {merchant.joinedDate}</span>
                <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  <MapPin size={11} /> {merchant.type === "Home-Based" ? "Location hidden" : merchant.location}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className={styles.emptyState}>
          <Store size={40} />
          <div className={styles.emptyStateTitle}>No merchants found</div>
          <div className={styles.emptyStateDesc}>Try adjusting your search or filter criteria.</div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {selectedMerchant && (
        <>
          <div
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 100 }}
            onClick={() => setSelectedMerchant(null)}
          />
          <div
            className={styles.drawerPanel}
            role="dialog"
            aria-modal="true"
            aria-label="Merchant details"
          >
            <div className={styles.drawerHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>{selectedMerchant.name}</h2>
                <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "4px" }}>{selectedMerchant.id}</p>
              </div>
              <button className={styles.drawerCloseBtn} onClick={() => setSelectedMerchant(null)} aria-label="Close merchant details">
                <X size={20} />
              </button>
            </div>
            <div className={styles.drawerBody} style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
              <div className={styles.drawerFieldRow}>
                <span className={styles.drawerFieldLabel}>Type</span>
                <span className={styles.drawerFieldValue}>{selectedMerchant.type}</span>
              </div>
              <div className={styles.drawerFieldRow}>
                <span className={styles.drawerFieldLabel}>Cuisine</span>
                <span className={styles.drawerFieldValue}>{selectedMerchant.cuisine}</span>
              </div>
              <div className={styles.drawerFieldRow}>
                <span className={styles.drawerFieldLabel}>Joined</span>
                <span className={styles.drawerFieldValue}>{selectedMerchant.joinedDate}</span>
              </div>
              <div className={styles.drawerFieldRow}>
                <span className={styles.drawerFieldLabel}>Last Active</span>
                <span className={styles.drawerFieldValue}>{selectedMerchant.lastActive}</span>
              </div>
              <div className={styles.drawerFieldRow}>
                <span className={styles.drawerFieldLabel}>Dishes</span>
                <span className={styles.drawerFieldValue}>{selectedMerchant.dishCount}</span>
              </div>
              <div className={styles.drawerFieldRow}>
                <span className={styles.drawerFieldLabel}>Rating</span>
                <span className={styles.drawerFieldValue}>{selectedMerchant.rating > 0 ? `${selectedMerchant.rating} ★` : "No ratings yet"}</span>
              </div>
              <div className={styles.drawerFieldRow}>
                <span className={styles.drawerFieldLabel}>Team Size</span>
                <span className={styles.drawerFieldValue}>{selectedMerchant.teamSize}</span>
              </div>
              <div className={styles.drawerFieldRow}>
                <span className={styles.drawerFieldLabel}>Verification</span>
                <span className={styles.drawerFieldValue}>
                  <span className={styles.badge} style={{ backgroundColor: (verificationConfig[selectedMerchant.verificationStatus] || verificationConfig.more_info_needed).bg, color: (verificationConfig[selectedMerchant.verificationStatus] || verificationConfig.more_info_needed).color }}>
                    {(verificationConfig[selectedMerchant.verificationStatus] || verificationConfig.more_info_needed).label}
                  </span>
                </span>
              </div>
              <div className={styles.drawerFieldRow}>
                <span className={styles.drawerFieldLabel}>Account Status</span>
                <span className={styles.drawerFieldValue}>
                  <span className={styles.badge} style={{ backgroundColor: accountStatusConfig[selectedMerchant.accountStatus].bg, color: accountStatusConfig[selectedMerchant.accountStatus].color }}>
                    {selectedMerchant.accountStatus.charAt(0).toUpperCase() + selectedMerchant.accountStatus.slice(1)}
                  </span>
                </span>
              </div>

              {/* Regulatory & GPS Details */}
              <div style={{ margin: "var(--space-4) 0", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}>
                <h3 style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-3)" }}>Business Credentials</h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>UEN Registration</label>
                    <div style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
                      Current: {redactIdentifier(selectedMerchant.uen, 3, 2)}
                    </div>
                    <input
                      type="text"
                      value={editUen}
                      onChange={(e) => setEditUen(e.target.value)}
                      placeholder="Enter replacement UEN only"
                      style={{ width: "100%", padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-bg)", fontSize: "var(--font-size-sm)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>ACRA Registered Entity</label>
                    <input
                      type="text"
                      value={editEntity}
                      onChange={(e) => setEditEntity(e.target.value)}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-bg)", fontSize: "var(--font-size-sm)" }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ margin: "var(--space-4) 0", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}>
                <h3 style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-3)" }}>Location & GPS Override</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>Full Street Address</label>
                    <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-primary)" }}>{selectedMerchant.location}</span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>Latitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={editLat}
                        onChange={(e) => setEditLat(e.target.value)}
                        style={{ width: "100%", padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-bg)", fontSize: "var(--font-size-sm)" }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>Longitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={editLng}
                        onChange={(e) => setEditLng(e.target.value)}
                        style={{ width: "100%", padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-bg)", fontSize: "var(--font-size-sm)" }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSaveBusinessDetails}
                    className={styles.actionButtonSecondary}
                    style={{ marginTop: "8px", width: "100%" }}
                  >
                    Save Business Details & GPS
                  </button>
                </div>
              </div>

              <div style={{ margin: "var(--space-4) 0", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}>
                <h3 style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-3)" }}>Compliance Audit Trail</h3>

                <div style={{ maxHeight: "120px", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "8px", background: "var(--color-bg-soft)", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                  {selectedMerchant.auditLog && selectedMerchant.auditLog.length > 0 ? (
                    selectedMerchant.auditLog.map((log, index) => (
                      <div key={index} style={{ fontSize: "11px", color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border-light)", paddingBottom: "4px" }}>
                        {log}
                      </div>
                    ))
                  ) : (
                    <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>No audits recorded</span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="New audit action/note..."
                    value={newAuditNote}
                    onChange={(e) => setNewAuditNote(e.target.value)}
                    style={{ flex: 1, padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-bg)", fontSize: "var(--font-size-sm)" }}
                  />
                  <button
                    onClick={handleAddAuditNote}
                    className={`${styles.rowAction} ${styles.rowActionPrimary}`}
                    style={{ padding: "6px 12px" }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div style={{ marginTop: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
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
                {selectedMerchant.verificationStatus !== "verified" && (
                  <button
                    className={`${styles.rowAction} ${styles.rowActionPrimary}`}
                    onClick={() => handleVerify(selectedMerchant.id)}
                  >
                    <ShieldCheck size={14} /> Grant Verification
                  </button>
                )}
                {selectedMerchant.accountStatus !== "warned" && selectedMerchant.accountStatus !== "suspended" && (
                  <button
                    className={styles.rowAction}
                    onClick={() => handleWarn(selectedMerchant.id, selectedMerchant.name)}
                  >
                    <AlertCircle size={14} /> Warn Merchant
                  </button>
                )}
                {selectedMerchant.accountStatus === "suspended" ? (
                  <button
                    className={styles.rowAction}
                    style={{ color: "var(--color-success)", borderColor: "var(--color-success)" }}
                    onClick={() => handleUnsuspend(selectedMerchant.id)}
                  >
                    Activate Account
                  </button>
                ) : (
                  <button
                    className={`${styles.rowAction} ${styles.rowActionDanger}`}
                    onClick={() => { setSuspendTarget(selectedMerchant); }}
                  >
                    Suspend Account
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* SUSPEND CONFIRMATION MODAL */}
      {suspendTarget && (
        <div className={styles.modalOverlay}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-label="Suspend merchant account"
          >
            <div className={styles.modalHeader}>
              <h3>Suspend Account?</h3>
            </div>
            <div className={styles.modalBody}>
              <p>This will suspend <strong>{suspendTarget.name}</strong> and prevent them from accessing the platform. You can reinstate them later.</p>
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
