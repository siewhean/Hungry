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
} from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useHungryTheme } from "@/theme";
import { AppText, Button, EmptyState, Screen } from "@/components/ui";
import { confirmGalleryAccess, isGalleryPermissionGranted } from "@/lib/permissions/gallery";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";

type Props = NativeStackScreenProps<MerchantTabParamList, "VerificationCentre">;
type EvidenceMediaKind = "image" | "video";
type PickedEvidenceAsset = { uri?: string };
type ImagePickerModule = {
  MediaTypeOptions: { Images: unknown; Videos: unknown };
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted?: boolean; status?: string }>;
  launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<{
    canceled: boolean;
    assets?: PickedEvidenceAsset[];
  }>;
};

function loadImagePickerModule(): ImagePickerModule | null {
  try {
    return require("expo-image-picker") as ImagePickerModule;
  } catch {
    return null;
  }
}

export function VerificationCentreScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const setAccount = useMerchantStore((state) => state.setAccount);
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const pickVerificationEvidence = async (kind: EvidenceMediaKind): Promise<string | null> => {
    const imagePicker = loadImagePickerModule();
    if (!imagePicker) {
      throw new Error("Media picker is unavailable in this app build.");
    }

    const shouldRequestPermission = await confirmGalleryAccess({
      title: "Allow gallery access",
      message:
        "Hungry needs access to your gallery to attach verification evidence for this outlet.",
      confirmLabel: "Allow",
      cancelLabel: "Not now",
    });

    if (!shouldRequestPermission) {
      return null;
    }

    const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
    if (!isGalleryPermissionGranted(permission)) {
      throw new Error("Photos permission is required to attach verification evidence.");
    }

    const result = await imagePicker.launchImageLibraryAsync({
      allowsEditing: kind === "image",
      mediaTypes:
        kind === "video"
          ? imagePicker.MediaTypeOptions.Videos
          : imagePicker.MediaTypeOptions.Images,
      quality: 0.82,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets?.length) {
      return null;
    }

    return result.assets[0]?.uri ?? null;
  };

  const handleEvidenceUpload = async (
    method: "video_walkaround" | "licence_upload" | "singpass_myinfo",
    kind: EvidenceMediaKind,
  ) => {
    setUploadError(null);
    setIsUploadingEvidence(true);
    try {
      const fileUrl = await pickVerificationEvidence(kind);
      if (!fileUrl) {
        return;
      }

      await getHungryService().merchant.submitVerification(activeOutlet.id, {
        method,
        fileUrl,
      });
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
              We could not verify your business with the provided information. Please try again.
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

  const renderVerificationMethods = () => {
    if (status === "verified" || status === "submitted" || status === "in_review") {
      return null;
    }

    return (
      <View style={{ gap: spacing[4] }}>
        <AppText variant="h3" style={{ color: palette.text, marginBottom: spacing[4] }}>
          Available Methods
        </AppText>

        <MethodCard
          icon={<Video size={24} color={palette.orange} />}
          title="Video Walkaround"
          description="Attach a short video showing your stall front, menu, and kitchen."
          onPress={() => handleEvidenceUpload("video_walkaround", "video")}
          isLoading={isUploadingEvidence}
        />

        <MethodCard
          icon={<FileText size={24} color={palette.orange} />}
          title="Document Photo"
          description="Attach a photo of your SFA licence or ACRA business profile."
          onPress={() => handleEvidenceUpload("licence_upload", "image")}
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
