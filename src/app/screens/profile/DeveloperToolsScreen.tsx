import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import * as Updates from "expo-updates";
import { useEffect, useReducer, useState } from "react";
import { Platform, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { FeedbackSheet } from "@/components/feedback/FeedbackSheet";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { AppSymbol, AppText, CelebrationBurst, Chip, FeedErrorBoundary } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { isAnalyticsEnabled } from "@/lib/analytics";
import {
  EXPERIMENTS,
  clearExperimentOverrides,
  getExperimentOverride,
  getExperimentVariant,
  setExperimentOverride,
  setReleaseExperimentOverrides,
  type ExperimentKey,
} from "@/lib/experiments/experiments";
import { successHaptic, warnHaptic } from "@/lib/haptics";
import { reportError } from "@/lib/monitoring/reportError";
import { getCatalogDiagnosticsSnapshot } from "@/lib/services/catalog/diagnostics";
import { useDeveloperToolsStore } from "@/store/useDeveloperToolsStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";

const SENTRY_ON = Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN);
const POSTHOG_ON =
  process.env.EXPO_PUBLIC_DISABLE_POSTHOG !== "1" &&
  Boolean(process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim());

/** The host only, never the full URL or any key. */
function supabaseHost(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url) return "not set";
  try {
    return new URL(url).host;
  } catch {
    return "invalid";
  }
}

function postHogFlagsLoaded(): boolean {
  if (!POSTHOG_ON) return false;
  try {
    const sink =
      require("@/lib/analytics/posthogSink") as typeof import("@/lib/analytics/posthogSink");
    return sink.havePostHogFeatureFlagsLoaded();
  } catch {
    return false;
  }
}

/** Throws while rendering, to show the crash screen a screen shows when it fails. */
function Bomb(): never {
  throw new Error("Developer tools test crash");
}

const yesNo = (value: boolean) => (value ? "Yes" : "No");

