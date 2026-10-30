/**
 * DeveloperLauncherScreen — feature-rich debug panel
 *
 * Additions vs v1:
 *  - Feature flag toggles (Bites, Decide-for-Me, AI recs)
 *  - Network condition simulator (live / slow / offline)
 *  - Data inspector: shows counts of mock entities
 *  - All section groups collapsed by default, expand on tap
 *  - V1 vs V2 side-by-side comparison grid with compact buttons
 */

import { useState, useMemo } from "react";
import { Pressable, Switch, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronDown, ChevronRight, Wifi, WifiOff, Zap } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Badge, Button, Card, Screen } from "@/components/ui";
import {
  prefetchDishDetail,
  prefetchStallDetail,
  preloadRoute,
} from "@/features/navigation/prefetch";
import {
  getHungryService,
  setMockServiceProvider,
  setSupabaseServiceProvider,
} from "@/lib/services/serviceProvider";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { isMerchantModeActive, useMerchantStore } from "@/store/useMerchantStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore, type PendingRoute } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { DataRepository } from "@/lib/services/types";

type Props = NativeStackScreenProps<RootStackParamList, "DeveloperLauncher">;

function getLauncherRepository(): DataRepository {
  const { getDataRepository } =
    require("@/lib/services/serviceProvider") as typeof import("@/lib/services/serviceProvider");
  return getDataRepository();
}

function getMockData() {
  return require("@/lib/services/mock/data") as typeof import("@/lib/services/mock/data");
}

function getSampleDish(repository = getLauncherRepository()) {
  const { dishes } = getMockData();
  return repository.listPopularNearby()[0] ?? dishes[0];
}

function getSampleVenueId(repository = getLauncherRepository()) {
  const sampleDish = getSampleDish(repository);
  const sampleBuilding = repository.listBuildings()[0];
  const sampleVenue = sampleBuilding
    ? repository.listVenuesByBuilding(sampleBuilding.id)[0]
    : undefined;

  if (sampleVenue?.id) {
    return sampleVenue.id;
  }

  const firstVenueFromAnyBuilding = repository
    .listBuildings()
    .flatMap((building) => repository.listVenuesByBuilding(building.id))[0];
  if (firstVenueFromAnyBuilding?.id) {
    return firstVenueFromAnyBuilding.id;
  }

  if (sampleDish?.venueId) {
    return sampleDish.venueId;
  }

  return getMockData().venues[0]?.id ?? "venue-tian-tian";
}

function getSampleComposerParams(repository = getLauncherRepository()) {
  const dish = getSampleDish(repository);
  return {
    dishId: dish?.id,
    venueId: getSampleVenueId(repository),
  };
}

// ─── Feature Flags (local state — resets on restart) ─────────────────────────

const DEFAULT_FLAGS = {
  floorPlanViewer: true,
  socialBites: true,
  decideForMe: true,
  aiRecommendations: false,
  mapClusterPins: true,
  reviewSuccessModal: true,
};

type FeatureFlags = typeof DEFAULT_FLAGS;
type FlagKey = keyof FeatureFlags;

function isUuidLikeUserId(value?: string | null): value is string {
  return Boolean(
    value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  );
}

const FLAG_LABELS: Record<FlagKey, string> = {
  floorPlanViewer: "Floor Plan Viewer (SVG)",
  socialBites: "Social Bites feed",
  decideForMe: "Dish Roulette / Decide-for-me",
  aiRecommendations: "AI taste recommendations (alpha)",
  mapClusterPins: "Map cluster pins",
  reviewSuccessModal: "Review success modal",
};

// ─── Network Presets ──────────────────────────────────────────────────────────

const NETWORK_PRESETS = [
  { id: "live" as const, label: "Live", icon: "live" },
  { id: "slow" as const, label: "Slow 3G", icon: "slow" },
  { id: "offline" as const, label: "Offline", icon: "offline" },
];

