"use client";

import React, { useState, useRef } from "react";
import { Plus, Pause, Play, X, CheckCircle, Trash2, Calendar, Target, Sparkles } from "lucide-react";
import styles from "../../console/console.module.css";

type PromoStatus = "active" | "scheduled" | "draft" | "ended" | "paused";
type TabFilter = "all" | PromoStatus;
type PromotionSettings = {
  defaultDiscountType: "percent" | "fixed" | "free_item";
  defaultDiscountValue: string;
  defaultStatus: "draft" | "scheduled" | "active";
};

interface Promotion {
  id: string;
  title: string;
  description: string;
  status: PromoStatus;
  startDate: string;
  endDate: string;
  targetDishes: string[];
  discountType: "percent" | "fixed" | "free_item";
  discountValue: string;
}

let promotionIdSequence = 5;

function nextPromotionId() {
  promotionIdSequence += 1;
  return `p${promotionIdSequence}`;
}

const INITIAL_PROMOS: Promotion[] = [
  { id: "p1", title: "Weekday Lunch Special", description: "20% off selected main dishes between 11am–2pm", status: "active", startDate: "2026-06-01", endDate: "2026-06-30", targetDishes: ["Fuzhou Oyster Cake", "Lor Mee Noodles"], discountType: "percent", discountValue: "20" },
  { id: "p2", title: "National Day Bundle", description: "Buy 2 oyster cakes, get 1 free on 9 Aug", status: "scheduled", startDate: "2026-08-09", endDate: "2026-08-09", targetDishes: ["Fuzhou Oyster Cake"], discountType: "free_item", discountValue: "1" },
  { id: "p3", title: "Early Bird Discount", description: "First 20 customers get S$1 off any item", status: "draft", startDate: "–", endDate: "–", targetDishes: [], discountType: "fixed", discountValue: "1" },
  { id: "p4", title: "Hari Raya Special", description: "S$1 off all items throughout Hari Raya week", status: "ended", startDate: "2026-03-31", endDate: "2026-04-06", targetDishes: [], discountType: "fixed", discountValue: "1" },
  { id: "p5", title: "Loyalty Treat", description: "Free fresh barley water with any main dish order", status: "draft", startDate: "–", endDate: "–", targetDishes: ["Fresh Barley Water"], discountType: "free_item", discountValue: "1" },
];

const BADGE_MAP: Record<PromoStatus, string> = {
  active: styles.badgeActive,
  scheduled: styles.badgeNew,
  draft: styles.badgePending,
  ended: "badge",
  paused: styles.badgePending,
};

const TABS: { key: TabFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "scheduled", label: "Scheduled" },
  { key: "draft", label: "Drafts" },
  { key: "ended", label: "Ended" },
];

const DEFAULT_PROMO_SETTINGS: PromotionSettings = {
  defaultDiscountType: "percent",
  defaultDiscountValue: "15",
  defaultStatus: "draft",
};