export function DeveloperToolsScreen() {
  const navigation = useNavigation();
  const { palette, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const lock = useDeveloperToolsStore((state) => state.lock);
  const profileId = useProfileStore((state) => state.profile?.id);
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [crashed, setCrashed] = useState(false);

  // Release builds ignore QA overrides unless the tools are open, which they are on this screen.
  // This stays on after leaving the screen so a forced variant reaches the screen being tested;
  // locking the tools turns it off.
  useEffect(() => {
    setReleaseExperimentOverrides(true);
  }, []);

  const iconColor = palette.textSecondary;
  const build = Constants.nativeBuildVersion;
  const updateId = Updates.updateId?.slice(0, 8);
  const version = [
    Constants.expoConfig?.version ?? "0.1.0",
    build ? `(${build})` : null,
    updateId ? `update ${updateId}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const buildRows: [string, string][] = [
    ["Version", version],
    ["App environment", FEATURE_FLAGS.appEnv],
    ["Platform", Platform.OS],
    ["Update channel", Updates.channel ?? "none"],
    ["Runtime version", String(Updates.runtimeVersion ?? "none")],
    ["Running embedded build", yesNo(Updates.isEmbeddedLaunch)],
    ["Data source", process.env.EXPO_PUBLIC_HUNGRY_DATA_SOURCE ?? "default"],
    ["Supabase host", supabaseHost()],
    ["Error tracking (Sentry)", SENTRY_ON ? "On" : "Off"],
    ["Usage analytics (PostHog)", POSTHOG_ON ? "On" : "Off"],
    ["Analytics sharing allowed", yesNo(isAnalyticsEnabled())],
    ["PostHog flags loaded", yesNo(postHogFlagsLoaded())],
    ["Signed-in profile", profileId ? profileId.slice(0, 8) : "none"],
  ];

  const copyBuildInfo = () => {
    const text = buildRows.map(([label, value]) => `${label}: ${value}`).join("\n");
    Clipboard.setStringAsync(text)
      .then(() => showToast({ message: "Build info copied.", tone: "success" }))
      .catch((error: unknown) => reportError(error, { area: "developer_tools_copy" }));
  };

  const experimentKeys = Object.keys(EXPERIMENTS) as ExperimentKey[];
  const overrideCount = experimentKeys.filter((key) => getExperimentOverride(key)).length;

  const chooseVariant = (key: ExperimentKey, variant: string | null) => {
    setExperimentOverride(key, variant as never);
    refresh();
  };

  const sendTestError = () => {
    reportError(new Error("Developer tools test error"), { area: "developer_tools_test" });
    showToast({
      message: SENTRY_ON
        ? "Test error sent. Look for it in Sentry."
        : "Error tracking is off in this build, so nothing was sent.",
      tone: SENTRY_ON ? "success" : "error",
    });
  };

  const recentReads = getCatalogDiagnosticsSnapshot().slice(0, 6);

  return (
    <ProfileScreenShell title="Developer tools" testID="developer-tools-screen">
      <SettingsSection
        title="This build"
        description="Press and hold a row to copy the whole list."
      >
        {buildRows.map(([label, value], index) => (
          <SettingsRow
            key={label}
            label={label}
            value={value}
            type="value"
            isLast={index === buildRows.length - 1}
            onLongPress={copyBuildInfo}
          />
        ))}
      </SettingsSection>

      <SettingsSection
        title="Experiments"
        description="Force a variant to preview it. Open the screen again after changing; a screen already open keeps what it had. Forced variants reset when the app restarts."
        collapsible
        defaultCollapsed={false}
        collapsedSummary={overrideCount > 0 ? `${overrideCount} forced` : undefined}
      >
        {experimentKeys.map((key) => {
          const definition = EXPERIMENTS[key];
          const forced = getExperimentOverride(key);
          return (
            <View
              key={key}
              testID={`dev-experiment-${key}`}
              style={{ gap: spacing[2], padding: spacing[4] }}
            >
              <AppText variant="bodyBold">{key}</AppText>
              <AppText variant="bodySmall" tone="secondary">
                {`${definition.status}, showing ${getExperimentVariant(key)}${forced ? " (forced)" : ""}`}
              </AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                <Chip
                  label="Automatic"
                  accessibilityLabel={`${key}: automatic`}
                  selected={!forced}
                  onPress={() => chooseVariant(key, null)}
                />
                {definition.variants.map((variant) => (
                  <Chip
                    key={variant}
                    label={variant}
                    accessibilityLabel={`${key}: ${variant}`}
                    selected={forced === variant}
                    onPress={() => chooseVariant(key, variant)}
                  />
                ))}
              </View>
            </View>
          );
        })}
        <SettingsRow
          label="Clear forced variants"
          type="action"
          isLast
          dimmed={overrideCount === 0}
          icon={<AppSymbol name="resetLocation" size={20} color={iconColor} />}
          onPress={() => {
            clearExperimentOverrides();
            refresh();
          }}
        />
      </SettingsSection>

      <SettingsSection
        title="Feature switches"
        description="Set when the app was built; the build decides them."
        collapsible
      >
        {Object.entries(FEATURE_FLAGS).map(([name, value], index, all) => (
          <SettingsRow
            key={name}
            label={name}
            type="value"
            value={typeof value === "boolean" ? (value ? "On" : "Off") : String(value)}
            isLast={index === all.length - 1}
          />
        ))}
      </SettingsSection>

      <SettingsSection title="Try it" collapsible defaultCollapsed={false}>
        <SettingsRow
          label="Send feedback sheet"
          type="action"
          icon={<AppSymbol name="feedback" size={20} color={iconColor} />}
          onPress={() => setFeedbackOpen(true)}
        />
        <SettingsRow
          label="Success haptic"
          type="action"
          icon={<AppSymbol name="haptics" size={20} color={iconColor} />}
          onPress={successHaptic}
        />
        <SettingsRow
          label="Warning haptic"
          type="action"
          icon={<AppSymbol name="haptics" size={20} color={iconColor} />}
          onPress={warnHaptic}
        />
        <SettingsRow
          label="Success message"
          type="action"
          icon={<AppSymbol name="tried" size={20} color={iconColor} />}
          onPress={() =>
            showToast({ message: "This is what success looks like.", tone: "success" })
          }
        />
        <SettingsRow
          label="Error message"
          type="action"
          isLast
          icon={<AppSymbol name="retry" size={20} color={iconColor} />}
          onPress={() => showToast({ message: "This is what an error looks like.", tone: "error" })}
        />
        <View style={{ alignItems: "center", padding: spacing[4] }}>
          <CelebrationBurst key={burstKey} testID="dev-celebration" />
          <Chip label="Replay celebration" onPress={() => setBurstKey((count) => count + 1)} />
        </View>
      </SettingsSection>

      <SettingsSection
        title="Errors and crashes"
        description="A test error goes to Sentry like a real one. The crash screen shows what a screen does when it fails."
        collapsible
        defaultCollapsed={false}
      >
        <SettingsRow
          label="Send test error to Sentry"
          type="action"
          icon={<AppSymbol name="analytics" size={20} color={iconColor} />}
          onPress={sendTestError}
        />
        <SettingsRow
          label="Show crash screen"
          type="action"
          isLast
          icon={<AppSymbol name="retry" size={20} color={iconColor} />}
          onPress={() => setCrashed(true)}
        />
        {crashed ? (
          <View style={{ height: 320 }}>
            <FeedErrorBoundary
              title="Test crash"
              body="This is the screen people see if a screen fails."
              screenName="DeveloperTools"
              onRetry={() => setCrashed(false)}
            >
              <Bomb />
            </FeedErrorBoundary>
          </View>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Recent catalog reads"
        description="The last reads of stalls and dishes: how long each took and whether it fell back to the saved copy."
        collapsible
      >
        {recentReads.length === 0 ? (
          <SettingsRow label="No reads yet" type="value" value="Browse Home first" isLast />
        ) : (
          recentReads.map((event, index) => (
            <SettingsRow
              key={event.id}
              label={event.operation}
              type="value"
              value={`${event.succeeded ? "ok" : "failed"}, ${event.durationMs} ms${event.fallbackUsed ? ", fallback" : ""}`}
              isLast={index === recentReads.length - 1}
            />
          ))
        )}
        <SettingsRow
          label="Refresh"
          type="action"
          icon={<AppSymbol name="retry" size={20} color={iconColor} />}
          onPress={refresh}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          label="Lock developer tools"
          description="Hides this screen again. Tap Version in Settings seven times to open it."
          type="action"
          isLast
          icon={<AppSymbol name="privacyPolicy" size={20} color={iconColor} />}
          onPress={() => {
            setReleaseExperimentOverrides(false);
            lock();
            navigation.goBack();
          }}
        />
      </SettingsSection>

      <FeedbackSheet visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </ProfileScreenShell>
  );
}