function toDevTestId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  subtitle,
  badge,
  defaultExpanded = false,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const { palette, spacing } = useHungryTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const sectionId = toDevTestId(title);

  return (
    <Card style={{ padding: spacing[3] }} testID={`dev-section-${sectionId}`}>
      <Pressable
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((v) => !v)}
        testID={`dev-section-toggle-${sectionId}`}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing[2],
            }}
          >
            <AppText variant="bodyBold">{title}</AppText>
            {badge ? <Badge label={badge} tone="orange" /> : null}
          </View>
          {subtitle ? (
            <AppText tone="secondary" variant="micro">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {expanded ? (
          <ChevronDown size={16} color={palette.textMuted} />
        ) : (
          <ChevronRight size={16} color={palette.textMuted} />
        )}
      </Pressable>

      {expanded ? (
        <View style={{ gap: 8, marginTop: 12 }} testID={`dev-section-body-${sectionId}`}>
          {children}
        </View>
      ) : null}
    </Card>
  );
}

function DevButton({
  label,
  onPress,
  onPressIn,
  variant = "secondary" as const,
  style,
}: {
  label: string;
  onPress: () => void;
  onPressIn?: () => void;
  variant?: "secondary" | "primary" | "ghost" | "destructive";
  style?: any;
}) {
  return (
    <Button
      label={label}
      variant={variant}
      onPress={onPress}
      onPressIn={onPressIn}
      testID={`dev-button-${toDevTestId(label)}`}
      style={[{ minHeight: 32, paddingVertical: 4 }, style]}
      size="sm"
      fullWidth={false}
    />
  );
}

function VersionPair({
  label,
  onV1,
  onV2,
  onV1PressIn,
  onV2PressIn,
}: {
  label: string;
  onV1: () => void;
  onV2: () => void;
  onV1PressIn?: () => void;
  onV2PressIn?: () => void;
}) {
  const { spacing } = useHungryTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 2,
      }}
    >
      <AppText variant="micro" style={{ fontWeight: "700", flex: 1 }}>
        {label}
      </AppText>
      <View style={{ flexDirection: "row", gap: spacing[1] }}>
        <DevButton label="V1" onPressIn={onV1PressIn} onPress={onV1} style={{ minWidth: 40 }} />
        <DevButton
          label="V2"
          onPressIn={onV2PressIn}
          onPress={onV2}
          variant="primary"
          style={{ minWidth: 40 }}
        />
      </View>
    </View>
  );
}

