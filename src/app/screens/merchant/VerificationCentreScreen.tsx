import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  FileText,
  Video,
  Home,
  ChevronRight,
  AlertCircle,
  ArrowLeft,
} from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useHungryTheme } from "@/theme";
import { AppText, Button, Screen, IconButton } from "@/components/ui";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { hungryService } from "@/lib/services/mock/mockService";

type Props = NativeStackScreenProps<MerchantTabParamList, "VerificationCentre">;

export function VerificationCentreScreen({ navigation }: Props) {
  const { palette, spacing, radii } = useHungryTheme();
  const setAccount = useMerchantStore((state) => state.setAccount);
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [isSimulatingUpload, setIsSimulatingUpload] = useState(false);

  if (!activeOutlet) {
    return (
      <Screen style={styles.center}>
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
      await hungryService.merchant.submitVerification(activeOutlet.id, {
        method,
        fileUrl: "mock-url://uploaded-file.mp4",
      });
      // Refresh account to get updated status
      const updatedAccount = await hungryService.merchant.getMerchantAccount();
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
          <View style={[styles.headerBanner, { backgroundColor: palette.successSoft }]}>
            <ShieldCheck size={32} color={palette.success} />
            <AppText variant="h3" style={{ color: palette.success, marginTop: spacing.sm }}>
              Verified Outlet
            </AppText>
            <AppText style={{ color: palette.text, marginTop: spacing.xs, textAlign: "center" }}>
              Your outlet has been fully verified and is visible to customers.
            </AppText>
          </View>
        );
      case "submitted":
      case "in_review":
        return (
          <View style={[styles.headerBanner, { backgroundColor: palette.warningSoft }]}>
            <Clock size={32} color={palette.warning} />
            <AppText variant="h3" style={{ color: palette.warning, marginTop: spacing.sm }}>
              Verification Pending
            </AppText>
            <AppText style={{ color: palette.text, marginTop: spacing.xs, textAlign: "center" }}>
              We are currently reviewing your documents. This usually takes 1-3 business days.
            </AppText>
          </View>
        );
      case "rejected":
        return (
          <View style={[styles.headerBanner, { backgroundColor: palette.errorSoft }]}>
            <AlertCircle size={32} color={palette.error} />
            <AppText variant="h3" style={{ color: palette.error, marginTop: spacing.sm }}>
              Verification Rejected
            </AppText>
            <AppText style={{ color: palette.text, marginTop: spacing.xs, textAlign: "center" }}>
              We could not verify your business with the provided information. Please try again.
            </AppText>
          </View>
        );
      default:
        return (
          <View style={[styles.headerBanner, { backgroundColor: palette.surface }]}>
            <ShieldAlert size={32} color={palette.orange} />
            <AppText variant="h3" style={{ color: palette.text, marginTop: spacing.sm }}>
              Verify Your Outlet
            </AppText>
            <AppText
              style={{ color: palette.textSecondary, marginTop: spacing.xs, textAlign: "center" }}
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
        <AppText variant="h3" style={{ color: palette.text, marginBottom: spacing.md }}>
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
    <Screen scroll={false} fullWidth>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <IconButton
          icon={<ArrowLeft size={20} color={palette.text} />}
          onPress={() => navigation.goBack()}
          size={24}
          variant="ghost"
          accessibilityLabel="Back"
        />
        <AppText variant="h3" style={{ color: palette.text }}>
          Verification Centre
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        {renderStatusHeader()}
        {renderVerificationMethods()}
      </ScrollView>
    </Screen>
  );
}

// Inline helper for method cards
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
    <View
      style={[
        styles.methodCard,
        { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: radii.md },
      ]}
    >
      <View style={[styles.methodIcon, { backgroundColor: palette.orangeLight }]}>{icon}</View>
      <View style={styles.methodContent}>
        <AppText style={{ color: palette.text, fontWeight: "bold", marginBottom: 2 }}>
          {title}
        </AppText>
        <AppText variant="bodySmall" style={{ color: palette.textSecondary }}>
          {description}
        </AppText>
      </View>
      <View style={styles.methodAction}>
        <Button
          label="Start"
          variant="secondary"
          size="sm"
          onPress={onPress}
          loading={isLoading}
          disabled={isLoading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBanner: {
    alignItems: "center",
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
  },
  methodsContainer: {
    marginTop: 8,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  methodContent: {
    flex: 1,
    marginRight: 12,
  },
  methodAction: {
    minWidth: 80,
  },
});
