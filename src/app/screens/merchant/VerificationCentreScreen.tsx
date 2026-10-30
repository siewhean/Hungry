import React, { useState } from "react";
import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  FileText,
  Video,
  Home,
  ChevronRight,
  AlertCircle,
  Camera,
} from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useHungryTheme } from "@/theme";
import { ClaimStepper } from "@/components/merchant/ClaimStepper";
import { SetupChecklist } from "@/components/merchant/SetupChecklist";
import { AccessibleImage, AppText, Button, EmptyState, Screen } from "@/components/ui";
import {
  MAX_EVIDENCE_VIDEO_SECONDS,
  pickMerchantMedia,
  type MerchantMediaKind,
  type MerchantMediaSource,
} from "@/features/merchant/merchantMediaPicker";
import { isVerificationCurrent } from "@/features/merchant/merchantGuards";
import { trackMerchantEvent } from "@/features/merchant/merchantTracking";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import { reportError } from "@/lib/monitoring/reportError";
import { useExperimentVariant } from "@/lib/experiments/experiments";

type Props = NativeStackScreenProps<MerchantTabParamList, "VerificationCentre">;
type EvidenceMethod = "video_walkaround" | "licence_upload";
type PendingEvidence = { method: EvidenceMethod; kind: MerchantMediaKind; uri: string };

const METHOD_LABELS: Record<EvidenceMethod, string> = {
  video_walkaround: "Video walkaround",
  licence_upload: "Document photo",
};