function DataInspectorContent() {
  const { spacing } = useHungryTheme();
  const stats = useMemo(() => {
    const repository = getLauncherRepository();
    return {
      buildings: repository.listBuildings().length,
      venues: repository
        .listBuildings()
        .flatMap((building) => repository.listVenuesByBuilding(building.id)).length,
      dishes: repository.listPopularNearby().length,
    };
  }, []);

  return (
    <View style={{ gap: spacing[1] }}>
      {[
        { label: "Buildings", value: stats.buildings },
        { label: "Venues", value: stats.venues },
        { label: "Dishes", value: stats.dishes },
      ].map(({ label, value }) => (
        <View
          key={label}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <AppText variant="micro" tone="secondary">
            {label}
          </AppText>
          <AppText variant="micro" style={{ fontFamily: "DMMono_400Regular" }}>
            {value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function PostComposerSettingsContent({
  navigation,
}: {
  navigation: NativeStackScreenProps<RootStackParamList, "DeveloperLauncher">["navigation"];
}) {
  const { palette } = useHungryTheme();
  const { useComposerStore } =
    require("@/features/post/useComposerStore") as typeof import("@/features/post/useComposerStore");
  const media = useComposerStore((state) => state.media);
  const addMedia = useComposerStore((state) => state.addMedia);
  const isBusinessMode = useComposerStore((state) => state.isBusinessMode);
  const setIsBusinessMode = useComposerStore((state) => state.setIsBusinessMode);
  const seedSampleMedia = () => {
    const dish = getSampleDish();
    if (!dish?.imageUrl) {
      return;
    }

    addMedia([
      {
        id: `dev-sample-media-${Date.now()}`,
        uri: dish.imageUrl,
        type: "image",
      },
    ]);
  };

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: 2,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodySmallBold">Business Mode</AppText>
          <AppText variant="micro" tone="secondary">
            Shows business features (Promotions, CTAs, etc.)
          </AppText>
        </View>
        <Switch
          accessibilityLabel="Enable business mode in composer"
          value={isBusinessMode}
          onValueChange={setIsBusinessMode}
          trackColor={{
            false: palette.border,
            true: `${palette.orange}66`,
          }}
          thumbColor={isBusinessMode ? palette.orange : palette.textMuted}
        />
      </View>
      <DevButton
        label={media.length > 0 ? "Sample media added" : "Seed sample media"}
        onPress={seedSampleMedia}
        variant="secondary"
        style={{ marginTop: 8 }}
      />
      <DevButton
        label="Launch V2 Composer"
        onPressIn={() => preloadRoute(navigation, "PostComposerV2", getSampleComposerParams())}
        onPress={() => navigation.navigate("PostComposerV2" as any, getSampleComposerParams())}
        variant="primary"
        style={{ marginTop: 8 }}
      />
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function DeveloperLauncherScreen({ navigation }: Props) {
  const { palette, spacing, radii } = useHungryTheme();

  // Session
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const authenticatedUserId = useSessionStore((state) => state.authenticatedUserId);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const clearSession = useSessionStore((state) => state.clearSession);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const applyProfile = useProfileStore((state) => state.applyProfile);
  const setMerchantAccount = useMerchantStore((state) => state.setAccount);
  const setDeveloperMerchantMode = useMerchantStore((state) => state.setDeveloperMerchantMode);
  const setMerchantModeActive = useMerchantStore((state) => state.setMerchantModeActive);
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isMerchantMode = useMerchantStore(isMerchantModeActive);
  const canAccessMaps = isDeveloperMode || isMerchantMode;
  const currentModeLabel = isDeveloperMode ? "Developer" : isMerchantMode ? "Merchant" : "User";

  // Discovery
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);

  const hideReviewSuccess = useUIStore((state) => state.hideReviewSuccess);
  const showToast = useUIStore((state) => state.showToast);
  const setOffline = useUIStore((state) => state.setOffline);

  // Feature flags
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const toggleFlag = (key: FlagKey) => setFlags((prev) => ({ ...prev, [key]: !prev[key] }));

  // Network
  const [network, setNetwork] = useState<"live" | "slow" | "offline">("live");

  // Helpers
  const resetToSignedOut = () => {
    clearSession();
    setReturnRoute(undefined);
    hideReviewSuccess();
    showToast({ message: "Session reset to signed out.", tone: "info" });
    navigation.reset({
      index: 0,
      routes: [{ name: "AuthStack", params: { screen: "Login" } }],
    });
  };
  const seedMockAuthProfile = async (profile?: { email: string; displayName: string }) => {
    const session = profile
      ? await getHungryService().auth.signUp(profile.email, "dev-password", profile.displayName)
      : await getHungryService().auth.signIn("weiming@example.sg", "dev-password");
    if (!session) {
      throw new Error("Unable to seed mock auth profile.");
    }
    applyProfile(session.profile);
  };

  const resetToNamedAuthComplete = (profile: { email: string; displayName: string }) => {
    setMockServiceProvider();
    clearSession();
    setDeveloperMerchantMode(true);
    setMerchantAccount(null);
    void seedMockAuthProfile(profile).then(() => {
      completeAuth();
      completeOnboarding(false);
      setReturnRoute(undefined);
      hideReviewSuccess();
      showToast({ message: `Session → ${profile.displayName}`, tone: "success" });
      navigation.reset({
        index: 0,
        routes: [{ name: "DeveloperLauncher" }],
      });
    });
  };

  const resetToAuthIncomplete = () => {
    setMockServiceProvider();
    clearSession();
    setDeveloperMerchantMode(true);
    setMerchantAccount(null);
    void seedMockAuthProfile().then(() => {
      completeAuth();
      setReturnRoute(undefined);
      hideReviewSuccess();
      showToast({
        message: "Session → Authenticated (onboarding pending)",
        tone: "info",
      });
      navigation.reset({
        index: 0,
        routes: [{ name: "DeveloperLauncher" }],
      });
    });
  };
  const resetToAuthComplete = () => {
    setMockServiceProvider();
    clearSession();
    setDeveloperMerchantMode(true);
    setMerchantAccount(null);
    void seedMockAuthProfile().then(() => {
      completeAuth();
      completeOnboarding(false);
      setReturnRoute(undefined);
      hideReviewSuccess();
      showToast({ message: "Session → Fully authenticated", tone: "success" });
      navigation.reset({
        index: 0,
        routes: [{ name: "DeveloperLauncher" }],
      });
    });
  };

  const enterMerchantMode = () => {
    clearSession();
    completeAuth();
    completeOnboarding(false);
    setDeveloperMerchantMode(false);
    setMockServiceProvider();
    setMerchantAccount(JSON.parse(JSON.stringify(getMockData().merchantAccount)));
    setMerchantModeActive(true);
    setReturnRoute(undefined);
    hideReviewSuccess();
    showToast({ message: "Mode → Merchant", tone: "success" });
    navigation.navigate("MerchantTabs" as any);
  };

  const enterDeveloperMode = () => {
    clearSession();
    completeAuth();
    completeOnboarding(false);
    setDeveloperMerchantMode(true);
    setMockServiceProvider();
    setMerchantAccount(null);
    setReturnRoute(undefined);
    hideReviewSuccess();
    showToast({ message: "Mode → Developer", tone: "success" });
    navigation.navigate("MainTabs", { screen: "Home" });
  };

  const enterUserMode = () => {
    setDeveloperMerchantMode(false);
    setSupabaseServiceProvider();
    setMerchantAccount(null);
    setReturnRoute(undefined);
    hideReviewSuccess();

    if (isAuthenticated && isUuidLikeUserId(authenticatedUserId)) {
      showToast({ message: "Mode → User", tone: "info" });
      navigation.navigate("MainTabs", { screen: "Home" });
      return;
    }

    void getHungryService()
      .auth.getCurrentSession()
      .then((session) => {
        if (!session) {
          clearSession();
          showToast({ message: "Please sign in to enter User mode.", tone: "info" });
          navigation.reset({
            index: 0,
            routes: [{ name: "AuthStack", params: { screen: "Login" } }],
          });
          return;
        }

        applyProfile(session.profile);
        completeAuth({
          completedOnboarding: true,
          skippedTasteQuiz: true,
          trackSignInEvent: false,
        });
        showToast({ message: "Mode → User", tone: "info" });
        navigation.navigate("MainTabs", { screen: "Home" });
      })
      .catch(() => {
        clearSession();
        showToast({ message: "Please sign in to enter User mode.", tone: "info" });
        navigation.reset({
          index: 0,
          routes: [{ name: "AuthStack", params: { screen: "Login" } }],
        });
      });
  };

  const openActivityInboxSmoke = () => {
    setMockServiceProvider();
    setDeveloperMerchantMode(true);
    setMerchantAccount(null);
    clearSession();
    completeAuth();
    completeOnboarding(false);
    setReturnRoute(undefined);
    hideReviewSuccess();
    navigation.navigate("ActivityInbox", { initialTab: "messages" });
  };

  const openProtected = (returnRoute: string | PendingRoute, navigate: () => void) => {
    if (!isAuthenticated) {
      setReturnRoute(returnRoute);
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }
    navigate();
  };

  const openSampleStallDetail = () => {
    const sampleStallVenueId = getSampleVenueId();
    navigation.navigate("StallDetail", { venueId: sampleStallVenueId });
  };

  const openSampleDishDetail = () => {
    const dish = getSampleDish();
    if (!dish) {
      showToast({ message: "No sample dish is available.", tone: "error" });
      return;
    }

    if (!isAuthenticated) {
      completeAuth();
      completeOnboarding(false);
    }

    navigation.navigate("DishDetail", { dishId: dish.id, source: "developer" });
  };

  return (
    <Screen
      title="Developer Launcher"
      subtitle={`v0.1.0 · ${isAuthenticated ? "Authenticated" : "Signed out"} session`}
    >
      <View style={{ gap: spacing[4] }}>
        {/* ── Quick header badges ────────────────────────── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          <Badge label="DEV ONLY" tone="warning" />
          <Badge
            label={isAuthenticated ? "Authenticated" : "Signed out"}
            tone={isAuthenticated ? "success" : "neutral"}
          />
          <Badge
            label={network === "live" ? "Live" : network === "slow" ? "Slow 3G" : "Offline"}
            tone={network === "live" ? "success" : network === "slow" ? "warning" : "error"}
          />
        </View>

        <Button
          label="Open normal app flow"
          variant="ghost"
          onPress={() => navigation.replace("Splash")}
          style={{ minHeight: 40 }}
        />
        <DevButton
          label="Activity"
          onPressIn={() => preloadRoute(navigation, "ActivityInbox", { initialTab: "messages" })}
          onPress={openActivityInboxSmoke}
        />

        <CollapsibleSection
          title="Developer mode"
          subtitle="Toggle between customer and merchant surfaces."
          badge="Portal"
          defaultExpanded
        >
          <AppText variant="micro" tone="secondary" style={{ marginBottom: spacing[2] }}>
            Current mode: {currentModeLabel}
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            <DevButton
              label="Developer"
              onPress={enterDeveloperMode}
              variant={isDeveloperMode ? "primary" : "ghost"}
            />
            <DevButton
              label="Merchant"
              onPress={enterMerchantMode}
              variant={isMerchantMode && !isDeveloperMode ? "primary" : "ghost"}
            />
            <DevButton
              label="User"
              onPress={enterUserMode}
              variant={!isMerchantMode ? "primary" : "ghost"}
            />
          </View>
        </CollapsibleSection>

        {/* ── Post Composer V2 Settings ─────────────────── */}
        <CollapsibleSection
          title="Post Composer V2 Settings"
          subtitle="Configure the V2 composer state for testing."
          badge="V2"
        >
          <PostComposerSettingsContent navigation={navigation} />
        </CollapsibleSection>

        {/* ── V1 vs V2 Comparison ───────────────────────── */}
        <CollapsibleSection
          title="V1 vs V2 Comparison"
          subtitle="Direct comparison of original screens and prototypes."
          badge="Compare"
          defaultExpanded
        >
          <VersionPair
            label="Post Composer"
            onV1PressIn={() => preloadRoute(navigation, "Post", getSampleComposerParams())}
            onV2PressIn={() =>
              preloadRoute(navigation, "PostComposerV2", getSampleComposerParams())
            }
            onV1={() => navigation.navigate("Post", getSampleComposerParams())}
            onV2={() => navigation.navigate("PostComposerV2" as any, getSampleComposerParams())}
          />
          <VersionPair
            label="Settings"
            onV1={() => navigation.navigate("Settings")}
            onV2={() => navigation.navigate("Settings")}
          />

          <View
            style={{ height: 1, backgroundColor: palette.border, marginVertical: spacing[2] }}
          />

          <AppText variant="bodySmallBold" style={{ marginBottom: 4 }}>
            New Modes & Extras
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            <DevButton
              label="Quick Bites"
              onPressIn={() => preloadRoute(navigation, "QuickBites")}
              onPress={() => navigation.navigate("QuickBites")}
            />
            <DevButton
              label="Design Gallery"
              onPressIn={() => preloadRoute(navigation, "DesignGallery")}
              onPress={() => navigation.navigate("DesignGallery")}
            />
            <DevButton
              label="Merchant Mode"
              onPressIn={() => preloadRoute(navigation, "MerchantTabs")}
              onPress={enterMerchantMode}
              variant="primary"
            />
          </View>
        </CollapsibleSection>

        {/* ── Session Presets ────────────────────────────── */}
        <CollapsibleSection title="Session presets" subtitle="Reset state.">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            <DevButton label="Signed out" onPress={resetToSignedOut} />
            <DevButton label="Auth only" onPress={resetToAuthIncomplete} />
            <DevButton label="Auth + Onboard" onPress={resetToAuthComplete} variant="primary" />
            <DevButton
              label="Auth + Onboard User A"
              onPress={() =>
                resetToNamedAuthComplete({
                  email: "e2e-user-a@example.sg",
                  displayName: "User A",
                })
              }
            />
            <DevButton
              label="Auth + Onboard User B"
              onPress={() =>
                resetToNamedAuthComplete({
                  email: "e2e-user-b@example.sg",
                  displayName: "User B",
                })
              }
            />
          </View>
        </CollapsibleSection>

        {/* ── Feature Flags ──────────────────────────────── */}
        <CollapsibleSection title="Feature flags" subtitle="Toggle features." badge="Local">
          {(Object.keys(flags) as FlagKey[]).map((key) => (
            <View
              key={key}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 2,
              }}
            >
              <AppText variant="bodySmall" style={{ flex: 1 }}>
                {FLAG_LABELS[key]}
              </AppText>
              <Switch
                value={flags[key]}
                onValueChange={() => toggleFlag(key)}
                trackColor={{
                  false: palette.border,
                  true: `${palette.orange}66`,
                }}
                thumbColor={flags[key] ? palette.orange : palette.textMuted}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
          ))}
        </CollapsibleSection>

        {/* ── Core app ───────────────────────────────────── */}
        <CollapsibleSection title="Core app flow" defaultExpanded>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            <DevButton
              label="Home"
              onPressIn={() => preloadRoute(navigation, "MainTabs", { screen: "Home" })}
              onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
            />
            <DevButton
              label="Discover"
              onPressIn={() => preloadRoute(navigation, "MainTabs", { screen: "Discover" })}
              onPress={() => navigation.navigate("MainTabs", { screen: "Discover" })}
            />
            <DevButton
              label="Search"
              onPressIn={() => preloadRoute(navigation, "SearchHome")}
              onPress={() => navigation.navigate("SearchHome")}
            />
            {canAccessMaps ? (
              <DevButton
                label="Map"
                onPressIn={() => preloadRoute(navigation, "DiscoverMap")}
                onPress={() => navigation.navigate("DiscoverMap")}
              />
            ) : null}
            <DevButton
              label="Wheel"
              onPressIn={() => preloadRoute(navigation, "DecideForMeResult")}
              onPress={() => {
                const repository = getLauncherRepository();
                const dish = repository.getDecideForMe({
                  sweet: 3,
                  spicy: 3,
                  sour: 3,
                  salty: 3,
                  rich: 3,
                  aromatic: 3,
                });
                if (dish) setDecideForMe(dish);
                navigation.navigate("DecideForMeResult");
              }}
            />
            <DevButton
              label="Stall"
              onPressIn={() => {
                const repository = getLauncherRepository();
                const sampleStallVenueId = getSampleVenueId(repository);
                prefetchStallDetail(sampleStallVenueId, repository);
                preloadRoute(navigation, "StallDetail", { venueId: sampleStallVenueId });
              }}
              onPress={() => openSampleStallDetail()}
            />
            <DevButton
              label="Dish"
              onPressIn={() => {
                const repository = getLauncherRepository();
                const dish = getSampleDish(repository);
                if (dish?.id) {
                  prefetchDishDetail(dish.id, repository);
                  preloadRoute(navigation, "DishDetail", { dishId: dish.id });
                }
              }}
              onPress={() => openSampleDishDetail()}
            />
            <DevButton
              label="Review"
              onPressIn={() => preloadRoute(navigation, "MainTabs", { screen: "Review" })}
              onPress={() => navigation.navigate("MainTabs", { screen: "Review" })}
            />
            <DevButton
              label="Composer"
              onPressIn={() => preloadRoute(navigation, "Post")}
              onPress={() => openProtected("Post", () => navigation.navigate("Post"))}
            />
            <DevButton
              label="Offline"
              onPressIn={() => preloadRoute(navigation, "Offline")}
              onPress={() => navigation.navigate("Offline")}
            />
            <DevButton
              label="404"
              onPressIn={() =>
                preloadRoute(navigation, "NotFound", {
                  title: "Debug",
                  body: "Opened from dev launcher.",
                })
              }
              onPress={() =>
                navigation.navigate("NotFound", {
                  title: "Debug",
                  body: "Opened from dev launcher.",
                })
              }
            />
          </View>
        </CollapsibleSection>

        {/* ── Auth & Onboarding ───────────────────────────── */}
        <CollapsibleSection title="Auth & Onboarding">
          <AppText variant="micro" tone="muted" style={{ marginBottom: 4 }}>
            Auth
          </AppText>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginBottom: 8 }}
          >
            {[
              { label: "Login", screen: "Login" },
              { label: "SignUp", screen: "SignUp" },
              { label: "Verify", screen: "EmailVerification" },
              { label: "Forgot", screen: "ForgotPassword" },
              { label: "Reset", screen: "ResetPassword" },
            ].map(({ label, screen }) => (
              <DevButton
                key={label}
                label={label}
                onPress={() => navigation.navigate("AuthStack", { screen: screen as any })}
              />
            ))}
          </View>
          <AppText variant="micro" tone="muted" style={{ marginBottom: 4 }}>
            Onboarding
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {[
              { label: "Welcome", screen: "OnboardingWelcome" },
              { label: "Location", screen: "LocationPermission" },
              { label: "Quiz", screen: "TasteQuiz" },
              { label: "Done", screen: "TasteProfileResult" },
            ].map(({ label, screen }) => (
              <DevButton
                key={label}
                label={label}
                onPress={() => navigation.navigate("OnboardingStack", { screen: screen as any })}
              />
            ))}
          </View>
        </CollapsibleSection>

        {/* ── Profile & Review ───────────────────────────── */}
        <CollapsibleSection title="Profile & Review">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            <DevButton
              label="Profile"
              onPress={() =>
                openProtected("Profile", () =>
                  navigation.navigate("MainTabs", {
                    screen: "Profile",
                    params: { screen: "ProfileHome" },
                  }),
                )
              }
            />
            <DevButton
              label="Edit"
              onPress={() => openProtected("EditProfile", () => navigation.navigate("EditProfile"))}
            />
            <DevButton
              label="Favs"
              onPress={() => openProtected("Favourites", () => navigation.navigate("Favourites"))}
            />
            <DevButton
              label="History"
              onPress={() =>
                openProtected("ReviewHistory", () => navigation.navigate("ReviewHistory"))
              }
            />
            <DevButton
              label="Settings"
              onPress={() => openProtected("Settings", () => navigation.navigate("Settings"))}
            />
            <DevButton
              label="QuickRate"
              onPress={() =>
                openProtected("ReviewStack", () =>
                  navigation.navigate("ReviewStack", { screen: "ReviewMain" }),
                )
              }
            />
          </View>
        </CollapsibleSection>

        {/* ── Network Simulation ─────────────────────────── */}
        <CollapsibleSection title="Network simulation" subtitle="Connectivity testing.">
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            {NETWORK_PRESETS.map((preset) => {
              const icon =
                preset.id === "live" ? (
                  <Zap
                    size={14}
                    color={network === preset.id ? palette.white : palette.textMuted}
                  />
                ) : preset.id === "slow" ? (
                  <Wifi
                    size={14}
                    color={network === preset.id ? palette.white : palette.textMuted}
                  />
                ) : (
                  <WifiOff
                    size={14}
                    color={network === preset.id ? palette.white : palette.textMuted}
                  />
                );

              return (
                <Pressable
                  key={preset.id}
                  onPress={() => {
                    setNetwork(preset.id);
                    setOffline(preset.id === "offline");
                    if (preset.id === "offline") {
                      navigation.navigate("Offline");
                    }
                  }}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    backgroundColor: network === preset.id ? palette.orange : palette.surfaceRaised,
                    borderColor: network === preset.id ? palette.orange : palette.border,
                    borderWidth: 1,
                    borderRadius: radii.md,
                    paddingVertical: spacing[2],
                  }}
                >
                  {icon}
                  <AppText variant="micro" tone={network === preset.id ? "inverse" : "secondary"}>
                    {preset.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </CollapsibleSection>

        {/* ── Data Inspector ─────────────────────────────── */}
        <CollapsibleSection title="Data inspector" badge="Mock">
          <DataInspectorContent />
        </CollapsibleSection>

        {/* Safety footer */}
        <View style={{ alignItems: "center", paddingBottom: 40 }}>
          <AppText variant="micro" tone="muted">
            Developer launcher — not visible in production builds
          </AppText>
        </View>
      </View>
    </Screen>
  );
}
