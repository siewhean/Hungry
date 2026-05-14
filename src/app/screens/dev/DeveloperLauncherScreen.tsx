/**
 * DeveloperLauncherScreen — feature-rich debug panel
 *
 * Additions vs v1:
 *  - Feature flag toggles (floor plan, Bites, Decide-for-Me, AI recs)
 *  - Network condition simulator (live / slow / offline)
 *  - Singapore building picker — jump directly to any building's floor plan
 *  - Data inspector: shows counts of mock entities
 *  - All section groups collapsed by default, expand on tap
 *  - V1 vs V2 side-by-side comparison grid with compact buttons
 */

import { useState, useMemo } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronDown, ChevronRight, Wifi, WifiOff, Zap } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Badge, Button, Card, Screen } from "@/components/ui";
import {
  prefetchDishDetail,
  prefetchStallDetail,
  preloadRoute,
} from "@/features/navigation/prefetch";
import { setMockServiceProvider, setSupabaseServiceProvider } from "@/lib/services/serviceProvider";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useMerchantStore } from "@/store/useMerchantStore";
import { useSessionStore, type PendingRoute } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { DataRepository } from "@/lib/services/types";

type Props = NativeStackScreenProps<RootStackParamList, "DeveloperLauncher">;
type SingaporeBuilding =
  (typeof import("@/lib/geo/singaporeBuildings"))["singaporeBuildings"][number];

function getLauncherRepository(): DataRepository {
  const { getDataRepository } =
    require("@/lib/services/serviceProvider") as typeof import("@/lib/services/serviceProvider");
  return getDataRepository();
}

