"use client";

import React, { useState, useRef } from "react";
import { MessageSquare, CheckCircle, Plus, AlertTriangle, ShieldAlert } from "lucide-react";
import styles from "../../console/console.module.css";

type FilterTab = "all" | "unanswered" | "replied" | "5star" | "1star";

interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  dish?: string;
  replied: boolean;
  replyText?: string;
  flagged?: boolean;
  flagReason?: string;
}

const INITIAL_REVIEWS: Review[] = [
  { id: "r1", author: "Wei Ling", rating: 5, text: "The oyster cake is absolutely amazing! Crispy outside, flavourful inside. Queue is worth it. Will definitely return next week.", date: "Today, 10:24am", dish: "Fuzhou Oyster Cake", replied: false },
  { id: "r2", author: "Ahmad Z.", rating: 4, text: "Solid hawker food, very authentic. Wish the seating was a bit closer to the stall though.", date: "Yesterday", replied: true, replyText: "Thank you Ahmad! We appreciate your kind words and hope to see you again soon." },
  { id: "r3", author: "Sarah T.", rating: 5, text: "Best Fuzhou oyster cake in Singapore. Come early or it'll sell out by noon!", date: "3 days ago", dish: "Fuzhou Oyster Cake", replied: false },
  { id: "r4", author: "Emma L.", rating: 3, text: "The food is good but the queue is really long. Maybe add a queue number system?", date: "5 days ago", replied: false },
  { id: "r5", author: "Uncle Tan", rating: 5, text: "Been coming here for 20 years. Quality never drops. Keep it up!", date: "1 week ago", replied: true, replyText: "Uncle Tan! Thank you for your loyal support over the years. It means the world to us!" },
  { id: "r6", author: "Priya K.", rating: 2, text: "The lor mee was a bit too salty today. Hope this is just a one-off.", date: "1 week ago", dish: "Lor Mee Noodles", replied: false },
  { id: "r7", author: "James W.", rating: 4, text: "Good value for money and generous portions. The char kway teow has a great wok hei.", date: "2 weeks ago", dish: "Wok-Hei Char Kway Teow", replied: false },
  { id: "r8", author: "Mei S.", rating: 1, text: "Found a hair in my food today. Very disappointing. Please improve your hygiene standards.", date: "2 weeks ago", replied: true, replyText: "We sincerely apologise, Mei. This is not our standard. Please contact us directly and we will make it right." },
];

const SIMULATED_REVIEWS_POOL = [
  { author: "Wei Ming", rating: 5, text: "Incredibly crunchy and fragrant oyster cake! Plump oysters inside. Simply best in Singapore.", dish: "Fuzhou Oyster Cake" },
  { author: "Evelyn L.", rating: 4, text: "The lor mee gravy is highly aromatic and thick. Added lots of minced garlic and it was perfect.", dish: "Lor Mee Noodles" },
  { author: "Syarif", rating: 5, text: "Superb wok hei on the Char Kway Teow! Truly matches the standard of legendary old-school stalls.", dish: "Wok-Hei Char Kway Teow" },
  { author: "Jane Tan", rating: 5, text: "Poached chicken is silky smooth and chicken rice is incredibly fragrant. Best chili pairing ever.", dish: "Hainanese Chicken Rice" },
  { author: "Kenneth Goh", rating: 3, text: "Roasted pork has great crispy skin crackling, but price is slightly high for hawker center.", dish: "Crispy Roast Pork Rice" },
  { author: "Priya Murthy", rating: 5, text: "Refreshing cooling sweet barley water, great for balancing out heavy oily hawker food.", dish: "Fresh Barley Water" },
  { author: "Marcus S.", rating: 2, text: "The food was lukewarm when served. Stall uncle seemed a bit rushed and distracted today.", dish: "Lor Mee Noodles" },
];

let simulatedReviewIndex = 0;
let simulatedReviewIdSequence = 8;

function nextSimulatedReview() {
  const review = SIMULATED_REVIEWS_POOL[simulatedReviewIndex % SIMULATED_REVIEWS_POOL.length];
  simulatedReviewIndex += 1;
  return review;
}

function nextReviewId() {
  simulatedReviewIdSequence += 1;
  return `r${simulatedReviewIdSequence}`;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className={styles.reviewStars} aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ color: s <= rating ? "#F59E0B" : "var(--color-border-strong)", fontSize: "15px" }}>★</span>
      ))}
    </span>
  );
}

