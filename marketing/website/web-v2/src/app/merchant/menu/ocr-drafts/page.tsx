"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, X, Edit2 } from "lucide-react";
import styles from "@/app/console/console.module.css";

interface OcrDraft {
  id: string;
  detectedName: string;
  price: string;
  category: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected";
  editedName?: string;
}

const INITIAL_DRAFTS: OcrDraft[] = [
  { id: "ocr1", detectedName: "Prawn Wanton Mee", price: "S$4.50", category: "Noodles", confidence: 94, status: "pending" },
  { id: "ocr2", detectedName: "Fuzhou Fish Ball Soup", price: "S$3.50", category: "Soups", confidence: 87, status: "pending" },
  { id: "ocr3", detectedName: "Fried Carrot Cake (White)", price: "S$3.00", category: "Snacks", confidence: 91, status: "pending" },
];

export default function OcrDraftsPage() {
  const [drafts, setDrafts] = useState<OcrDraft[]>(INITIAL_DRAFTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const accept = (id: string) => {
    setDrafts((p) => p.map((d) => d.id === id ? { ...d, status: "accepted" } : d));
    showToast("Dish accepted and added to menu");
  };

  const reject = (id: string) => {
    setDrafts((p) => p.map((d) => d.id === id ? { ...d, status: "rejected" } : d));
    showToast("Draft rejected");
  };

  const startEdit = (draft: OcrDraft) => {
    setEditingId(draft.id);
    setEditName(draft.editedName || draft.detectedName);
  };

  const saveEdit = (id: string) => {
    setDrafts((p) => p.map((d) => d.id === id ? { ...d, editedName: editName } : d));
    setEditingId(null);
    showToast("Name updated");
  };

  const acceptAll = () => {
    setDrafts((p) => p.map((d) => d.status === "pending" ? { ...d, status: "accepted" } : d));
    showToast("All drafts accepted and added to menu");
  };

  const pending = drafts.filter((d) => d.status === "pending");
  const processed = drafts.filter((d) => d.status !== "pending");

  return (
    <div>
      <div className={styles.headerTitleArea}>
        <div>
          <Link href="/merchant/menu" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-2)", fontWeight: 600 }}>
            <ArrowLeft size={14} /> Back to Menu
          </Link>
          <h1>OCR Menu Drafts</h1>
          <p>Dishes detected from your uploaded menu photo. Review and accept to add to your menu.</p>
        </div>
        {pending.length > 0 && (
          <button className={styles.actionButton} onClick={acceptAll}>
            <CheckCircle size={15} /> Accept All ({pending.length})
          </button>
        )}
      </div>

      {pending.length === 0 && processed.length === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>No OCR drafts</p>
          <p className={styles.emptyStateDesc}>Upload a menu photo from your Profile page to generate dish drafts.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div className={styles.dashboardSectionCard}>
          <div className={styles.sectionHeaderRow}><h2>Pending Review ({pending.length})</h2></div>
          {pending.map((draft) => (
            <div key={draft.id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", marginBottom: "var(--space-3)", background: "var(--color-surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
                <div>
                  {editingId === draft.id ? (
                    <input
                      className={styles.formInput}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(draft.id)}
                      autoFocus
                      style={{ marginBottom: "var(--space-2)" }}
                    />
                  ) : (
                    <div style={{ fontWeight: 700, fontSize: "var(--font-size-md)", marginBottom: "4px" }}>
                      {draft.editedName || draft.detectedName}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "var(--space-3)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                    <span>{draft.price}</span>
                    <span>·</span>
                    <span>{draft.category}</span>
                    <span>·</span>
                    <span style={{ color: draft.confidence >= 90 ? "var(--color-success)" : "var(--color-accent)" }}>
                      {draft.confidence}% confidence
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  {editingId === draft.id ? (
                    <>
                      <button className={`${styles.rowAction} ${styles.rowActionPrimary}`} onClick={() => saveEdit(draft.id)}>Save</button>
                      <button className={styles.rowAction} onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className={`${styles.rowAction} ${styles.rowActionPrimary}`} onClick={() => accept(draft.id)}>
                        <CheckCircle size={12} /> Accept
                      </button>
                      <button className={styles.rowAction} onClick={() => startEdit(draft)}>
                        <Edit2 size={12} /> Edit
                      </button>
                      <button className={`${styles.rowAction} ${styles.rowActionDanger}`} onClick={() => reject(draft.id)}>
                        <X size={12} /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {processed.length > 0 && (
        <div className={styles.dashboardSectionCard}>
          <div className={styles.sectionHeaderRow}><h2>Processed ({processed.length})</h2></div>
          {processed.map((draft) => (
            <div key={draft.id} style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border)", opacity: 0.65 }}>
              <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{draft.editedName || draft.detectedName}</span>
              <span className={`${styles.badge} ${draft.status === "accepted" ? styles.badgeActive : styles.badgeCritical}`}>
                {draft.status}
              </span>
            </div>
          ))}
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
