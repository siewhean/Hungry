import React from "react";
import { View, StyleSheet } from "react-native";
import { QrCode, Smartphone, CreditCard, Clock } from "lucide-react-native";

import { AppText, Button, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export function OrdersComingSoonScreen() {
  const { palette, spacing, radii } = useHungryTheme();

  return (
    <Screen title="In-App Ordering">
      <View style={{ gap: spacing[8], width: "100%" }}>
        {/* Hero Section */}
        <View style={{ alignItems: "center", paddingVertical: spacing[4], gap: spacing[4] }}>
          <View
            style={[
              styles.heroIcon,
              { backgroundColor: palette.orangeLight, borderRadius: radii.pill },
            ]}
          >
            <QrCode size={48} color={palette.orange} />
          </View>
          <View style={{ gap: spacing[2], alignItems: "center" }}>
            <AppText variant="h2" style={{ fontWeight: "bold", textAlign: "center" }}>
              Coming Soon to Hungry
            </AppText>
            <AppText
              variant="body"
              tone="muted"
              style={{ textAlign: "center", paddingHorizontal: spacing[4] }}
            >
              Skip the queue. Let customers order and pay directly from their phones.
            </AppText>
          </View>
          <Button label="Pilot Program Unavailable" variant="primary" fullWidth disabled />
          <AppText variant="micro" tone="muted" style={{ textAlign: "center" }}>
            Ordering is not enabled for this build.
          </AppText>
        </View>

        {/* How it works */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3" style={{ fontWeight: "bold" }}>
            How it works
          </AppText>
          <View
            style={[
              styles.card,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: radii.lg,
                padding: spacing[4],
              },
            ]}
          >
            <View
              style={[
                styles.stepRow,
                {
                  borderBottomColor: palette.border,
                  gap: spacing[4],
                  paddingBottom: spacing[4],
                  marginBottom: spacing[4],
                },
              ]}
            >
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
            <View
              style={[
                styles.stepRow,
                {
                  borderBottomColor: palette.border,
                  gap: spacing[4],
                  paddingBottom: spacing[4],
                  marginBottom: spacing[4],
                },
              ]}
            >
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
            <View
              style={[
                styles.stepRow,
                {
                  borderBottomColor: palette.border,
                  gap: spacing[4],
                  paddingBottom: spacing[4],
                  marginBottom: spacing[4],
                },
              ]}
            >
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
            <View
              style={[
                styles.stepRow,
                {
                  borderBottomWidth: 0,
                  paddingBottom: 0,
                  gap: spacing[4],
                  marginBottom: spacing[4],
                },
              ]}
            >
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
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3" style={{ fontWeight: "bold" }}>
            Preview your QR Code
          </AppText>
          <View
            style={[
              styles.qrPreview,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: radii.lg,
                padding: spacing[5] || 24,
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
              <View
                style={[
                  styles.qrBox,
                  {
                    borderColor: palette.border,
                    borderRadius: radii.md,
                    backgroundColor: palette.surface,
                  },
                ]}
              >
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
                        backgroundColor: (i * 7) % 10 > 4 ? palette.text : "transparent",
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
              disabled
              style={{ marginTop: spacing[4], width: "100%" }}
            />
            <AppText variant="micro" tone="muted" style={{ marginTop: spacing[2] }}>
              PDF export will be enabled after ordering setup is active.
            </AppText>
          </View>
        </View>

        {/* Setup Checklist */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3" style={{ fontWeight: "bold" }}>
            Setup Checklist
          </AppText>
          <View
            style={[
              styles.card,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: radii.lg,
                padding: spacing[4],
              },
            ]}
          >
            <View
              style={[
                styles.checklistItem,
                { borderColor: palette.border, gap: spacing[3], paddingVertical: spacing[3] },
              ]}
            >
              <View
                style={[
                  styles.circle,
                  { borderColor: palette.textMuted, borderRadius: radii.pill },
                ]}
              />
              <AppText variant="body" style={{ flex: 1, color: palette.textMuted }}>
                Complete Business Verification
              </AppText>
            </View>
            <View
              style={[
                styles.checklistItem,
                { borderColor: palette.border, gap: spacing[3], paddingVertical: spacing[3] },
              ]}
            >
              <View
                style={[
                  styles.circle,
                  { borderColor: palette.textMuted, borderRadius: radii.pill },
                ]}
              />
              <AppText variant="body" style={{ flex: 1, color: palette.textMuted }}>
                Add your full menu with prices
              </AppText>
            </View>
            <View
              style={[
                styles.checklistItem,
                {
                  borderColor: palette.border,
                  borderBottomWidth: 0,
                  gap: spacing[3],
                  paddingVertical: spacing[3],
                },
              ]}
            >
              <View
                style={[
                  styles.circle,
                  { borderColor: palette.textMuted, borderRadius: radii.pill },
                ]}
              />
              <AppText variant="body" style={{ flex: 1, color: palette.textMuted }}>
                Link bank account (Coming soon)
              </AppText>
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroIcon: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
  },
  stepRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  stepIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  qrPreview: {
    borderWidth: 1,
    alignItems: "center",
  },
  qrBox: {
    width: 160,
    height: 160,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  circle: {
    width: 24,
    height: 24,
    borderWidth: 2,
  },
});
