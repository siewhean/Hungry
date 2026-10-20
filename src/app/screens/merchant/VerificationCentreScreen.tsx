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
import { AccessibleImage, AppText, Button, EmptyState, Screen } from "@/components/ui";
import {
  MAX_EVIDENCE_VIDEO_SECONDS,
  pickMerchantMedia,
  type MerchantMediaKind,
  type MerchantMediaSource,
} from "@/features/merchant/merchantMediaPicker";
import { trackMerchantEvent } from "@/features/merchant/merchantTracking";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";

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

  const status = activeOutlet.verification.status;

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
      setUploadError(e instanceof Error ? e.message : "Unable to open the photo picker.");
    }
  };

  const handleSubmitEvidence = async () => {
    if (!pendingEvidence) return;
    setUploadError(null);
    setIsUploadingEvidence(true);
    try {
      const evidence = { method: pendingEvidence.method, fileUrl: pendingEvidence.uri };
      if (status === "rejected") {
        await getHungryService().merchant.resubmitVerification(activeOutlet.id, evidence);
      } else {
        await getHungryService().merchant.submitVerification(activeOutlet.id, evidence);
      }
      trackMerchantEvent("merchant_verification_submitted", activeOutlet.id, {
        method: pendingEvidence.method,
        resubmission: status === "rejected",
      });
      setPendingEvidence(null);
      const updatedAccount = await getHungryService().merchant.getMerchantAccount();
      if (updatedAccount) setAccount(updatedAccount);
    } catch (e) {
      console.error(e);
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
              Verified Outlet
            </AppText>
            <AppText style={{ color: palette.text, marginTop: spacing[1], textAlign: "center" }}>
              Your outlet has been fully verified and is visible to customers.
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
            <AppText variant="h3" style={{ color: palette.orange, marginTop: spacing[2] }}>
              Verification Pending
            </AppText>
            <AppText style={{ color: palette.text, marginTop: spacing[1], textAlign: "center" }}>
              We are currently reviewing your documents. This usually takes 1-3 business days.
            </AppText>
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
              Verification Rejected
            </AppText>
            <AppText style={{ color: palette.text, marginTop: spacing[1], textAlign: "center" }}>
              {activeOutlet.verification.rejectionReason?.trim()
                ? `Reason: ${activeOutlet.verification.rejectionReason.trim()}`
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
              Verify Your Outlet
            </AppText>
            <AppText
              style={{ color: palette.textSecondary, marginTop: spacing[1], textAlign: "center" }}
            >
              Verified stalls rank higher and get a trusted badge. Select a verification method
              below.
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
          label={status === "rejected" ? "Resubmit for review" : "Submit for review"}
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
          Available Methods
        </AppText>

        <MethodCard
          icon={<Video size={24} color={palette.orange} />}
          title="Video Walkaround"
          description={`Attach a video of up to ${MAX_EVIDENCE_VIDEO_SECONDS / 60} minutes showing your stall front, menu, and kitchen.`}
          onPress={() => void handlePickEvidence("video_walkaround", "video")}
          isLoading={isUploadingEvidence}
        />

        <MethodCard
          icon={<FileText size={24} color={palette.orange} />}
          title="Document Photo"
          description="Attach a photo of your SFA licence or ACRA business profile."
          onPress={() => void handlePickEvidence("licence_upload", "image")}
          isLoading={isUploadingEvidence}
        />

        <MethodCard
          icon={<Camera size={24} color={palette.orange} />}
          title="Take Document Photo"
          description="Use your camera to photograph your SFA licence or ACRA business profile."
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
        {renderStatusHeader()}
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
