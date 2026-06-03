import {
  readConsolePrototypeStorage,
  readConsolePrototypeString,
  writeConsolePrototypeStorage,
} from "@/lib/console/prototypeStorage";

export type MerchantVerificationStatus =
  | "not_started"
  | "pending"
  | "in_review"
  | "more_info"
  | "rejected"
  | "approved";

export type MerchantVerificationStepKey =
  | "business"
  | "documents"
  | "walkaround"
  | "corppass";

export type MerchantVerificationStepStatus =
  | "not_started"
  | "pending"
  | "in_review"
  | "needs_action"
  | "failed"
  | "verified";

export interface MerchantVerificationStep {
  key: MerchantVerificationStepKey;
  label: string;
  status: MerchantVerificationStepStatus;
  updatedAt: string;
}

export interface MerchantVerificationState {
  merchantId: string;
  stallName: string;
  status: MerchantVerificationStatus;
  updatedAt: string;
  updatedBy: string;
  message?: string;
  steps: MerchantVerificationStep[];
}

export const MERCHANT_VERIFICATION_STORAGE_KEY = "merchant_verification_state";
export const MERCHANT_VERIFIED_LEGACY_KEY = "merchant_verified";
export const MERCHANT_VERIFICATION_EVENT = "merchantVerificationChanged";
export const DEMO_MERCHANT_ID = "CLM-106";
export const DEMO_MERCHANT_NAME = "Maxwell Fuzhou Oyster Cake";

const nowIso = () => new Date().toISOString();

export const defaultMerchantVerificationState = (): MerchantVerificationState => ({
  merchantId: DEMO_MERCHANT_ID,
  stallName: DEMO_MERCHANT_NAME,
  status: "pending",
  updatedAt: nowIso(),
  updatedBy: "Hungry Console",
  message: "Your stall claim is waiting for Hungry Ops to review the submitted business evidence.",
  steps: [
    { key: "business", label: "Business information", status: "verified", updatedAt: nowIso() },
    { key: "documents", label: "SFA / NEA licence", status: "pending", updatedAt: nowIso() },
    { key: "walkaround", label: "Physical stall walkthrough", status: "pending", updatedAt: nowIso() },
    { key: "corppass", label: "Singpass Corppass", status: "not_started", updatedAt: nowIso() },
  ],
});

export const isMerchantVerified = (state: MerchantVerificationState): boolean =>
  state.status === "approved";

export function readMerchantVerificationState(): MerchantVerificationState {
  if (typeof window === "undefined") {
    return defaultMerchantVerificationState();
  }

  const saved = readConsolePrototypeStorage<MerchantVerificationState | null>(
    MERCHANT_VERIFICATION_STORAGE_KEY,
    null,
  );
  if (saved) return { ...defaultMerchantVerificationState(), ...saved };

  const legacyVerified = readConsolePrototypeString(MERCHANT_VERIFIED_LEGACY_KEY);
  if (legacyVerified === "true") {
    return {
      ...defaultMerchantVerificationState(),
      status: "approved",
      updatedBy: "Legacy merchant session",
      message: "Your stall has already been verified.",
      steps: defaultMerchantVerificationState().steps.map((step) => ({
        ...step,
        status: "verified",
      })),
    };
  }

  return defaultMerchantVerificationState();
}

export function writeMerchantVerificationState(state: MerchantVerificationState): MerchantVerificationState {
  const nextState = {
    ...state,
    updatedAt: nowIso(),
  };

  if (typeof window !== "undefined") {
    writeConsolePrototypeStorage(MERCHANT_VERIFICATION_STORAGE_KEY, nextState);
    writeConsolePrototypeStorage(MERCHANT_VERIFIED_LEGACY_KEY, isMerchantVerified(nextState) ? "true" : "false");
    window.dispatchEvent(new CustomEvent(MERCHANT_VERIFICATION_EVENT, { detail: nextState }));
  }

  return nextState;
}

export function updateMerchantVerificationStatus(
  status: MerchantVerificationStatus,
  options: {
    message?: string;
    stepUpdates?: Partial<Record<MerchantVerificationStepKey, MerchantVerificationStepStatus>>;
    updatedBy?: string;
  } = {}
): MerchantVerificationState {
  const current = readMerchantVerificationState();
  const stepUpdates = options.stepUpdates ?? {};
  const defaultStepStatus: MerchantVerificationStepStatus = status === "approved" ? "verified" : "pending";

  return writeMerchantVerificationState({
    ...current,
    status,
    updatedBy: options.updatedBy ?? "Hungry Console",
    message: options.message ?? current.message,
    steps: current.steps.map((step) => ({
      ...step,
      status: stepUpdates[step.key] ?? (status === "approved" ? "verified" : step.status || defaultStepStatus),
      updatedAt: stepUpdates[step.key] ? nowIso() : step.updatedAt,
    })),
  });
}

export function subscribeToMerchantVerification(
  callback: (state: MerchantVerificationState) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handleChange = () => callback(readMerchantVerificationState());
  window.addEventListener(MERCHANT_VERIFICATION_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(MERCHANT_VERIFICATION_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}