export function VerificationCentreScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const setAccount = useMerchantStore((state) => state.setAccount);
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Picking only stages the file; nothing is uploaded until the merchant reviews and submits.
  const [pendingEvidence, setPendingEvidence] = useState<PendingEvidence | null>(null);

  // The checklist test only applies while the stall is not verified: that is its first open.
  const checklistVariant = useExperimentVariant("merchant_setup_checklist_v1", {
    enabled: Boolean(activeOutlet) && !isVerificationCurrent(activeOutlet?.verification),
  });

  if (!activeOutlet) {
    return (
      <Screen title="Error">
        <EmptyState
          title="No outlet selected"
          body="Choose an outlet to continue with verification."
          errorMessage="No active outlet is currently selected for verification actions."
          sendErrorContext="Verification centre"
          icon={<Home size={36} color={palette.textMuted} />}
        />
      </Screen>
    );
  }

  const isExpired =
    activeOutlet.verification.status === "verified" &&
    !isVerificationCurrent(activeOutlet.verification);
  // An expired verification is handled like a fresh one: the merchant resubmits evidence.
  const status = isExpired ? "not_started" : activeOutlet.verification.status;
  // What Hungry asked for: the rejection reason, else the newest ops note on the evidence.
  const opsNote =
    activeOutlet.verification.rejectionReason?.trim() ||
    [...activeOutlet.verification.evidence]
      .reverse()
      .find((item) => item.reviewNote?.trim())
      ?.reviewNote?.trim();
  const isResubmission = status === "rejected" || status === "more_info_needed";

  const handlePickEvidence = async (
    method: EvidenceMethod,
    kind: MerchantMediaKind,
    source: MerchantMediaSource = "library",
  ) => {
    setUploadError(null);
    try {
      const uri = await pickMerchantMedia({
        kind,
        source,
        rationale:
          "Hungry needs access to your gallery to attach verification evidence for this outlet.",
      });
      if (!uri) return;
      setPendingEvidence({ method, kind, uri });
      trackMerchantEvent("merchant_verification_started", activeOutlet.id, { method, source });
    } catch (e) {
      reportError(e, { screen: "VerificationCentre", action: "pick_evidence" });
      setUploadError(e instanceof Error ? e.message : "Unable to open the photo picker.");
    }
  };

  const handleSubmitEvidence = async () => {
    if (!pendingEvidence) return;
    setUploadError(null);
    setIsUploadingEvidence(true);
    try {
      const evidence = { method: pendingEvidence.method, fileUrl: pendingEvidence.uri };
      if (isResubmission) {
        await getHungryService().merchant.resubmitVerification(activeOutlet.id, evidence);
      } else {
        await getHungryService().merchant.submitVerification(activeOutlet.id, evidence);
      }
      trackMerchantEvent("merchant_verification_submitted", activeOutlet.id, {
        method: pendingEvidence.method,
        resubmission: isResubmission,
      });
      setPendingEvidence(null);
      const updatedAccount = await getHungryService().merchant.getMerchantAccount();
      if (updatedAccount) setAccount(updatedAccount);
    } catch (e) {
      reportError(e, { screen: "VerificationCentre", action: "submit_evidence" });
      setUploadError(e instanceof Error ? e.message : "Unable to upload verification evidence.");
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  const renderStatusHeader = () => {
    switch (status) {
      case "verified":
        return (
          <View
            style={[
              { padding: spacing[6], alignItems: "center", justifyContent: "center" },
              { backgroundColor: palette.successSoft, borderRadius: componentRadii.card },
            ]}
          >
            <ShieldCheck size={32} color={palette.success} />
            <AppText variant="h3" style={{ color: palette.success, marginTop: spacing[2] }}>
              Verified outlet
            </AppText>
            <AppText style={{ color: palette.text, marginTop: spacing[1], textAlign: "center" }}>
              {activeOutlet?.isLive
                ? "Your outlet is verified and visible to customers."
                : 'Your outlet is verified. Turn on "Show on Hungry" in your profile so customers can see it.'}
            </AppText>
          </View>
        );
      case "submitted":
      case "in_review":
        return (
          <View
            style={[
              { padding: spacing[6], alignItems: "center", justifyContent: "center" },
              { backgroundColor: palette.orangeLight, borderRadius: componentRadii.card },
            ]}
          >
            <Clock size={32} color={palette.orange} />
            {/* orangeText: orange on the soft orange fill is under 4.5:1 at this size. */}
            <AppText variant="h3" style={{ color: palette.orangeText, marginTop: spacing[2] }}>
              Verification pending
            </AppText>
            <AppText style={{ color: palette.text, marginTop: spacing[1], textAlign: "center" }}>
              Hungry is reviewing your documents. This usually takes a few working days. You can
              keep setting up your stall and menu while you wait.
            </AppText>
            <View style={{ alignSelf: "stretch", gap: spacing[2], marginTop: spacing[4] }}>
              <Button label="Set up your menu" onPress={() => navigation.navigate("Menu")} />
              <Button
                label="Set up your profile"
                variant="secondary"
                onPress={() => navigation.navigate("Profile")}
              />
            </View>
          </View>
        );
      case "rejected":
        return (
          <View
            style={[
              { padding: spacing[6], alignItems: "center", justifyContent: "center" },
              { backgroundColor: palette.errorSoft, borderRadius: componentRadii.card },
            ]}
          >
            <AlertCircle size={32} color={palette.error} />
            <AppText variant="h3" style={{ color: palette.error, marginTop: spacing[2] }}>
              Verification rejected
            </AppText>
            <AppText style={{ color: palette.text, marginTop: spacing[1], textAlign: "center" }}>
              {opsNote
                ? `Reason: ${opsNote}`
                : "We could not verify your business with the provided information."}
            </AppText>
            <AppText
              variant="bodySmall"
              style={{ color: palette.textSecondary, marginTop: spacing[2], textAlign: "center" }}
            >
              Choose a method below to resubmit.
            </AppText>
          </View>
        );
      case "more_info_needed":
        return (
          <View
            style={[
              { padding: spacing[6], alignItems: "center", justifyContent: "center" },
              { backgroundColor: palette.warningSoft, borderRadius: componentRadii.card },
            ]}
          >
            <AlertCircle size={32} color={palette.warningText} />
            <AppText variant="h3" style={{ color: palette.warningText, marginTop: spacing[2] }}>
              More information needed
            </AppText>
            <AppText style={{ color: palette.text, marginTop: spacing[1], textAlign: "center" }}>
              {opsNote
                ? `Hungry asked: ${opsNote}`
                : "Hungry needs more evidence before it can verify your outlet."}
            </AppText>
            <AppText
              variant="bodySmall"
              style={{ color: palette.textSecondary, marginTop: spacing[2], textAlign: "center" }}
            >
              Choose a method below to send what was asked for.
            </AppText>
          </View>
        );
      default:
        return (
          <View
            style={[
              { padding: spacing[6], alignItems: "center", justifyContent: "center" },
              { backgroundColor: palette.bgSoft, borderRadius: componentRadii.card },
            ]}
          >
            <ShieldAlert size={32} color={palette.orange} />
            <AppText variant="h3" style={{ color: palette.text, marginTop: spacing[2] }}>
              {isExpired ? "Verification expired" : "Verify your outlet"}
            </AppText>
            <AppText
              style={{ color: palette.textSecondary, marginTop: spacing[1], textAlign: "center" }}
            >
              {isExpired
                ? "Your verification has expired, so changes to what diners see are paused. Select a method below to verify again."
                : "Verification shows diners that this stall is yours and publishes your menu and profile. Select a verification method below."}
            </AppText>
          </View>
        );
    }
  };

  const renderPendingEvidence = () => {
    if (!pendingEvidence) return null;
    return (
      <View
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          gap: spacing[3],
          padding: spacing[4],
        }}
      >
        <AppText variant="bodyBold" accessibilityRole="header">
          Review before submitting
        </AppText>
        {pendingEvidence.kind === "image" ? (
          <AccessibleImage
            source={{ uri: pendingEvidence.uri }}
            style={{ width: "100%", height: 180, borderRadius: componentRadii.input }}
            accessibilityLabel={`${METHOD_LABELS[pendingEvidence.method]} preview`}
          />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <Video size={20} color={palette.orange} />
            <AppText variant="body">Video selected</AppText>
          </View>
        )}
        <AppText variant="bodySmall" tone="muted">
          {METHOD_LABELS[pendingEvidence.method]}. Check it is clear and shows your business, then
          submit it for review.
        </AppText>
        <Button
          label={isResubmission ? "Resubmit for review" : "Submit for review"}
          onPress={() => void handleSubmitEvidence()}
          loading={isUploadingEvidence}
          disabled={isUploadingEvidence}
        />
        <Button
          label="Choose a different file"
          variant="ghost"
          onPress={() => setPendingEvidence(null)}
          disabled={isUploadingEvidence}
        />
      </View>
    );
  };

  const renderVerificationMethods = () => {
    if (status === "verified" || status === "submitted" || status === "in_review") {
      return null;
    }
    if (pendingEvidence) return null;

    return (
      <View style={{ gap: spacing[4] }}>
        <AppText variant="h3" style={{ color: palette.text, marginBottom: spacing[4] }}>
          Available methods
        </AppText>

        <MethodCard
          icon={<Video size={24} color={palette.orange} />}
          title="Video walkaround"
          description={`Attach a video of up to ${MAX_EVIDENCE_VIDEO_SECONDS / 60} minutes showing your stall front, menu, and kitchen.`}
          onPress={() => void handlePickEvidence("video_walkaround", "video")}
          isLoading={isUploadingEvidence}
        />

        <MethodCard
          icon={<FileText size={24} color={palette.orange} />}
          title="Document photo"
          description="Attach a photo of your NEA hawker licence, SFA food shop licence or ACRA business profile."
          onPress={() => void handlePickEvidence("licence_upload", "image")}
          isLoading={isUploadingEvidence}
        />

        <MethodCard
          icon={<Camera size={24} color={palette.orange} />}
          title="Take document photo"
          description="Use your camera to photograph your NEA hawker licence, SFA food shop licence or ACRA business profile."
          onPress={() => void handlePickEvidence("licence_upload", "image", "camera")}
          isLoading={isUploadingEvidence}
        />

        <MethodCard
          icon={<Home size={24} color={palette.orange} />}
          title="Home-Based Business"
          description="Special verification path for home-based food businesses."
          onPress={() => navigation.navigate("HomeBasedVerification")}
          isLoading={false}
        />
      </View>
    );
  };

  return (
    <Screen title="Verification Centre">
      <View style={{ gap: spacing[6], width: "100%" }}>
        {status === "verified" && activeOutlet.isLive ? null : (
          <ClaimStepper current={status === "verified" ? 3 : 2} />
        )}
        {renderStatusHeader()}
        {checklistVariant === "checklist" && status !== "verified" ? (
          <SetupChecklist
            outlet={activeOutlet}
            showVerifyAction={false}
            onAction={(action) => navigation.navigate(action === "menu" ? "Menu" : "Profile")}
          />
        ) : null}
        {uploadError ? (
          <AppText variant="bodySmall" style={{ color: palette.error }}>
            {uploadError}
          </AppText>
        ) : null}
        {renderPendingEvidence()}
        {renderVerificationMethods()}
      </View>
    </Screen>
  );
}

function MethodCard({
  icon,
  title,
  description,
  onPress,
  isLoading,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
  isLoading: boolean;
}) {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ disabled: isLoading, busy: isLoading }}
      onPress={onPress}
      disabled={isLoading}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          padding: spacing[4],
          borderWidth: 1,
          gap: spacing[4],
        },
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
        },
      ]}
    >
      <View
        style={[
          { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
          { backgroundColor: palette.bgSoft, borderRadius: componentRadii.iconButton },
        ]}
      >
        {icon}
      </View>
      <View style={{ flex: 1, paddingRight: spacing[2] }}>
        <AppText variant="bodyBold">{title}</AppText>
        <AppText variant="bodySmall" tone="muted" style={{ marginTop: 2 }}>
          {description}
        </AppText>
      </View>
      {isLoading ? (
        <ActivityIndicator size="small" color={palette.orange} />
      ) : (
        <ChevronRight size={20} color={palette.textMuted} />
      )}
    </Pressable>
  );
}
