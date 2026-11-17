"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useState, useRef } from "react";
import { CheckCircle, Camera } from "lucide-react";
import { merchantMutationFetch } from "@/lib/merchantPortal/csrf";
import { parseMerchantPortalJson } from "@/lib/merchantPortal/fetch";
import styles from "../../console/console.module.css";

interface ProfileForm {
  name: string;
  description: string;
  businessType: string;
  cuisine: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  halal: boolean;
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  hours: Record<string, { open: boolean; from: string; to: string }>;
}

type MerchantProfileApiResponse = {
  account?: {
    email?: string;
  };
  error?: string;
  outlet?: {
    businessType?: string;
    contactEmail?: string;
    contactPhone?: string;
    coverPhotoUrl?: string;
    description?: string;
    name?: string;
    operatingHours?: string;
  };
};

const INITIAL: ProfileForm = {
  name: "Maxwell Fuzhou Oyster Cake",
  description: "A Maxwell Food Centre institution since 1982. Our signature Fuzhou oyster cakes are handmade daily using a cherished family recipe — crispy outside, flavourful inside. Come early, we sell out fast!",
  businessType: "Hawker Stall",
  cuisine: "Fuzhou, Teochew",
  phone: "+65 9123 4567",
  email: "maxwellfuzhou@email.com",
  website: "",
  instagram: "@maxwellfuzhou",
  halal: false,
  vegetarian: false,
  vegan: false,
  glutenFree: false,
  hours: {
    "Mon": { open: true, from: "07:00", to: "15:00" },
    "Tue": { open: true, from: "07:00", to: "15:00" },
    "Wed": { open: true, from: "07:00", to: "15:00" },
    "Thu": { open: true, from: "07:00", to: "15:00" },
    "Fri": { open: true, from: "07:00", to: "15:00" },
    "Sat": { open: true, from: "07:00", to: "14:00" },
    "Sun": { open: false, from: "07:00", to: "14:00" },
  },
};

function parseHours(value?: string): ProfileForm["hours"] {
  if (!value) return INITIAL.hours;
  try {
    const parsed = JSON.parse(value) as ProfileForm["hours"];
    return { ...INITIAL.hours, ...parsed };
  } catch {
    return INITIAL.hours;
  }
}