export default function MerchantPromotionsPage() {
  const [promos, setPromos] = useState<Promotion[]>(INITIAL_PROMOS);
  const [tab, setTab] = useState<TabFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [promoSettings, setPromoSettings] = useState<PromotionSettings>(DEFAULT_PROMO_SETTINGS);
  const [savedPromoSettings, setSavedPromoSettings] = useState<PromotionSettings>(DEFAULT_PROMO_SETTINGS);

  // Available dishes loaded statefully for multi-select checklist
  const [availableDishes] = useState<string[]>([
    "Fuzhou Oyster Cake",
    "Lor Mee Noodles",
    "Wok-Hei Char Kway Teow",
    "Hainanese Chicken Rice",
    "Crispy Roast Pork Rice",
    "Fresh Barley Water"
  ]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    discountType: "percent" as "percent" | "fixed" | "free_item",
    discountValue: "",
    startDate: "",
    endDate: "",
    targetDishes: [] as string[]
  });
  const [formSnapshot, setFormSnapshot] = useState({
    title: "",
    description: "",
    discountType: "percent" as "percent" | "fixed" | "free_item",
    discountValue: "",
    startDate: "",
    endDate: "",
    targetDishes: [] as string[]
  });

  const getDefaultForm = () => ({
    title: "",
    description: "",
    discountType: promoSettings.defaultDiscountType,
    discountValue: promoSettings.defaultDiscountValue,
    startDate: "",
    endDate: "",
    targetDishes: [] as string[],
  });

  const hasFormChanges = JSON.stringify(form) !== JSON.stringify(formSnapshot);
  const hasSettingChanges = JSON.stringify(promoSettings) !== JSON.stringify(savedPromoSettings);

  const showToast = (msg: string) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast(msg);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  const openCreatePromo = () => {
    const defaults = getDefaultForm();
    setForm(defaults);
    setFormSnapshot(defaults);
    setCreateOpen(true);
  };

  const filtered = promos.filter((p) => tab === "all" || p.status === tab);

  const togglePause = (id: string) => {
    const p = promos.find((x) => x.id === id);
    if (!p) return;
    const next: PromoStatus = p.status === "active" ? "paused" : "active";
    setPromos((prev) => prev.map((x) => x.id === id ? { ...x, status: next } : x));
    showToast(next === "paused" ? `"${p.title}" paused` : `"${p.title}" resumed`);
  };

  const endPromo = (id: string) => {
    const p = promos.find((x) => x.id === id);
    setPromos((prev) => prev.map((x) => x.id === id ? { ...x, status: "ended" } : x));
    if (p) showToast(`"${p.title}" ended`);
  };

  const handleDeletePromo = (id: string) => {
    const p = promos.find((x) => x.id === id);
    setPromos((prev) => prev.filter((x) => x.id !== id));
    if (p) showToast(`"${p.title}" deleted`);
  };

  const handleTargetDishToggle = (dishName: string) => {
    setForm(prev => {
      const active = prev.targetDishes.includes(dishName)
        ? prev.targetDishes.filter(d => d !== dishName)
        : [...prev.targetDishes, dishName];
      return { ...prev, targetDishes: active };
    });
  };

  const createPromo = (statusType: PromoStatus = "draft") => {
    if (!form.title.trim()) return;

    let desc = form.description.trim();
    if (!desc) {
      const valText = form.discountType === "percent" ? `${form.discountValue}% off` : form.discountType === "fixed" ? `S$${form.discountValue} off` : "Free item";
      desc = `${valText} promotion on targeted items`;
    }

    const newPromo: Promotion = {
      id: nextPromotionId(),
      title: form.title,
      description: desc,
      status: statusType,
      startDate: form.startDate || "–",
      endDate: form.endDate || "–",
      targetDishes: form.targetDishes,
      discountType: form.discountType,
      discountValue: form.discountValue,
    };

    setPromos((prev) => [newPromo, ...prev]);
    setCreateOpen(false);
    const nextForm = {
      title: "",
      description: "",
      discountType: promoSettings.defaultDiscountType,
      discountValue: "",
      startDate: "",
      endDate: "",
      targetDishes: []
    };
    setForm({
      ...nextForm,
      discountValue: promoSettings.defaultDiscountValue,
    });
    setFormSnapshot(nextForm);
    showToast(statusType === "draft" ? `"${newPromo.title}" saved as draft` : `"${newPromo.title}" published successfully`);
  };

  const resetForm = () => {
    setForm(formSnapshot);
  };

  const handleSettingsSave = () => {
    setSavedPromoSettings(promoSettings);
    showToast("Promotion settings updated");
  };

  const handleSettingsUndo = () => {
    setPromoSettings(savedPromoSettings);
  };

  return (
    <div>
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Promotions</h1>
          <p>{promos.filter((p) => p.status === "active").length} active · {promos.filter((p) => p.status === "draft").length} drafts · {promos.filter((p) => p.status === "scheduled").length} scheduled</p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button className={`${styles.actionButton} ${styles.actionButtonCompact}`} onClick={openCreatePromo}>
            <Plus size={15} /> Create Promotion
          </button>
        </div>
      </div>

      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}>
          <h2>Promotion Settings</h2>
        </div>
        <div className={styles.promoSettingsGrid}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Default Discount Type</label>
            <select
              className={styles.formSelect}
              value={promoSettings.defaultDiscountType}
              onChange={(e) => setPromoSettings((p) => ({ ...p, defaultDiscountType: e.target.value as PromotionSettings["defaultDiscountType"] }))}
            >
              <option value="percent">Percent Off</option>
              <option value="fixed">Fixed Amount Off</option>
              <option value="free_item">Free Item</option>
            </select>
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Default Discount Value</label>
            <input
              className={styles.formInput}
              value={promoSettings.defaultDiscountValue}
              onChange={(e) => setPromoSettings((p) => ({ ...p, defaultDiscountValue: e.target.value }))}
              placeholder={promoSettings.defaultDiscountType === "percent" ? "15" : "2.00"}
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Default New Campaign Status</label>
            <select
              className={styles.formSelect}
              value={promoSettings.defaultStatus}
              onChange={(e) => setPromoSettings((p) => ({ ...p, defaultStatus: e.target.value as PromotionSettings["defaultStatus"] }))}
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
            </select>
          </div>
        </div>
        <div className={styles.promoSettingsActions}>
          <button className={styles.actionButtonSecondary} onClick={handleSettingsUndo} disabled={!hasSettingChanges}>
            Undo Changes
          </button>
          <button className={styles.actionButton} onClick={handleSettingsSave} disabled={!hasSettingChanges}>
            Update Settings
          </button>
        </div>
      </div>

      <div className={styles.tabNav}>
        {TABS.map((t) => (
          <button key={t.key} className={`${styles.tabNavItem} ${tab === t.key ? styles.tabNavItemActive : ""}`} onClick={() => setTab(t.key)}>
            {t.label} ({promos.filter(p => t.key === "all" || p.status === t.key).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>No promotions here</p>
          <p className={styles.emptyStateDesc}>Create your first promotion to boost visibility and attract customers.</p>
          <button className={`${styles.actionButton} ${styles.actionButtonCompact}`} onClick={openCreatePromo}><Plus size={14} /> Create Promotion</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {filtered.map((p) => (
            <div key={p.id} className={styles.promoCard} style={{ borderLeft: p.status === "active" ? "4px solid var(--color-success)" : p.status === "scheduled" ? "4px solid var(--color-primary)" : "1px solid var(--color-border)" }}>
              <div className={styles.promoCardHeader} style={{ marginBottom: "var(--space-2)" }}>
                <div>
                  <div className={styles.promoCardTitle} style={{ fontWeight: 800, fontSize: "var(--font-size-md)", margin: 0 }}>{p.title}</div>
                  <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", margin: "4px 0", lineHeight: 1.4 }}>
                    {p.description}
                  </p>
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                      <Calendar size={12} style={{ color: "var(--color-primary)" }} /> <span style={{ fontFamily: "var(--font-mono)" }}>{p.startDate}</span> to <span style={{ fontFamily: "var(--font-mono)" }}>{p.endDate}</span>
                    </div>
                </div>
                <span className={`${styles.badge} ${BADGE_MAP[p.status] || ""}`} style={{ textTransform: "capitalize" }}>{p.status}</span>
              </div>

              {/* Target Dishes */}
              <div style={{ marginTop: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: "6px" }}>Target Products:</div>
                {p.targetDishes.length > 0 ? (
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {p.targetDishes.map((d) => (
                      <span key={d} style={{ backgroundColor: "#FDF0EB", color: "var(--color-primary)", fontSize: "10px", padding: "2px 10px", borderRadius: "var(--radius-full)", border: "1px solid #FEE2E2", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Target size={10} /> {d}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: "var(--font-size-xs)", fontStyle: "italic", color: "var(--color-text-muted)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Sparkles size={11} style={{ color: "var(--color-accent)" }} /> Applies to all menu items
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className={styles.promoCardActions} style={{ display: "flex", gap: "var(--space-2)", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)" }}>
                {(p.status === "active" || p.status === "paused") && (
                  <>
                    <button className={styles.rowAction} onClick={() => togglePause(p.id)} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      {p.status === "active" ? <><Pause size={12} /> Pause Promo</> : <><Play size={12} /> Resume Promo</>}
                    </button>
                    <button className={`${styles.rowAction} ${styles.rowActionDanger}`} onClick={() => endPromo(p.id)} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <X size={12} /> End Promo
                    </button>
                  </>
                )}
                {p.status === "draft" && (
                  <>
                    <button className={`${styles.rowAction} ${styles.rowActionPrimary}`} onClick={() => {
                      setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, status: "active" } : x));
                      showToast(`"${p.title}" published instantly`);
                    }}>
                      Publish Live
                    </button>
                    <button className={styles.rowAction} onClick={() => {
                      setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, status: "scheduled" } : x));
                      showToast(`"${p.title}" scheduled`);
                    }}>
                      Schedule Campaign
                    </button>
                    <button className={`${styles.rowAction} ${styles.rowActionDanger}`} onClick={() => handleDeletePromo(p.id)}>
                      <Trash2 size={12} style={{ color: "red" }} />
                    </button>
                  </>
                )}
                {p.status === "scheduled" && (
                  <>
                    <button className={styles.rowAction} onClick={() => {
                      setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, status: "active" } : x));
                      showToast(`"${p.title}" launched immediately`);
                    }}>
                      Launch Now
                    </button>
                    <button className={styles.rowActionSecondary} onClick={() => {
                      setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, status: "draft" } : x));
                      showToast(`"${p.title}" reverted to draft`);
                    }}>
                      Cancel Schedule
                    </button>
                  </>
                )}
                {p.status === "ended" && (
                  <button className={styles.rowAction} onClick={() => {
                    // Re-launch as draft
                    const reCreated: Promotion = {
                      ...p,
                      id: `p${Date.now()}`,
                      title: `${p.title} (Copy)`,
                      status: "draft"
                    };
                    setPromos(prev => [reCreated, ...prev]);
                    showToast(`Re-created campaign as draft`);
                  }}>
                    Duplicate as Draft
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Promotion modal */}
      {createOpen && (
        <div className={styles.modalOverlay} onClick={() => setCreateOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "550px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className={styles.modalHeader}><h3>Create Promotion</h3></div>
            <div className={styles.modalBody}>
              {/* Title */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Promotion Title *</label>
                <input className={styles.formInput} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Weekend Satay Feast" />
              </div>

              {/* Description */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Description / Subtext</label>
                <textarea className={styles.formTextarea} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="e.g. Get 20% off when you purchase selected noodles..." rows={2} />
              </div>

              {/* Discount Type */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Discount Type</label>
                <div style={{ display: "flex", gap: "var(--space-4)", backgroundColor: "var(--color-bg-muted)", padding: "10px", borderRadius: "var(--radius-md)" }}>
                  {[["percent", "% Percentage Off"], ["fixed", "S$ Fixed Amount Off"], ["free_item", "Free Item BOGO"]].map(([val, label]) => (
                    <label key={val} style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "var(--font-size-xs)", cursor: "pointer" }}>
                      <input type="radio" name="dtype" value={val} checked={form.discountType === val} onChange={() => setForm((p) => ({ ...p, discountType: val as typeof form.discountType }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Discount Value */}
              {form.discountType !== "free_item" && (
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Discount Value ({form.discountType === "percent" ? "%" : "SGD"}) *</label>
                  <input className={styles.formInput} type="number" value={form.discountValue} onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))} placeholder={form.discountType === "percent" ? "20" : "2.00"} />
                </div>
              )}

              {/* Date pickers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Start Date</label>
                  <input type="date" className={styles.formInput} value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>End Date</label>
                  <input type="date" className={styles.formInput} value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
                </div>
              </div>

              {/* Multi-Select Target Dishes Checklist */}
              <div className={styles.formRow} style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)", marginTop: "var(--space-3)" }}>
                <label className={styles.formLabel} style={{ fontWeight: 700, marginBottom: "6px" }}>Select Target Menu Dishes</label>
                <p style={{ fontSize: "10px", color: "var(--color-text-muted)", marginBottom: "10px" }}>
                  Select the dishes this promotion applies to. Leave all unchecked to apply to the entire menu.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", maxHeight: "150px", overflowY: "auto", padding: "4px" }}>
                  {availableDishes.map(dish => {
                    const isChecked = form.targetDishes.includes(dish);
                    return (
                      <label 
                        key={dish} 
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: "8px", 
                          fontSize: "var(--font-size-xs)", 
                          cursor: "pointer", 
                          padding: "6px 10px", 
                          borderRadius: "var(--radius-sm)", 
                          backgroundColor: isChecked ? "var(--color-bg-soft)" : "var(--color-bg-muted)",
                          border: `1px solid ${isChecked ? "var(--color-primary)" : "var(--color-border)"}`,
                          fontWeight: isChecked ? 700 : 500
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => handleTargetDishToggle(dish)} 
                        />
                        {dish}
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionButtonSecondary} onClick={resetForm} disabled={!hasFormChanges}>Undo Changes</button>
              <button className={styles.actionButtonSecondary} onClick={() => setCreateOpen(false)}>Cancel</button>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className={styles.actionButtonSecondary} onClick={() => createPromo("draft")} disabled={!form.title.trim()}>
                  Save Draft
                </button>
                <button
                  className={styles.actionButton}
                  onClick={() =>
                    createPromo(
                      promoSettings.defaultStatus === "active"
                        ? "active"
                        : promoSettings.defaultStatus === "scheduled"
                          ? "scheduled"
                          : form.startDate
                            ? "scheduled"
                            : "draft"
                    )
                  }
                  disabled={!form.title.trim()}
                >
                  <CheckCircle size={14} /> Publish Campaign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${styles.toastSuccess}`}>
          <CheckCircle size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
