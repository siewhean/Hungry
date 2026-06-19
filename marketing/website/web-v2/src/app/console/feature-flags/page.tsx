"use client";

import React, { useState } from "react";
import { AlertTriangle, ShieldCheck, Check, Users, Settings } from "lucide-react";
import { getConsolePrototypeFallback, readConsolePrototypeStorage, writeConsolePrototypeStorage } from "@/lib/console/prototypeStorage";
import styles from "../console.module.css";

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercent: number;
  environment: "Production" | "Staging" | "Preview";
  audiences: string[];
}

const initialFlags: FeatureFlag[] = [
  { key: "merchantCentreEnabled", name: "Merchant Centre Beta Access", description: "Enables merchant tabs, profiles, settings, and verification centre for verified merchant roles.", enabled: true, rolloutPercent: 100, environment: "Production", audiences: ["Beta Merchants", "Internal QA"] },
  { key: "directMessagesEnabled", name: "Direct Messaging & Chat", description: "Enables direct private customer communication and real-time chat support rooms.", enabled: true, rolloutPercent: 25, environment: "Production", audiences: ["Power Foodies", "Internal QA"] },
  { key: "storiesEnabled", name: "Stories Viewer & Creator", description: "Enables visual stories circles on Home discover feeds and merchant profile hubs.", enabled: true, rolloutPercent: 50, environment: "Production", audiences: ["Power Foodies", "Pilot Malls", "Internal QA"] },
  { key: "gamificationEnabled", name: "Passport & Mission Boards", description: "Enables gamified FoodCred logs, passport stamps, and active visitor missions.", enabled: true, rolloutPercent: 100, environment: "Production", audiences: ["All Foodies", "Power Foodies"] },
  { key: "floorplansEnabled", name: "Indoor Floorplan Polygons", description: "Registers internal shopping mall floor layouts and unit switching panels.", enabled: false, rolloutPercent: 0, environment: "Production", audiences: ["Internal QA"] },
  { key: "mockMapboxEnabled", name: "Mock Mapbox coordinate fallback", description: "Forces local map components to fall back to coordinates preview if token missing.", enabled: false, rolloutPercent: 0, environment: "Staging", audiences: ["Internal QA"] },
];

const AUDIENCE_OPTIONS = ["All Foodies", "Power Foodies", "Beta Merchants", "Pilot Malls", "Internal QA"];

