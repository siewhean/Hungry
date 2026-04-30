import React from "react";
import { View, ScrollView, StyleSheet, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  QrCode,
  Smartphone,
  CreditCard,
  Clock,
  CheckCircle2,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Button, IconButton, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export function OrdersComingSoonScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <Screen style={{ backgroundColor: palette.bg }}>
      <View style={[styles.header, { paddingTop: spacing[3], paddingHorizontal: spacing[4] }]}>
        <IconButton
          accessibilityLabel="Go back"
          icon={<ChevronLeft size={24} color={palette.text} />}
          onPress={() => navigation.goBack()}
        />
        <AppText variant="h2" style={{ fontWeight: "800" }}>
          In-App Ordering
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing[4], gap: spacing[5], paddingBottom: 100 }}
      >
        {/* Hero Section */}
        <View style={{ alignItems: "center", paddingVertical: spacing[4] }}>
          <View
            style={[styles.heroIcon, { backgroundColor: palette.orangeLight, borderRadius: 48 }]}
          >
            <QrCode size={48} color={palette.orange} />
          </View>
          <AppText
            variant="h2"
            style={{ fontWeight: "bold", textAlign: "center", marginTop: spacing[4] }}
          >
            Coming Soon to Hungry
          </AppText>
          <AppText
            variant="body"
            tone="muted"
            style={{ textAlign: "center", marginTop: spacing[2], paddingHorizontal: spacing[4] }}
          >
            Skip the queue. Let customers order and pay directly from their phones.
          </AppText>
          <Button
            label="Join the Pilot Program"
            variant="primary"
            style={{ marginTop: spacing[4], width: "100%" }}
          />
        </View>

        {/* How it works */}
        <View>
          <AppText variant="h3" style={{ fontWeight: "bold", marginBottom: spacing[3] }}>
            How it works
          </AppText>
          <View
            style={[
              styles.card,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: radii.lg,
              },
            ]}
          >
            <View style={styles.stepRow}>
              <View
                style={[
                  styles.stepIcon,
                  { backgroundColor: palette.bgSoft, borderRadius: radii.md },
                ]}
              >
                <QrCode size={20} color={palette.text} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyBold">1. Customer scans QR</AppText>
                <AppText variant="bodySmall" tone="muted">
                  They browse your menu and order on their phone.
                </AppText>
              </View>
            </View>
            <View style={styles.stepRow}>
              <View
                style={[
                  styles.stepIcon,
                  { backgroundColor: palette.bgSoft, borderRadius: radii.md },
                ]}
              >
                <CreditCard size={20} color={palette.text} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyBold">2. Instant payment</AppText>
                <AppText variant="bodySmall" tone="muted">
                  Payment is processed securely via PayNow or Card.
                </AppText>
              </View>
            </View>
            <View style={styles.stepRow}>
              <View
                style={[
                  styles.stepIcon,
                  { backgroundColor: palette.bgSoft, borderRadius: radii.md },
                ]}
              >
                <Smartphone size={20} color={palette.text} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyBold">3. You receive order</AppText>
                <AppText variant="bodySmall" tone="muted">
                  Order appears instantly on your Hungry merchant dashboard.
                </AppText>
              </View>
            </View>
            <View style={[styles.stepRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <View
                style={[
                  styles.stepIcon,
                  { backgroundColor: palette.bgSoft, borderRadius: radii.md },
                ]}
              >
                <Clock size={20} color={palette.text} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyBold">4. Customer collects</AppText>
                <AppText variant="bodySmall" tone="muted">
                  Tap &quot;Ready&quot; and they get a notification to collect.
                </AppText>
              </View>
            </View>
          </View>
        </View>

        {/* QR Preview */}
        <View>
          <AppText variant="h3" style={{ fontWeight: "bold", marginBottom: spacing[3] }}>
            Preview your QR Code
          </AppText>
          <View
            style={[
              styles.qrPreview,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: radii.lg,
              },
            ]}
          >
            <View style={{ alignItems: "center" }}>
              <AppText
                variant="bodyBold"
                style={{ textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing[2] }}
              >
                Order Here
              </AppText>
              <View style={[styles.qrBox, { borderColor: palette.border, borderRadius: radii.md }]}>
                {/* Fake QR code using squares */}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    width: 140,
                    height: 140,
                    padding: 8,
                  }}
                >
                  {Array.from({ length: 49 }).map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: 14,
                        height: 14,
                        backgroundColor: Math.random() > 0.4 ? palette.text : "transparent",
                        margin: 1,
                      }}
                    />
                  ))}
                  {/* Corner markers */}
                  <View
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      width: 34,
                      height: 34,
                      borderWidth: 4,
                      borderColor: palette.text,
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 34,
                      height: 34,
                      borderWidth: 4,
                      borderColor: palette.text,
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      bottom: 8,
                      left: 8,
                      width: 34,
                      height: 34,
                      borderWidth: 4,
                      borderColor: palette.text,
                    }}
                  />
                </View>
              </View>
              <AppText variant="bodySmall" tone="muted" style={{ marginTop: spacing[3] }}>
                Hungry / Your Stall Name
              </AppText>
            </View>

            <Button
              label="Download PDF Mockup"
              variant="secondary"
              style={{ marginTop: spacing[4], width: "100%" }}
            />
          </View>
        </View>

        {/* Setup Checklist */}
        <View>
          <AppText variant="h3" style={{ fontWeight: "bold", marginBottom: spacing[3] }}>
            Setup Checklist
          </AppText>
          <View
            style={[
              styles.card,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: radii.lg,
              },
            ]}
          >
            <View style={[styles.checklistItem, { borderColor: palette.border }]}>
              <View style={[styles.circle, { borderColor: palette.textMuted }]} />
              <AppText variant="body" style={{ flex: 1, color: palette.textMuted }}>
                Complete Business Verification
              </AppText>
            </View>
            <View style={[styles.checklistItem, { borderColor: palette.border }]}>
              <View style={[styles.circle, { borderColor: palette.textMuted }]} />
              <AppText variant="body" style={{ flex: 1, color: palette.textMuted }}>
                Add your full menu with prices
              </AppText>
            </View>
            <View
              style={[styles.checklistItem, { borderColor: palette.border, borderBottomWidth: 0 }]}
            >
              <View style={[styles.circle, { borderColor: palette.textMuted }]} />
              <AppText variant="body" style={{ flex: 1, color: palette.textMuted }}>
                Link bank account (Coming soon)
              </AppText>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  heroIcon: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    padding: 16,
    borderWidth: 1,
  },
  stepRow: {
    flexDirection: "row",
    gap: 16,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6", // Hardcoded light gray just for the internal dividers
  },
  stepIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  qrPreview: {
    padding: 24,
    borderWidth: 1,
    alignItems: "center",
  },
  qrBox: {
    width: 160,
    height: 160,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
});
