import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { Camera, CheckCircle2, ArrowLeft, Square, CheckSquare } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useHungryTheme } from "@/theme";
import { AppText, Button, Screen, IconButton, Input, Card } from "@/components/ui";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { LocationPrivacy } from "@/types/domain";

type Props = NativeStackScreenProps<MerchantTabParamList, "HomeBasedVerification">;

export function HomeBasedVerificationScreen({ navigation }: Props) {
  const { palette, spacing, radii } = useHungryTheme();
  const setAccount = useMerchantStore((state) => state.setAccount);
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [displayName, setDisplayName] = useState(activeOutlet?.name || "");
  const [privacy, setPrivacy] = useState<LocationPrivacy>("approximate");
  const [safetyChecked, setSafetyChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!activeOutlet) {
    return (
      <Screen style={styles.center}>
        <AppText style={{ color: palette.textSecondary }}>No outlet selected.</AppText>
      </Screen>
    );
  }

  const handleSubmit = async () => {
    if (!displayName.trim() || !safetyChecked) return;

    setIsSubmitting(true);
    try {
      // First update the profile with the specific home-based details
      await getHungryService().merchant.updateBusinessProfile(activeOutlet.id, {
        name: displayName,
        locationPrivacy: privacy,
      });

      // Then submit the verification request
      await getHungryService().merchant.submitVerification(activeOutlet.id, {
        method: "home_based_declaration",
        fileUrl: "mock-url://home-based-photos",
      });

      const updatedAccount = await getHungryService().merchant.getMerchantAccount();
      if (updatedAccount) setAccount(updatedAccount);

      // Go back to the Verification Centre to see the pending status
      navigation.goBack();
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
    }
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
          Home-Based Verification
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <AppText style={{ color: palette.textSecondary, marginBottom: spacing.lg }}>
          Please provide the following details to verify your home-based food business. Your exact
          residential address can be hidden from customers.
        </AppText>

        <Input
          label="Business Profile Name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="e.g. Auntie Mary's Nasi Lemak"
          style={{ marginBottom: spacing.lg }}
        />

        <AppText variant="h3" style={{ color: palette.text, marginBottom: spacing.sm }}>
          Location Privacy
        </AppText>
        <AppText style={{ color: palette.textSecondary, marginBottom: spacing.md, fontSize: 13 }}>
          How should your location appear on the map?
        </AppText>

        <View style={styles.privacyOptions}>
          <PrivacyOption
            title="Approximate Area"
            description="Shows a rough 500m radius"
            selected={privacy === "approximate"}
            onSelect={() => setPrivacy("approximate")}
          />
          <PrivacyOption
            title="Exact Address"
            description="Shows full block and street"
            selected={privacy === "exact"}
            onSelect={() => setPrivacy("exact")}
          />
          <PrivacyOption
            title="Hidden"
            description="Location is not shown at all"
            selected={privacy === "hidden"}
            onSelect={() => setPrivacy("hidden")}
          />
        </View>

        <AppText
          variant="h3"
          style={{ color: palette.text, marginTop: spacing.md, marginBottom: spacing.sm }}
        >
          Menu & Food Photos
        </AppText>
        <Card style={[styles.uploadBox, { borderColor: palette.border }]}>
          <Camera size={32} color={palette.textSecondary} />
          <AppText style={{ color: palette.orange, marginTop: spacing.sm, fontWeight: "bold" }}>
            Tap to Upload
          </AppText>
          <AppText
            style={{
              color: palette.textSecondary,
              marginTop: 4,
              textAlign: "center",
              fontSize: 12,
            }}
          >
            Provide at least 2 photos of your food and 1 photo of your menu/price list.
          </AppText>
        </Card>

        <AppText
          variant="h3"
          style={{ color: palette.text, marginTop: spacing.md, marginBottom: spacing.sm }}
        >
          Food Safety & Guidelines
        </AppText>

        <AppText style={{ color: palette.textSecondary, marginBottom: spacing.sm, fontSize: 13 }}>
          Hungry requires all home-based food businesses to comply with the Singapore Food Agency
          (SFA) guidelines for Home-Based Food Businesses.
        </AppText>

        <View style={[styles.checkboxContainer, { marginTop: spacing.xl }]}>
          <IconButton
            icon={
              safetyChecked ? (
                <CheckSquare size={20} color={palette.orange} />
              ) : (
                <Square size={20} color={palette.textSecondary} />
              )
            }
            size={24}
            variant="ghost"
            accessibilityLabel="Safety acknowledgement checkbox"
            onPress={() => setSafetyChecked(!safetyChecked)}
          />
          <AppText style={{ color: palette.text, flex: 1, marginLeft: 8, fontSize: 13 }}>
            I acknowledge that my home-based business complies with the SFA food hygiene and safety
            guidelines, and I do not provide catering services.
          </AppText>
        </View>
      </ScrollView>

      <View
        style={[styles.footer, { borderTopColor: palette.border, backgroundColor: palette.bg }]}
      >
        <Button
          label="Submit Verification"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!displayName.trim() || !safetyChecked || isSubmitting}
          style={{ width: "100%" }}
        />
      </View>
    </Screen>
  );
}

// Inline helper for privacy options
function PrivacyOption({
  title,
  description,
  selected,
  onSelect,
}: {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { palette, spacing, radii } = useHungryTheme();

  return (
    <Pressable onPress={onSelect}>
      <Card
        style={[
          styles.privacyOption,
          {
            borderColor: selected ? palette.orange : palette.border,
            backgroundColor: selected ? palette.orangeLight : palette.surface,
            borderRadius: radii.md,
          },
        ]}
      >
        <View style={styles.privacyOptionText}>
          <AppText style={{ color: palette.text, fontWeight: "bold" }}>{title}</AppText>
          <AppText style={{ color: palette.textSecondary, fontSize: 12, marginTop: 2 }}>
            {description}
          </AppText>
        </View>
        {selected && <CheckCircle2 size={20} color={palette.orange} />}
      </Card>
    </Pressable>
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
  privacyOptions: {
    gap: 8,
  },
  privacyOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
  },
  privacyOptionText: {
    flex: 1,
  },
  uploadBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: 8,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 32,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    paddingBottom: 32, // Safe area bottom
  },
});