function displayBusinessType(value?: string) {
  if (!value) return INITIAL.businessType;
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function MerchantProfilePage() {
  const [form, setForm] = useState<ProfileForm>(INITIAL);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [coverUploaded, setCoverUploaded] = useState(false);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast(msg);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  const update = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    setIsDirty(true);
  };

  const updateHours = (day: string, field: "open" | "from" | "to", value: string | boolean) => {
    setForm((p) => ({
      ...p,
      hours: { ...p.hours, [day]: { ...p.hours[day], [field]: value } },
    }));
    setIsDirty(true);
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/merchant/overview", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await parseMerchantPortalJson<MerchantProfileApiResponse>(response)) ?? {};
        if (!response.ok) throw new Error(payload?.error ?? "Unable to load profile.");
        return payload;
      })
      .then((payload) => {
        if (cancelled || !payload.outlet) return;
        setForm((prev) => ({
          ...prev,
          businessType: displayBusinessType(payload.outlet?.businessType),
          description: payload.outlet?.description ?? INITIAL.description,
          email: payload.outlet?.contactEmail ?? payload.account?.email ?? "",
          hours: parseHours(payload.outlet?.operatingHours),
          name: payload.outlet?.name ?? INITIAL.name,
          phone: payload.outlet?.contactPhone ?? "",
        }));
      })
      .catch((error) => showToast(error instanceof Error ? error.message : "Unable to load profile."));

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await merchantMutationFetch("/api/merchant/profile", {
        body: JSON.stringify({
          businessType: form.businessType,
          coverPhotoUrl: coverUploaded
            ? "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80"
            : undefined,
          description: form.description,
          email: form.email,
          name: form.name,
          operatingHours: JSON.stringify(form.hours),
          phone: form.phone,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await parseMerchantPortalJson<MerchantProfileApiResponse>(response)) ?? {};
      if (!response.ok) throw new Error(payload?.error ?? "Unable to update profile.");
      setIsDirty(false);
      showToast("Profile updated successfully");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Business Profile</h1>
          <p>Update how your stall appears to customers on Hungry.</p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          {isDirty && (
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-primary)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
              Unsaved changes
            </span>
          )}
          <button className={styles.actionButton} onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? "Saving…" : <><CheckCircle size={14} /> Save Profile</>}
          </button>
        </div>
      </div>

      {/* Cover photo */}
      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}><h2>Cover Photo</h2></div>
        <div style={{ height: "180px", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: "var(--space-4)", position: "relative", background: "var(--color-bg-soft)" }}>
          <img
            src={coverUploaded ? "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80" : "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=800&q=60"}
            alt="Cover"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: "var(--space-3)" }}>
            <button className={styles.actionButtonSecondary} style={{ fontSize: "var(--font-size-xs)" }} onClick={() => { setCoverUploaded(true); setIsDirty(true); }}>
              <Camera size={13} /> Change Cover Photo
            </button>
          </div>
        </div>
      </div>

      {/* Basic info */}
      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}><h2>Basic Information</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <div className={styles.formRow} style={{ gridColumn: "1 / -1" }}>
            <label className={styles.formLabel}>Business Name</label>
            <input className={styles.formInput} value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className={styles.formRow} style={{ gridColumn: "1 / -1" }}>
            <label className={styles.formLabel}>Description</label>
            <textarea className={styles.formTextarea} value={form.description} onChange={(e) => update("description", e.target.value)} rows={4} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Business Type</label>
            <select className={styles.formSelect} value={form.businessType} onChange={(e) => update("businessType", e.target.value)}>
              {["Hawker Stall", "Food Court Stall", "Café", "Restaurant", "Bakery", "Food Truck"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Cuisine Categories</label>
            <input className={styles.formInput} value={form.cuisine} onChange={(e) => update("cuisine", e.target.value)} placeholder="e.g. Fuzhou, Chinese" />
          </div>
        </div>

        <div style={{ marginTop: "var(--space-4)" }}>
          <label className={styles.formLabel} style={{ marginBottom: "var(--space-3)", display: "block" }}>Dietary Labels</label>
          <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
            {(["halal", "vegetarian", "vegan", "glutenFree"] as const).map((key) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--font-size-sm)", fontWeight: 600, cursor: "pointer" }}>
                <input type="checkbox" checked={form[key] as boolean} onChange={(e) => update(key, e.target.checked)} />
                {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1")}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}><h2>Contact & Social</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          {([["phone", "Phone Number", "tel"], ["email", "Email", "email"], ["website", "Website", "url"], ["instagram", "Instagram", "text"]] as const).map(([key, label, type]) => (
            <div key={key} className={styles.formRow}>
              <label className={styles.formLabel}>{label}</label>
              <input type={type} className={styles.formInput} value={form[key] as string} onChange={(e) => update(key, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* Operating hours */}
      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}><h2>Operating Hours</h2></div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {Object.entries(form.hours).map(([day, h]) => (
            <div key={day} style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", width: "80px", fontWeight: 600, fontSize: "var(--font-size-sm)", cursor: "pointer", flexShrink: 0 }}>
                <input type="checkbox" checked={h.open} onChange={(e) => updateHours(day, "open", e.target.checked)} />
                {day}
              </label>
              {h.open ? (
                <>
                  <input type="time" value={h.from} className={styles.formInput} style={{ width: "130px" }} onChange={(e) => updateHours(day, "from", e.target.value)} />
                  <span style={{ color: "var(--color-text-muted)" }}>–</span>
                  <input type="time" value={h.to} className={styles.formInput} style={{ width: "130px" }} onChange={(e) => updateHours(day, "to", e.target.value)} />
                </>
              ) : (
                <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>Closed</span>
              )}
            </div>
          ))}
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
