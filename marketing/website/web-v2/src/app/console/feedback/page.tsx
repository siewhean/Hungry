"use client";

import React, { useState } from "react";
import { CheckCircle, MessageSquare, AlertTriangle, X, Mail, Send } from "lucide-react";
import { readConsolePrototypeStorage, writeConsolePrototypeStorage } from "@/lib/console/prototypeStorage";
import styles from "../console.module.css";

type FeedbackStatus = "open" | "escalated" | "resolved";
type FeedbackCategory = "bug" | "UX issue" | "data issue" | "opening-hours issue" | "feature request";

interface MockFeedback {
  id: string;
  user: string;
  email: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  submittedAt: string;
  adminReply?: string;
  resolvedAt?: string;
}

const initialFeedback: MockFeedback[] = [
  { id: "FDB-901", user: "Emma Tan", email: "emma.tan@nus.edu.sg", category: "bug", message: "Decide For Me spinner spins forever when I deny location permissions on iOS.", status: "open", submittedAt: "1 hour ago" },
  { id: "FDB-902", user: "Ahmad Shah", email: "ahmad.delivery@proton.me", category: "opening-hours issue", message: "Bedok Interchange Hawker Centre laksa stall was closed at 2 PM, but the app says open until 4 PM.", status: "open", submittedAt: "3 hours ago" },
  { id: "FDB-903", user: "Uncle Tan", email: "kim.seng.tan@gmail.com", category: "UX issue", message: "Stall owner dashboard menu text is too small on my Android phone. Hard to read while cooking.", status: "open", submittedAt: "1 day ago" },
  { id: "FDB-904", user: "Wei Ling", email: "wl.family@singtel.com.sg", category: "feature request", message: "Would love a shared group wishlist so my husband and I can add stalls for the weekend.", status: "open", submittedAt: "2 days ago" },
];

const categoryColors: Record<FeedbackCategory, { bg: string; text: string }> = {
  bug: { bg: "#FEE2E2", text: "#991B1B" },
  "opening-hours issue": { bg: "#FEF3C7", text: "#92400E" },
  "UX issue": { bg: "#E0F2FE", text: "#0369A1" },
  "data issue": { bg: "#F3E8FF", text: "#6B21A8" },
  "feature request": { bg: "#ECFDF5", text: "#065F46" },
};

type TabFilter = "all" | "open" | "escalated" | "resolved";

const EMAIL_TEMPLATES = [
  {
    name: "Custom Response",
    subject: "Re: Your feedback regarding Hungry app",
    body: "Hi {user},\n\n"
  },
  {
    name: "Bug Acknowledgement",
    subject: "Hungry Bug Triage - {id}",
    body: "Hi {user},\n\nThank you for reporting this issue to us! Our engineering team has triaged the bug regarding: \"{excerpt}\". We are working on a hotfix for our next release cycle.\n\nBest regards,\nHungry Engineering Support"
  },
  {
    name: "Inaccurate Hours Fixed",
    subject: "Stall Operating Hours Update - Hungry",
    body: "Hi {user},\n\nThank you so much for the feedback! We have updated the operating hours for the reported stall in Bedok Interchange Hawker Centre. The change is now live for all users.\n\nBest regards,\nHungry Content Team"
  },
  {
    name: "Feature Request Logged",
    subject: "Idea Registered! Re: {category}",
    body: "Hi {user},\n\nThat sounds like a wonderful feature suggestion! We have officially logged your idea to create \"{excerpt}\" in our product roadmap. We will keep you updated if we schedule this for an upcoming sprint.\n\nBest regards,\nHungry Product Design Team"
  }
];

