import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
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
import { AppText, Button, Screen } from "@/components/ui";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";

type Props = NativeStackScreenProps<MerchantTabParamList, "VerificationCentre">;

export function VerificationCentreScreen({ navigation }: Props) {
  const { palette, spacing, radii } = useHungryTheme();
  const setAccount = useMerchantStore((state) => state.setAccount);
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [isSimulatingUpload, setIsSimulatingUpload] = useState(false);

  if (!activeOutlet) {
    return (
      <Screen title="Error">
        <AppText style={{ color: palette.textSecondary }}>No outlet selected.</AppText>
      </Screen>
    );
  }

  const status = activeOutlet.verification.status;

  const handleMockUpload = async (
    method: "video_walkaround" | "licence_upload" | "singpass_myinfo",
  ) => {
    setIsSimulatingUpload(true);
    try {
      await getHungryService().merchant.submitVerification(activeOutlet.id, {
        method,
        fileUrl: "mock-url://uploaded-file.mp4",
      });
      // Refresh account to get updated status
      const updatedAccount = await getHungryService().merchant.getMerchantAccount();
      if (updatedAccount) setAccount(updatedAccount);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulatingUpload(false);
    }
  };

  const renderStatusHeader = () => {
    switch (status) {
      case "verified":
        return (
          <View
            style={[
              styles.headerBanner,
              { backgroundColor: palette.successSoft, borderRadius: radii.lg },
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
              styles.headerBanner,
              { backgroundColor: palette.orangeLight, borderRadius: radii.lg },
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
              styles.headerBanner,
              { backgroundColor: palette.errorSoft, borderRadius: radii.lg },
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
              styles.headerBanner,
              { backgroundColor: palette.bgSoft, borderRadius: radii.lg },
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
      <View style={styles.methodsContainer}>
        <AppText variant="h3" style={{ color: palette.text, marginBottom: spacing[4] }}>
          Available Methods
        </AppText>

        <MethodCard
          icon={<Video size={24} color={palette.orange} />}
          title="Video Walkaround"
          description="Record a short 30s video showing your stall front, menu, and kitchen."
          onPress={() => handleMockUpload("video_walkaround")}
          isLoading={isSimulatingUpload}
        />

        <MethodCard
          icon={<FileText size={24} color={palette.orange} />}
          title="Document Upload"
          description="Upload your SFA licence or ACRA business profile."
          onPress={() => handleMockUpload("licence_upload")}
          isLoading={isSimulatingUpload}
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
  const { palette, spacing, radii } = useHungryTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={isLoading}
      style={[
        styles.methodCard,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: radii.lg,
        },
      ]}
    >
      <View
        style={[styles.methodIcon, { backgroundColor: palette.bgSoft, borderRadius: radii.md }]}
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

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBanner: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  methodsContainer: {
    gap: 16,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    gap: 16,
  },
  methodIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