function getSingaporeBuildings(): SingaporeBuilding[] {
  return (require("@/lib/geo/singaporeBuildings") as typeof import("@/lib/geo/singaporeBuildings"))
    .singaporeBuildings;
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

function SGBuildingPickerContent({
  onOpenBuilding,
}: {
  onOpenBuilding: (buildingId: string) => void;
}) {
  const { palette, spacing, radii } = useHungryTheme();
  const buildings = useMemo(() => getSingaporeBuildings().slice(0, 10), []);

  return (
    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
      <View style={{ gap: spacing[1] }}>
        {buildings.map((building) => (
          <Pressable
            key={building.id}
            onPress={() => onOpenBuilding(building.id)}
            style={{
              backgroundColor: palette.surfaceRaised,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: palette.border,
              padding: spacing[2],
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="micro" style={{ fontWeight: "700" }} numberOfLines={1}>
                {building.name}
              </AppText>
            </View>
            <Badge
              label={building.type === "food_court" ? "FC" : "HC"}
              tone={building.type === "food_court" ? "success" : "orange"}
            />
          </Pressable>
        ))}
      </View>
    </ScrollView>
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
      articles: repository.listBlogPosts().length,
      dishes: repository.listPopularNearby().length,
    };
  }, []);

  return (
    <View style={{ gap: spacing[1] }}>
      {[
        { label: "Buildings", value: stats.buildings },
        { label: "Venues", value: stats.venues },
        { label: "Articles", value: stats.articles },
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
  const isBusinessMode = useComposerStore((state) => state.isBusinessMode);
  const setIsBusinessMode = useComposerStore((state) => state.setIsBusinessMode);

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
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const clearSession = useSessionStore((state) => state.clearSession);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const setMerchantAccount = useMerchantStore((state) => state.setAccount);
  const setDeveloperMerchantMode = useMerchantStore((state) => state.setDeveloperMerchantMode);
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isMerchantMode = useMerchantStore((state) => state.account !== null);
  const canAccessMaps = isDeveloperMode || isMerchantMode;
  const currentModeLabel = isDeveloperMode ? "Developer" : isMerchantMode ? "Merchant" : "User";

  // Discovery
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  const setSelectedFloor = useDiscoveryStore((state) => state.setSelectedFloor);
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
  };
  const resetToAuthIncomplete = () => {
    clearSession();
    completeAuth();
    setReturnRoute(undefined);
    hideReviewSuccess();
    showToast({
      message: "Session → Authenticated (onboarding pending)",
      tone: "info",
    });
  };
  const resetToAuthComplete = () => {
    clearSession();
    completeAuth();
    completeOnboarding(false);
    setReturnRoute(undefined);
    hideReviewSuccess();
    showToast({ message: "Session → Fully authenticated", tone: "success" });
  };

  const enterMerchantMode = () => {
    clearSession();
    completeAuth();
    completeOnboarding(false);
    setDeveloperMerchantMode(false);
    setMockServiceProvider();
    setMerchantAccount(JSON.parse(JSON.stringify(getMockData().merchantAccount)));
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
    clearSession();
    completeAuth();
    completeOnboarding(false);
    setReturnRoute(undefined);
    hideReviewSuccess();
    showToast({ message: "Mode → User", tone: "info" });
    navigation.navigate("MainTabs", { screen: "Home" });
  };

  const openBuilding = (buildingId: string) => {
    const building = getSingaporeBuildings().find((b) => b.id === buildingId);
    if (!building) return;
    const summary = {
      id: building.id,
      name: building.name,
      type: building.type,
      coordinate: building.coordinate,
      floors: building.floors,
      venueCount: building.venueCount,
      isClosedToday: building.isClosedToday,
      heroDishId: building.heroDishId ?? "",
    };
    setSelectedBuilding(summary);
    setSelectedFloor(building.floors[0]);
    navigation.navigate("BuildingDrillDown", { buildingId: building.id });
  };

  const openProtected = (returnRoute: string | PendingRoute, navigate: () => void) => {
    if (!isAuthenticated) {
      setReturnRoute(returnRoute);
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }
    navigate();
  };

  const openSampleStallDetail = (version: "v1" | "v2" = "v1") => {
    const sampleStallVenueId = getSampleVenueId();
    if (version === "v2") {
      navigation.navigate("StallDetailV2", { venueId: sampleStallVenueId });
      return;
    }

    navigation.navigate("StallDetail", { venueId: sampleStallVenueId });
  };

  const openSampleDishDetail = (version: "v1" | "v2" = "v1") => {
    const dish = getSampleDish();
    if (!dish) {
      showToast({ message: "No sample dish is available.", tone: "error" });
      return;
    }

    if (!isAuthenticated) {
      completeAuth();
      completeOnboarding(false);
    }

    navigation.navigate(version === "v2" ? "DishDetailV2" : "DishDetail", { dishId: dish.id });
  };

  const prefetchSampleStallDetail = (version: "v1" | "v2" = "v1") => {
    const repository = getLauncherRepository();
    const sampleStallVenueId = getSampleVenueId(repository);
    prefetchStallDetail(sampleStallVenueId, repository);
    preloadRoute(navigation, version === "v2" ? "StallDetailV2" : "StallDetail", {
      venueId: sampleStallVenueId,
    });
  };

  const prefetchSampleDishDetail = (version: "v1" | "v2" = "v1") => {
    const repository = getLauncherRepository();
    const dish = getSampleDish(repository);
    if (!dish) return;
    prefetchDishDetail(dish.id, repository);
    preloadRoute(navigation, version === "v2" ? "DishDetailV2" : "DishDetail", {
      dishId: dish.id,
    });
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
            label="Discover"
            onV1PressIn={() => preloadRoute(navigation, "MainTabs", { screen: "Discover" })}
            onV2PressIn={() => preloadRoute(navigation, "DiscoverV2")}
            onV1={() => navigation.navigate("MainTabs", { screen: "Discover" })}
            onV2={() => navigation.navigate("DiscoverV2")}
          />
          <VersionPair
            label="Search"
            onV1PressIn={() => preloadRoute(navigation, "SearchHome")}
            onV2PressIn={() => preloadRoute(navigation, "SearchHomeV2")}
            onV1={() => navigation.navigate("SearchHome")}
            onV2={() => navigation.navigate("SearchHomeV2")}
          />
          <VersionPair
            label="Stall Detail"
            onV1PressIn={() => prefetchSampleStallDetail("v1")}
            onV2PressIn={() => prefetchSampleStallDetail("v2")}
            onV1={() => openSampleStallDetail("v1")}
            onV2={() => openSampleStallDetail("v2")}
          />
          <VersionPair
            label="Dish Detail"
            onV1PressIn={() => prefetchSampleDishDetail("v1")}
            onV2PressIn={() => prefetchSampleDishDetail("v2")}
            onV1={() => openSampleDishDetail("v1")}
            onV2={() => openSampleDishDetail("v2")}
          />
          <VersionPair
            label="Building"
            onV1PressIn={() =>
              preloadRoute(navigation, "BuildingDrillDown", { buildingId: "hc-maxwell" })
            }
            onV2PressIn={() =>
              preloadRoute(navigation, "BuildingDrillDownV2", { buildingId: "hc-maxwell" })
            }
            onV1={() => openBuilding("hc-maxwell")}
            onV2={() => navigation.navigate("BuildingDrillDownV2", { buildingId: "hc-maxwell" })}
          />
          <VersionPair
            label="QuickReview"
            onV1PressIn={() => preloadRoute(navigation, "ReviewStack", { screen: "ReviewMain" })}
            onV2PressIn={() => preloadRoute(navigation, "QuickReviewV2")}
            onV1={() => navigation.navigate("ReviewStack", { screen: "ReviewMain" })}
            onV2={() => navigation.navigate("QuickReviewV2")}
          />
          <VersionPair
            label="Review Feed"
            onV1PressIn={() => preloadRoute(navigation, "MainTabs", { screen: "Review" })}
            onV2PressIn={() => preloadRoute(navigation, "ReviewFeedV2")}
            onV1={() => navigation.navigate("MainTabs", { screen: "Review" })}
            onV2={() => navigation.navigate("ReviewFeedV2" as any)}
          />
          <VersionPair
            label="Post Composer"
            onV1PressIn={() =>
              preloadRoute(navigation, "PostComposerV2", getSampleComposerParams())
            }
            onV2PressIn={() =>
              preloadRoute(navigation, "PostComposerV2", getSampleComposerParams())
            }
            onV1={() => navigation.navigate("PostComposerV2" as any, getSampleComposerParams())}
            onV2={() => navigation.navigate("PostComposerV2" as any, getSampleComposerParams())}
          />
          <VersionPair
            label="Settings"
            onV1={() => navigation.navigate("Settings")}
            onV2={() => navigation.navigate("Settings")}
          />
          <VersionPair
            label="Splash"
            onV1={() => navigation.navigate("Splash")}
            onV2={() => navigation.navigate("SplashV2" as any, { variant: "A", stay: true })}
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
              onPress={() => openSampleStallDetail("v1")}
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
              onPress={() => openSampleDishDetail("v1")}
            />
            <DevButton
              label="Dish V2"
              onPressIn={() => {
                const repository = getLauncherRepository();
                const dish = getSampleDish(repository);
                if (dish?.id) {
                  prefetchDishDetail(dish.id, repository);
                  preloadRoute(navigation, "DishDetailV2", { dishId: dish.id });
                }
              }}
              onPress={() => openSampleDishDetail("v2")}
            />
            <DevButton
              label="Review"
              onPressIn={() => preloadRoute(navigation, "MainTabs", { screen: "Review" })}
              onPress={() => navigation.navigate("MainTabs", { screen: "Review" })}
            />
            <DevButton
              label="Article"
              onPress={() => {
                const sampleArticle = getLauncherRepository().listBlogPosts()[0];
                if (sampleArticle) {
                  navigation.navigate("BlogPost", { postId: sampleArticle.id });
                }
              }}
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
              { label: "Intro 1", screen: "OnboardingIntro1" },
              { label: "Intro 2", screen: "OnboardingIntro2" },
              { label: "Quiz", screen: "TasteQuiz" },
              { label: "Perms", screen: "LocationPermission" },
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
                  <Zap size={14} color={network === preset.id ? "#fff" : palette.textMuted} />
                ) : preset.id === "slow" ? (
                  <Wifi size={14} color={network === preset.id ? "#fff" : palette.textMuted} />
                ) : (
                  <WifiOff size={14} color={network === preset.id ? "#fff" : palette.textMuted} />
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

        {/* ── SG Building Picker ─────────────────────────── */}
        <CollapsibleSection title="SG Building Picker" subtitle="Jump to floor plan">
          <SGBuildingPickerContent onOpenBuilding={openBuilding} />
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