export default function UserFeedback() {
  const [feedback, setFeedback] = useState<MockFeedback[]>(() => {
    return readConsolePrototypeStorage("console_feedback", initialFeedback);
  });

  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [replyTarget, setReplyTarget] = useState<MockFeedback | null>(null);
  
  // Structured Responder States
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(0);
  const [replySubject, setReplySubject] = useState("");
  const [replyText, setReplyText] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const saveFeedback = (updated: MockFeedback[]) => {
    setFeedback(updated);
    writeConsolePrototypeStorage("console_feedback", updated);
  };

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = feedback.filter((f) => {
    if (activeTab === "all") return true;
    return f.status === activeTab;
  });

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "escalated", label: "Escalated" },
    { key: "resolved", label: "Resolved" },
  ];

  const handleResolve = (id: string) => {
    const updated = feedback.map((f) => (f.id === id ? { ...f, status: "resolved" as const, resolvedAt: new Date().toLocaleDateString("en-SG") } : f));
    saveFeedback(updated);
    showToast("Feedback marked as resolved", "success");
    if (typeof window !== "undefined") {
      const item = feedback.find((f) => f.id === id);
      window.dispatchEvent(new CustomEvent("consoleAdminAction", { detail: { action: "feedback resolved", target: item?.user || id, notes: `Marked '${item?.message.substring(0, 30)}...' as resolved` } }));
    }
  };

  const handleEscalate = (id: string) => {
    const updated = feedback.map((f) => (f.id === id ? { ...f, status: "escalated" as const } : f));
    saveFeedback(updated);
    showToast("Feedback escalated to engineering team", "info");
  };

  const handleOpenReply = (item: MockFeedback) => {
    setReplyTarget(item);
    setSelectedTemplateIndex(0);
    setReplySubject(`Re: [Hungry #${item.id}] ${item.category.toUpperCase()} feedback`);
    setReplyText(`Hi ${item.user},\n\nThank you for sharing your feedback: \"${item.message}\".\n\n`);
  };

  const handleTemplateChange = (index: number) => {
    if (!replyTarget) return;
    setSelectedTemplateIndex(index);
    const tmpl = EMAIL_TEMPLATES[index];
    
    // Parse placeholders
    const excerpt = replyTarget.message.length > 35 ? replyTarget.message.substring(0, 35) + "..." : replyTarget.message;
    const parsedSubject = tmpl.subject
      .replace(/{id}/g, replyTarget.id)
      .replace(/{category}/g, replyTarget.category);
      
    const parsedBody = tmpl.body
      .replace(/{user}/g, replyTarget.user)
      .replace(/{excerpt}/g, excerpt);

    setReplySubject(parsedSubject);
    setReplyText(parsedBody);
  };

  const handleSendReply = () => {
    if (!replyTarget) return;
    
    const updated = feedback.map((f) => 
      f.id === replyTarget.id 
        ? { ...f, status: "resolved" as const, adminReply: replyText, resolvedAt: new Date().toLocaleDateString("en-SG") } 
        : f
    );
    saveFeedback(updated);

    // Trigger admin action event
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("consoleAdminAction", { 
        detail: { 
          action: "feedback reply sent", 
          target: replyTarget.user, 
          notes: `Sent email subject: "${replySubject}" and resolved ticket ${replyTarget.id}` 
        } 
      }));
    }

    showToast(`Support email successfully sent to ${replyTarget.email}`, "success");
    setReplyTarget(null);
    setReplyText("");
  };

  const statusBadge = (status: FeedbackStatus) => {
    if (status === "open") return { className: styles.badgePending, label: "Open" };
    if (status === "escalated") return { className: styles.badgeCritical, label: "Escalated" };
    return { className: styles.badgeResolved, label: "Resolved" };
  };

  return (
    <div>
      {/* HEADER SECTION */}
      <div className={styles.headerTitleArea}>
        <div>
          <h1>User Feedback &amp; Product Ideas</h1>
          <p>Triage mobile app bugs, inaccurate hours, and customer feature requests. Dispatch outbound resolution emails.</p>
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
                ({feedback.filter((f) => t.key === "all" ? true : f.status === t.key).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* FEEDBACK QUEUE */}
      <div className={styles.dashboardSectionCard}>
        <div className={styles.sectionHeaderRow}>
          <h2>Feedback Queue ({feedback.filter((f) => f.status === "open").length} Open)</h2>
        </div>

        <div className={styles.queueTableWrapper}>
          <table className={styles.queueTable}>
            <thead>
              <tr>
                <th>ID</th>
                <th>User Details</th>
                <th>Category</th>
                <th>Message</th>
                <th>Status</th>
                <th>Received</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const catColor = categoryColors[item.category];
                const badge = statusBadge(item.status);
                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: "700", fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}>{item.id}</td>
                    <td style={{ fontWeight: "600" }}>
                      <div>{item.user}</div>
                      <div style={{ fontSize: "10px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>{item.email}</div>
                    </td>
                    <td>
                      <span className={styles.badge} style={{ borderRadius: "var(--radius-full)", backgroundColor: catColor.bg, color: catColor.text }}>
                        {item.category.replace(/-/g, " ")}
                      </span>
                    </td>
                    <td style={{ maxWidth: "340px", lineBreak: "anywhere", fontSize: "var(--font-size-sm)" }}>
                      <div>{item.message}</div>
                      {item.adminReply && (
                        <div style={{ marginTop: "8px", padding: "6px 10px", backgroundColor: "#F3F4F6", borderRadius: "var(--radius-sm)", fontSize: "11px", color: "var(--color-text-secondary)" }}>
                          <strong>Outbox Reply:</strong> {item.adminReply.substring(0, 100)}...
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{item.submittedAt}</td>
                    <td>
                      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                        {(item.status === "open" || item.status === "escalated") && (
                          <>
                            <button
                              className={styles.rowActionPrimary}
                              style={{ fontSize: "var(--font-size-xs)", padding: "4px 8px" }}
                              onClick={() => handleResolve(item.id)}
                            >
                              <CheckCircle size={12} /> Resolve
                            </button>
                            <button
                              className={styles.rowAction}
                              style={{ fontSize: "var(--font-size-xs)", padding: "4px 8px" }}
                              onClick={() => handleEscalate(item.id)}
                            >
                              <AlertTriangle size={12} /> Escalate
                            </button>
                          </>
                        )}
                        <button
                          className={styles.rowAction}
                          style={{ fontSize: "var(--font-size-xs)", padding: "4px 8px" }}
                          onClick={() => handleOpenReply(item)}
                        >
                          <MessageSquare size={12} /> Reply
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className={styles.emptyState}>
            <MessageSquare size={36} />
            <div className={styles.emptyStateTitle}>No feedback items</div>
            <div className={styles.emptyStateDesc}>No items in this category.</div>
          </div>
        )}
      </div>

      {/* SUPPORT OUTBOX RESOLVER RESOLUTION EMAIL FORM MODAL */}
      {replyTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: "560px" }}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <Mail size={20} style={{ color: "var(--color-primary)" }} />
                <h3>Support Outbox Resolver</h3>
              </div>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                Drafting resolution email. Send action will deliver email and mark feedback as Resolved.
              </p>
            </div>
            
            <div className={styles.modalBody} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "10px", fontSize: "var(--font-size-sm)", alignItems: "center" }}>
                <span style={{ color: "var(--color-text-secondary)", fontWeight: "600" }}>From:</span>
                <input type="text" className={styles.formInput} style={{ background: "var(--color-bg-soft)", opacity: 0.8 }} value="support@hungry.sg" disabled />

                <span style={{ color: "var(--color-text-secondary)", fontWeight: "600" }}>To:</span>
                <input type="text" className={styles.formInput} style={{ background: "var(--color-bg-soft)", opacity: 0.8 }} value={`${replyTarget.user} <${replyTarget.email}>`} disabled />

                <span style={{ color: "var(--color-text-secondary)", fontWeight: "600" }}>Template:</span>
                <select 
                  className={styles.formInput} 
                  style={{ width: "100%", padding: "6px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-bg)" }}
                  value={selectedTemplateIndex}
                  onChange={(e) => handleTemplateChange(parseInt(e.target.value))}
                >
                  {EMAIL_TEMPLATES.map((tmpl, idx) => (
                    <option key={tmpl.name} value={idx}>{tmpl.name}</option>
                  ))}
                </select>

                <span style={{ color: "var(--color-text-secondary)", fontWeight: "600" }}>Subject:</span>
                <input 
                  type="text" 
                  className={styles.formInput} 
                  value={replySubject} 
                  onChange={(e) => setReplySubject(e.target.value)}
                  placeholder="Subject line..." 
                />
              </div>

              <div style={{ marginTop: "8px" }}>
                <label className={styles.formLabel}>Resolution Email Body</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Draft resolution content here..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={8}
                  style={{ fontSize: "var(--font-size-sm)", fontFamily: "var(--font-body)", lineHeight: "1.5" }}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.actionButtonSecondary} onClick={() => { setReplyTarget(null); setReplyText(""); }}>
                <X size={14} /> Cancel
              </button>
              <button
                className={styles.actionButton}
                onClick={handleSendReply}
                disabled={!replyText.trim() || !replySubject.trim()}
                style={{ opacity: (replyText.trim() && replySubject.trim()) ? 1 : 0.5, display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Send size={14} /> Send Email &amp; Resolve
              </button>
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