export default function MerchantReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reporting/Flagging drawer states
  const [reportingReview, setReportingReview] = useState<Review | null>(null);
  const [flagReasonInput, setFlagReasonInput] = useState("Spam / False Claim");

  const showToast = (msg: string) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast(msg);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  const submitReply = (id: string) => {
    if (!replyText.trim()) return;
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, replied: true, replyText } : r));
    setReplyingTo(null);
    setReplyText("");
    showToast("Reply posted successfully");
  };

  // Simulate incoming Customer Review dynamically
  const handleSimulateReview = () => {
    const item = nextSimulatedReview();
    if (!item) return;

    const newReview: Review = {
      id: nextReviewId(),
      author: item.author,
      rating: item.rating,
      text: item.text,
      date: "Just now",
      dish: item.dish,
      replied: false
    };

    setReviews(prev => [newReview, ...prev]);
    showToast(`Simulated new ${newReview.rating}★ review from ${newReview.author}`);
  };

  const handleFlagSubmit = () => {
    if (!reportingReview) return;
    setReviews(prev => prev.map(r => r.id === reportingReview.id ? {
      ...r,
      flagged: true,
      flagReason: flagReasonInput
    } : r));
    setReportingReview(null);
    showToast("Review reported to Hungry Admin for policy check");
  };

  const filtered = reviews.filter((r) => {
    if (activeTab === "unanswered") return !r.replied;
    if (activeTab === "replied") return r.replied;
    if (activeTab === "5star") return r.rating === 5;
    if (activeTab === "1star") return r.rating === 1;
    return true;
  });

  const TABS: { key: FilterTab; label: string; count?: number }[] = [
    { key: "all", label: `All (${reviews.length})` },
    { key: "unanswered", label: `Unanswered (${reviews.filter((r) => !r.replied).length})` },
    { key: "replied", label: `Replied (${reviews.filter((r) => r.replied).length})` },
    { key: "5star", label: "★ 5" },
    { key: "1star", label: "★ 1" },
  ];

  const avgRating = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);

  return (
    <div>
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Reviews</h1>
          <p>Average rating: {avgRating} / 5 · {reviews.length} total reviews</p>
        </div>
        <button className={styles.actionButton} onClick={handleSimulateReview} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <Plus size={15} /> Simulate Customer Review
        </button>
      </div>

      <div className={styles.tabNav}>
        {TABS.map((t) => (
          <button key={t.key} className={`${styles.tabNavItem} ${activeTab === t.key ? styles.tabNavItemActive : ""}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>No reviews in this filter</p>
          <p className={styles.emptyStateDesc}>Try a different filter tab above.</p>
        </div>
      ) : (
        filtered.map((review) => (
          <div key={review.id} className={styles.reviewItem} style={{ borderLeft: review.flagged ? "4px solid var(--color-primary)" : undefined }}>
            {/* Row 1: Author + date + flagged label */}
            <div className={styles.reviewHeader}>
              <span className={styles.reviewAuthor}>{review.author}</span>
              <span className={styles.reviewDate}>{review.date}</span>
              {review.flagged && (
                <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--color-primary)", fontSize: "10px", fontWeight: 700, backgroundColor: "#FDF0EB", padding: "2px 8px", borderRadius: "var(--radius-full)", border: "1px solid #FEE2E2" }}>
                  <ShieldAlert size={12} /> Under Investigation ({review.flagReason})
                </span>
              )}
            </div>

            {/* Row 2: Stars + dish badge — visually separated from author */}
            <div className={styles.reviewMeta} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
              <StarDisplay rating={review.rating} />
              {review.dish && (
                <span className={`${styles.badge} ${styles.badgeNew}`}>
                  {review.dish}
                </span>
              )}
            </div>

            {/* Row 3: Review body */}
            <p className={styles.reviewText}>{review.text}</p>

            {review.replied && review.replyText && (
              <div className={styles.reviewReplied}>
                <strong>Your reply: </strong>{review.replyText}
              </div>
            )}

            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)", alignItems: "center" }}>
              {!review.replied && (
                replyingTo === review.id ? (
                  <div className={styles.replyBox} style={{ width: "100%" }}>
                    <textarea
                      className={styles.formTextarea}
                      placeholder={`Reply to ${review.author}...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      autoFocus
                    />
                    <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                      <button className={styles.actionButtonSecondary} onClick={() => { setReplyingTo(null); setReplyText(""); }}>Cancel</button>
                      <button className={styles.actionButton} disabled={!replyText.trim()} onClick={() => submitReply(review.id)}>
                        <CheckCircle size={14} /> Submit Reply
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className={styles.rowAction} onClick={() => { setReplyingTo(review.id); setReplyText(""); }}>
                    <MessageSquare size={12} /> Reply
                  </button>
                )
              )}

              {!review.flagged && (
                <button
                  onClick={() => setReportingReview(review)}
                  className={`${styles.rowAction} ${styles.rowActionDanger}`}
                  style={{ marginLeft: replyingTo === review.id ? 0 : "auto", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
                >
                  <AlertTriangle size={12} /> Flag Review
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {/* Flag Review Modal Overlay */}
      {reportingReview && (
        <div className={styles.modalOverlay} onClick={() => setReportingReview(null)}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Flag review"
            style={{ maxWidth: "450px" }}
          >
            <div className={styles.modalHeader}>
              <h3 style={{ color: "var(--color-error)", display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle size={18} /> Flag Review by {reportingReview.author}?
              </h3>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-4)" }}>
                You are requesting policy investigation on this review. Reported reviews are reviewed by the Hungry community team within 24 hours.
              </p>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Reason for Reporting</label>
                <select
                  className={styles.formSelect}
                  value={flagReasonInput}
                  onChange={(e) => setFlagReasonInput(e.target.value)}
                >
                  <option value="Spam / False Claim">Spam / Completely false claims</option>
                  <option value="Inappropriate Content">Abusive or inappropriate language</option>
                  <option value="Competitor Harassment">Competitive manipulation / targeted attack</option>
                  <option value="Off-Topic Comments">Totally off-topic (does not relate to stall)</option>
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionButtonSecondary} onClick={() => setReportingReview(null)}>Cancel</button>
              <button className={styles.actionButtonDanger} onClick={handleFlagSubmit}>
                Submit Policy Report
              </button>
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