export default function FeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(() => {
    return readConsolePrototypeStorage("console_feature_flags", getConsolePrototypeFallback(initialFlags, []));
  });

  const [activeModalFlag, setActiveModalFlag] = useState<FeatureFlag | null>(null);
  const [sliderVal, setSliderVal] = useState<number>(0);
  const [toggleVal, setToggleVal] = useState<boolean>(false);
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [auditReason, setAuditReason] = useState<string>("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEditClick = (flag: FeatureFlag) => {
    setActiveModalFlag(flag);
    setSliderVal(flag.rolloutPercent);
    setToggleVal(flag.enabled);
    setSelectedAudiences(flag.audiences || []);
    setAuditReason("");
  };

  const handleToggleClick = (flag: FeatureFlag, e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    const updated = flags.map(f => f.key === flag.key ? { ...f, enabled: isChecked, rolloutPercent: isChecked ? f.rolloutPercent || 50 : 0 } : f);
    setFlags(updated);
    writeConsolePrototypeStorage("console_feature_flags", updated);
    showToast(`Flag '${flag.key}' state toggled to ${isChecked ? "active" : "disabled"}`, "info");

    // Dispatch general event
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("consoleAdminAction", {
        detail: {
          action: "feature flag toggle",
          target: flag.name,
          notes: `Flag '${flag.key}' toggled: Enabled = ${isChecked}`
        }
      }));
    }
  };

  const handleSliderChange = (flag: FeatureFlag, val: number) => {
    const updated = flags.map(f => f.key === flag.key ? { ...f, rolloutPercent: val, enabled: val > 0 ? true : f.enabled } : f);
    setFlags(updated);
    writeConsolePrototypeStorage("console_feature_flags", updated);
  };

  const handleAudienceCheckbox = (audience: string) => {
    if (selectedAudiences.includes(audience)) {
      setSelectedAudiences(prev => prev.filter(a => a !== audience));
    } else {
      setSelectedAudiences(prev => [...prev, audience]);
    }
  };

  const confirmChange = () => {
    if (!activeModalFlag) return;

    const updated = flags.map(flag =>
      flag.key === activeModalFlag.key
        ? { ...flag, enabled: toggleVal, rolloutPercent: sliderVal, audiences: selectedAudiences }
        : flag
    );

    setFlags(updated);
    writeConsolePrototypeStorage("console_feature_flags", updated);

    // Track in audit log
    if (typeof window !== "undefined") {
      const orig = flags.find(f => f.key === activeModalFlag.key);
      const auditEvent = new CustomEvent("consoleAdminAction", {
        detail: {
          action: "feature flag changed",
          target: activeModalFlag.name,
          notes: `Flag '${activeModalFlag.key}' changed: [Enabled: ${orig?.enabled} -> ${toggleVal}], [Rollout: ${orig?.rolloutPercent}% -> ${sliderVal}%], [Audiences: ${orig?.audiences?.join(", ")} -> ${selectedAudiences.join(", ")}]. Reason: ${auditReason || "Routine deployment"}`
        }
      });
      window.dispatchEvent(auditEvent);
    }

    showToast("Flag configurations deployed", "success");
    setActiveModalFlag(null);
    setAuditReason("");
  };

  return (
    <div>
      {/* HEADER SECTION */}
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Feature Flags & Remote Configurations</h1>
          <p>Toggle foodie/merchant features, configure percentage-based rollouts, and configure app environment segments.</p>
        </div>
      </div>

      {/* SAFETY NOTICE CARD */}
      <div className={styles.alertFeed} style={{ marginBottom: "24px" }}>
        <div className={`${styles.alertBanner} ${styles.alertBannerWarning}`} style={{ backgroundColor: "#FFFBEB" }}>
          <div className={styles.alertContent}>
            <AlertTriangle size={20} style={{ color: "var(--color-primary)" }} />
            <div className={styles.alertText}>
              <h4>Production Rollout Guardrails Enforced</h4>
              <p>App-wide flags and remote variables require a mandatory <strong>operator change description</strong> for audit tracking.</p>
            </div>
          </div>
        </div>
      </div>

      {/* FLAGS LIST */}
      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}>
          <h2>Active Feature Flags ({flags.length})</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {flags.map((flag) => (
            <div className={styles.flagListItem} key={flag.key} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)", width: "100%" }}>
                <div className={styles.flagMeta} style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <h3 style={{ margin: 0, fontSize: "var(--font-size-md)" }}>{flag.name}</h3>
                    <span className={styles.badge} style={{ borderRadius: "var(--radius-full)", fontSize: "0.6rem", backgroundColor: flag.environment === "Production" ? "#FEE2E2" : "#FEF3C7", color: flag.environment === "Production" ? "#991B1B" : "#92400E" }}>
                      {flag.environment}
                    </span>
                  </div>
                  <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-sm)", margin: "4px 0" }}>{flag.description}</p>
                  <code style={{ fontSize: "0.75rem", color: "var(--color-primary)", fontFamily: "var(--font-mono)" }}>
                    FEATURE_FLAGS.{flag.key}
                  </code>
                </div>

                {/* Switch toggler and configure button */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexShrink: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                      {flag.enabled ? "Active" : "Disabled"}
                    </span>
                    <label className={styles.toggleSwitch}>
                      <input
                        type="checkbox"
                        checked={flag.enabled}
                        onChange={(e) => handleToggleClick(flag, e)}
                      />
                      <span className={styles.slider} />
                    </label>
                  </div>

                  <button
                    className={styles.rowAction}
                    style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px" }}
                    onClick={() => handleEditClick(flag)}
                  >
                    <Settings size={13} /> Edit
                  </button>
                </div>
              </div>

              {/* Slider and Audience preview row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-4)", backgroundColor: "var(--color-bg-soft)", padding: "10px 16px", borderRadius: "var(--radius-md)" }}>
                {/* Rollout slider */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flex: "1 1 240px" }}>
                  <span style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--color-text-secondary)", width: "100px" }}>
                    Rollout: <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}>{flag.rolloutPercent}%</span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={flag.rolloutPercent}
                    title={`${flag.name} Rollout Slider`}
                    className={styles.rolloutSlider}
                    onChange={(e) => handleSliderChange(flag, parseInt(e.target.value))}
                    style={{ accentColor: "var(--color-primary)", cursor: "pointer", flex: 1, height: "6px" }}
                  />
                </div>

                {/* Audiences badge list */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Users size={12} style={{ color: "var(--color-text-muted)" }} />
                  <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontWeight: "600", marginRight: "4px" }}>Targeting:</span>
                  {flag.audiences && flag.audiences.length > 0 ? (
                    flag.audiences.map(aud => (
                      <span
                        key={aud}
                        className={styles.badge}
                        style={{ borderRadius: "var(--radius-full)", fontSize: "10px", padding: "2px 8px", backgroundColor: "var(--color-bg-warm)", color: "var(--color-text-primary)" }}
                      >
                        {aud}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontStyle: "italic" }}>None (Fully gated)</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CONFIRM ACTION & CONFIGS MODAL */}
      {activeModalFlag && (
        <div className={styles.modalOverlay}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-label="Configure remote rollout"
            style={{ maxWidth: "540px" }}
          >
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <ShieldCheck size={20} style={{ color: "var(--color-primary)" }} />
                <h3>Configure Remote Rollouts</h3>
              </div>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                Adjust flags, audiences, and rollouts for: <strong>{activeModalFlag.name}</strong>
              </p>
            </div>

            <div className={styles.modalBody} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Active state and Rollout slider */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px", alignItems: "center", backgroundColor: "var(--color-bg-soft)", padding: "12px", borderRadius: "var(--radius-md)" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>Status</label>
                  <label className={styles.toggleSwitch}>
                    <input
                      type="checkbox"
                      checked={toggleVal}
                      onChange={(e) => setToggleVal(e.target.checked)}
                    />
                    <span className={styles.slider} />
                  </label>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>Rollout Percentage ({sliderVal}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliderVal}
                    title="Edit Rollout Percent"
                    onChange={(e) => setSliderVal(parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--color-primary)", cursor: "pointer" }}
                  />
                </div>
              </div>

              {/* Target Audience checklist selection */}
              <div>
                <label style={{ display: "block", fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--color-text-secondary)", marginBottom: "8px" }}>
                  Target Audience Segments (Checklist Selection)
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", backgroundColor: "var(--color-bg-soft)", padding: "12px", borderRadius: "var(--radius-md)" }}>
                  {AUDIENCE_OPTIONS.map((aud) => (
                    <label key={aud} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "var(--font-size-sm)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedAudiences.includes(aud)}
                        onChange={() => handleAudienceCheckbox(aud)}
                        style={{ accentColor: "var(--color-primary)", cursor: "pointer" }}
                      />
                      <span>{aud}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Audit Reason description */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--color-text-secondary)" }}>
                  Change Description * (Mandatory for deployment audit)
                </label>
                <textarea
                  className={styles.rolloutInput}
                  style={{ width: "100%", height: "70px", textAlign: "left", padding: "8px", fontSize: "var(--font-size-sm)" }}
                  placeholder="Explain the purpose of this remote configuration rollout change..."
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.actionButtonSecondary}
                onClick={() => setActiveModalFlag(null)}
              >
                Cancel
              </button>
              <button
                className={styles.actionButton}
                disabled={!auditReason.trim()}
                style={{ opacity: auditReason.trim() ? 1 : 0.5, cursor: auditReason.trim() ? "pointer" : "not-allowed" }}
                onClick={confirmChange}
              >
                Deploy Configuration Change
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${styles.toastSuccess}`}>
          <Check size={16} />
          {toast.message}
        </div>
      )}
    </div>
  );
}
