"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Clock, FileText, Scan, Upload, Video, X } from "lucide-react";
import styles from "../../console/console.module.css";
import { merchantMutationFetch } from "@/lib/merchantPortal/csrf";
import { parseMerchantPortalJson } from "@/lib/merchantPortal/fetch";
import { getConsolePrototypeFallback } from "@/lib/console/prototypeStorage";
import {
  isMerchantVerified,
  readMerchantVerificationState,
  subscribeToMerchantVerification,
  updateMerchantVerificationStatus,
  type MerchantVerificationStepStatus,
} from "@/lib/merchantVerification";

export default function MerchantVerificationPage() {
  const router = useRouter();
  const [verificationState, setVerificationState] = useState(readMerchantVerificationState);
  const [licenceFile, setLicenceFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [singpassModalOpen, setSingpassModalOpen] = useState(false);
  const [singpassStep, setSingpassStep] = useState<"qr" | "loading" | "details" | "done">("qr");
  const corppassPrototypeEnabled = getConsolePrototypeFallback(true, false);
  const isVerified = isMerchantVerified(verificationState);

  const prototypeAcraDetails = {
    uen: "PROTOTYPE-UEN",
    entityName: "PROTOTYPE MERCHANT ENTITY",
    entityType: "Prototype entity type",
    regDate: "Prototype registration date",
    address: "Prototype registered address"
  };

  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const licenceInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast(msg);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (isVerified) {
      router.replace("/merchant");
    }
  }, [isVerified, router]);

  useEffect(() => subscribeToMerchantVerification(setVerificationState), []);

  const formatFileSize = (size: number) => {
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmitEvidence = async () => {
    if (!licenceFile && !videoFile) {
      showToast("Upload your SFA licence or stall video first");
      return;
    }

    setEvidenceSubmitting(true);
    try {
      const response = await merchantMutationFetch("/api/merchant/verification", {
        body: JSON.stringify({ method: licenceFile ? "licence_upload" : "video_walkaround" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await parseMerchantPortalJson<{ error?: string }>(response)) ?? {};
      if (!response.ok) throw new Error(payload?.error ?? "Unable to submit evidence.");
      setVerificationState(updateMerchantVerificationStatus("in_review", {
        updatedBy: "Merchant Mode",
        message: "Your evidence has been submitted. Hungry Ops is reviewing your stall verification.",
        stepUpdates: {
          documents: licenceFile ? "verified" : "pending",
          walkaround: videoFile ? "in_review" : "pending",
        },
      }));
      showToast("Evidence submitted for review");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to submit evidence.");
    } finally {
      setEvidenceSubmitting(false);
    }
  };

  const handleSingpassVerifyTrigger = () => {
    if (!corppassPrototypeEnabled) {
      showToast("Corppass integration is not connected in production.");
      return;
    }
    setSingpassStep("qr");
    setSingpassModalOpen(true);
  };

  const handleSimulateQRScan = () => {
    if (!corppassPrototypeEnabled) {
      showToast("Corppass integration is not connected in production.");
      return;
    }
    setSingpassStep("loading");
    setTimeout(() => {
      setSingpassStep("details");
    }, 1500);
  };

  const handleAuthorizeMyInfo = async () => {
    if (!corppassPrototypeEnabled) {
      showToast("Corppass integration is not connected in production.");
      return;
    }
    setSingpassStep("done");
    try {
      const response = await merchantMutationFetch("/api/merchant/verification", {
        body: JSON.stringify({ method: "singpass_myinfo" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await parseMerchantPortalJson<{ error?: string }>(response)) ?? {};
      if (!response.ok) throw new Error(payload?.error ?? "Unable to submit Corppass details.");
      setSingpassModalOpen(false);
      setVerificationState(updateMerchantVerificationStatus("in_review", {
        updatedBy: "Merchant Mode",
        message: "Corppass details were shared successfully. Hungry Ops still needs to approve the merchant account.",
        stepUpdates: {
          corppass: "verified",
          documents: "verified",
          walkaround: "in_review",
        },
      }));
      showToast("Singpass Corppass details submitted for review");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to submit Corppass details.");
    }
  };

  const stepDescriptions = {
    business: "Basic UEN details, stall name, and cuisine registry matching.",
    documents: "Business licence from SFA/NEA uploaded and reviewed.",
    walkaround: "Physical stall walkaround evidence reviewed by Hungry Ops.",
    corppass: corppassPrototypeEnabled
      ? "Prototype credential validation through a non-production Corppass flow."
      : "Corppass validation requires the live integration to be connected.",
  };

  const statusCopy: Record<MerchantVerificationStepStatus, string> = {
    not_started: "Not started",
    pending: "Pending",
    in_review: "In review",
    needs_action: "Needs action",
    failed: "Failed",
    verified: "Verified",
  };

  const statusTone = verificationState.status === "rejected"
    ? styles.verificationChipRejected
    : verificationState.status === "more_info"
      ? styles.verificationChipNeedsAction
      : styles.verificationChipPending;

  const pendingTitle = verificationState.status === "rejected"
    ? "Action needed"
    : verificationState.status === "more_info"
      ? "More information needed"
      : verificationState.status === "in_review"
        ? "Pending review"
        : "Pending verification";

  const completedSteps = verificationState.steps.filter((step) => step.status === "verified").length;
  const totalSteps = verificationState.steps.length;

  return (
    <div>
      <div className={styles.verificationHero}>
        <div className={styles.verificationHeroCopy}>
          <span className={`${styles.verificationStatusChip} ${statusTone}`}>
            <Clock size={14} />
            {pendingTitle}
          </span>
          <h1>Verify your merchant account</h1>
          <p>{verificationState.message}</p>
        </div>
        <div className={styles.verificationProgressCard} aria-label={`${completedSteps} of ${totalSteps} verification steps completed`}>
          <span>Progress</span>
          <strong>{completedSteps}/{totalSteps}</strong>
          <small>{completedSteps === totalSteps ? "Ready for final review" : "Complete the next steps below"}</small>
        </div>
      </div>

      <section className={styles.verificationNextSteps} aria-labelledby="verification-next-steps-title">
        <div>
          <span className={styles.sidebarMetaPill}>Immediate steps</span>
          <h2 id="verification-next-steps-title">Complete these actions</h2>
        </div>
        <div className={styles.verificationActionList}>
          <div className={styles.verificationActionItem}>
            <div className={styles.verificationActionIcon}><FileText size={20} /></div>
            <div className={styles.verificationActionCopy}>
              <strong>Upload SFA / NEA licence</strong>
              <span>{licenceFile ? `${licenceFile.name} · ${formatFileSize(licenceFile.size)}` : "PDF, JPG, or PNG from SFA / NEA records. Max 10 MB."}</span>
            </div>
            <button type="button" className={styles.actionButtonSecondary} onClick={() => licenceInputRef.current?.click()}>
              {licenceFile ? "Replace licence" : "Upload licence"}
            </button>
          </div>
          <div className={styles.verificationActionItem}>
            <div className={styles.verificationActionIcon}><Video size={20} /></div>
            <div className={styles.verificationActionCopy}>
              <strong>Upload stall walkthrough video</strong>
              <span>{videoFile ? `${videoFile.name} · ${formatFileSize(videoFile.size)}` : "Show signage, stall front, menu board, and operating area. MP4 or MOV."}</span>
            </div>
            <button type="button" className={styles.actionButtonSecondary} onClick={() => videoInputRef.current?.click()}>
              {videoFile ? "Replace video" : "Upload video"}
            </button>
          </div>
          <div className={styles.verificationActionItem}>
            <div className={styles.verificationActionIcon}><Upload size={20} /></div>
            <div className={styles.verificationActionCopy}>
              <strong>Submit evidence for review</strong>
              <span>Hungry Ops reviews your files. Once approved, your merchant dashboard opens.</span>
            </div>
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleSubmitEvidence}
              disabled={evidenceSubmitting || (!licenceFile && !videoFile)}
            >
              {evidenceSubmitting ? (
                <>
                  <Scan size={14} className={styles.animateSpin} />
                  Submitting
                </>
              ) : (
                "Submit evidence"
              )}
            </button>
          </div>
        </div>
        <input
          ref={licenceInputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          className={styles.visuallyHiddenInput}
          onChange={(event) => setLicenceFile(event.target.files?.[0] ?? null)}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/*"
          className={styles.visuallyHiddenInput}
          onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
        />
      </section>

      <div className={styles.verificationDetailsGrid}>
        <div className={styles.dashboardSectionCard}>
          <div className={styles.sectionHeaderRow}><h2>Verification Journey</h2></div>
          <div className={styles.stepList}>
            {verificationState.steps.map((step, i) => {
              const done = step.status === "verified";
              const active = !done && (step.status === "in_review" || step.status === "pending" || step.status === "needs_action");
              const chipClass = done
                ? styles.verificationChipCompleted
                : step.status === "failed"
                  ? styles.verificationChipRejected
                  : step.status === "needs_action"
                    ? styles.verificationChipNeedsAction
                    : styles.verificationChipPending;

              return (
                <div key={step.key} className={styles.stepItem}>
                  <div className={`${styles.stepIcon} ${done ? styles.stepIconDone : active ? styles.stepIconActive : ""}`}>
                    {done ? <CheckCircle size={16} color="white" /> : i + 1}
                  </div>
                  <div className={styles.stepContent}>
                    <div className={styles.verificationStepTitleRow}>
                      <div className={styles.stepTitle}>{step.label}</div>
                      <span className={`${styles.verificationStatusChip} ${chipClass}`}>
                        {done ? <CheckCircle size={13} /> : <Clock size={13} />}
                        {done ? "Completed" : statusCopy[step.status]}
                      </span>
                    </div>
                    <div className={styles.stepDesc}>{stepDescriptions[step.key]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.dashboardSectionCard}>
          <div className={styles.sectionHeaderRow}><h2>Optional Corppass check</h2></div>
          <p className={styles.verificationMutedCopy}>
            Corppass can speed up entity matching, but final approval still comes from Hungry Ops.
          </p>
          {verificationState.steps.find((step) => step.key === "corppass")?.status === "verified" ? (
            <span className={`${styles.verificationStatusChip} ${styles.verificationChipCompleted}`}>
              <CheckCircle size={14} />
              Corppass completed
            </span>
          ) : (
            <button
              type="button"
              onClick={handleSingpassVerifyTrigger}
              className={styles.actionButton}
              aria-disabled={!corppassPrototypeEnabled}
              title={
                corppassPrototypeEnabled
                  ? "Open prototype Corppass flow"
                  : "Corppass integration is not connected in production"
              }
            >
              {corppassPrototypeEnabled ? "Open prototype Corppass flow" : "Corppass unavailable"}
            </button>
          )}
        </div>
      </div>

      {/* Prototype Singpass Corppass Modal Overlay */}
      {corppassPrototypeEnabled && singpassModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setSingpassModalOpen(false)} style={{ zIndex: 1200 }}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Connect Singpass"
            style={{
              maxWidth: "480px",
              borderRadius: "16px",
              border: "1px solid #E5E7EB",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              overflow: "hidden",
              padding: 0
            }}
          >
            {/* Singpass Header */}
            <div style={{ backgroundColor: "#D32F2F", color: "white", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontWeight: 900, fontSize: "20px", letterSpacing: "-1px" }}>singpass</span>
                <span style={{ fontSize: "10px", borderLeft: "1px solid rgba(255,255,255,0.4)", paddingLeft: "8px", color: "rgba(255,255,255,0.8)" }}>Corppass</span>
              </div>
              <button
                onClick={() => setSingpassModalOpen(false)}
                style={{ background: "none", border: "none", color: "white", cursor: "pointer", padding: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "24px" }}>
              {/* Step 1: QR scanning */}
              {singpassStep === "qr" && (
                <div style={{ textAlign: "center" }}>
                  <h4 style={{ fontWeight: 800, fontSize: "16px", marginBottom: "6px" }}>Log In with Singpass App</h4>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "20px" }}>
                    Verify your Singapore corporate profile with Corppass MyInfo.
                  </p>

                  {/* Prototype QR Container */}
                  <div style={{ border: "1px solid #E5E7EB", padding: "16px", borderRadius: "12px", width: "180px", margin: "0 auto 20px", backgroundColor: "#F9FAFB", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                    {/* Simulated SVG QR code */}
                    <svg width="120" height="120" viewBox="0 0 100 100" style={{ shapeRendering: "crispEdges" }}>
                      <rect width="100" height="100" fill="white" />
                      {/* Corners */}
                      <rect x="0" y="0" width="30" height="30" fill="black" />
                      <rect x="5" y="5" width="20" height="20" fill="white" />
                      <rect x="10" y="10" width="10" height="10" fill="black" />

                      <rect x="70" y="0" width="30" height="30" fill="black" />
                      <rect x="75" y="5" width="20" height="20" fill="white" />
                      <rect x="80" y="10" width="10" height="10" fill="black" />

                      <rect x="0" y="70" width="30" height="30" fill="black" />
                      <rect x="5" y="75" width="20" height="20" fill="white" />
                      <rect x="10" y="80" width="10" height="10" fill="black" />

                      {/* Sample pixel chunks */}
                      <rect x="40" y="15" width="15" height="10" fill="black" />
                      <rect x="55" y="40" width="15" height="25" fill="black" />
                      <rect x="15" y="45" width="20" height="10" fill="black" />
                      <rect x="45" y="75" width="30" height="15" fill="black" />
                      <rect x="75" y="45" width="15" height="15" fill="black" />
                    </svg>
                    <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>ID: CRP-819A-981L</span>
                  </div>

                  <button
                    onClick={handleSimulateQRScan}
                    className={styles.actionButton}
                    style={{ width: "100%", backgroundColor: "#D32F2F", border: "none", color: "white", fontWeight: 700, padding: "12px", borderRadius: "var(--radius-md)" }}
                  >
                    Continue prototype QR scan
                  </button>
                </div>
              )}

              {/* Step 2: Extraction Spinner */}
              {singpassStep === "loading" && (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <Scan size={36} className={styles.animateSpin} style={{ color: "#D32F2F", margin: "0 auto 16px" }} />
                  <h4 style={{ fontWeight: 800, fontSize: "16px", marginBottom: "6px" }}>Authenticating with Corppass...</h4>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                    Loading a prototype credential payload for this non-production flow.
                  </p>
                </div>
              )}

              {/* Step 3: ACRA details display */}
              {singpassStep === "details" && (
                <div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", color: "#15803D", backgroundColor: "#DCFCE7", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px", fontSize: "var(--font-size-xs)", fontWeight: 600 }}>
                    <CheckCircle size={16} /> Prototype credential match
                  </div>

                  <h4 style={{ fontWeight: 800, fontSize: "15px", marginBottom: "12px", borderBottom: "1px solid #E5E7EB", paddingBottom: "6px" }}>Prototype business profile details</h4>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px", marginBottom: "24px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr" }}>
                      <span style={{ color: "var(--color-text-muted)" }}>UEN:</span>
                      <strong style={{ fontFamily: "var(--font-mono)" }}>{prototypeAcraDetails.uen}</strong>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr" }}>
                      <span style={{ color: "var(--color-text-muted)" }}>Entity Name:</span>
                      <strong style={{ textTransform: "uppercase" }}>{prototypeAcraDetails.entityName}</strong>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr" }}>
                      <span style={{ color: "var(--color-text-muted)" }}>Type:</span>
                      <span>{prototypeAcraDetails.entityType}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr" }}>
                      <span style={{ color: "var(--color-text-muted)" }}>Constitution:</span>
                      <span>{prototypeAcraDetails.regDate}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr" }}>
                      <span style={{ color: "var(--color-text-muted)" }}>Address:</span>
                      <span style={{ color: "var(--color-text-secondary)" }}>{prototypeAcraDetails.address}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => setSingpassStep("qr")}
                      className={styles.actionButtonSecondary}
                      style={{ flexGrow: 1, padding: "10px" }}
                    >
                      Back
                    </button>
                    <button
                      onClick={handleAuthorizeMyInfo}
                      className={styles.actionButton}
                      style={{ flexGrow: 2, backgroundColor: "#D32F2F", border: "none", color: "white", padding: "10px" }}
                    >
                      Authorize & Share details
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Complete verification */}
              {singpassStep === "done" && (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <CheckCircle size={36} color="#15803D" style={{ margin: "0 auto 16px" }} />
                  <h4 style={{ fontWeight: 800, fontSize: "16px", marginBottom: "6px" }}>Stall Verification Complete</h4>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                    Refreshing your profile settings. Instant verification badge applied successfully!
                  </p>
                </div>
              )}
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
