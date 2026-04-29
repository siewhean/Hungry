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
import { getDataRepository } from "@/lib/services/serviceProvider";
import { singaporeBuildings } from "@/lib/geo/singaporeBuildings";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useSessionStore, type PendingRoute } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { useComposerStore } from "@/features/post/useComposerStore";
import { venues as mockVenues } from "@/lib/services/mock/data";

type Props = NativeStackScreenProps<RootStackParamList, "DeveloperLauncher">;

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

  return (
    <Card style={{ padding: spacing[3] }}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
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

      {expanded ? <View style={{ gap: 8, marginTop: 12 }}>{children}</View> : null}
    </Card>
  );
}

function DevButton({
  label,
  onPress,
  variant = "secondary" as const,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "secondary" | "primary" | "ghost" | "destructive";
  style?: any;
}) {
  return (
    <Button
      label={label}
      variant={variant}
      onPress={onPress}
      style={[{ minHeight: 32, paddingVertical: 4 }, style]}
      size="sm"
      fullWidth={false}
    />
  );
}

function VersionPair({ label, onV1, onV2 }: { label: string; onV1: () => void; onV2: () => void }) {
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
        <DevButton label="V1" onPress={onV1} style={{ minWidth: 40 }} />
        <DevButton label="V2" onPress={onV2} variant="primary" style={{ minWidth: 40 }} />
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function DeveloperLauncherScreen({ navigation }: Props) {
  const { palette, spacing, radii } = useHungryTheme();
  const repository = getDataRepository();

  // Session
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const completeAuth = useSessionStore((state) => state.completeAuth);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const clearSession = useSessionStore((state) => state.clearSession);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);

  // Discovery
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  const setSelectedFloor = useDiscoveryStore((state) => state.setSelectedFloor);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);

  const hideReviewSuccess = useUIStore((state) => state.hideReviewSuccess);
  const showToast = useUIStore((state) => state.showToast);
  const setOffline = useUIStore((state) => state.setOffline);

  // Post Composer V2 State
  const isBusinessMode = useComposerStore((state) => state.isBusinessMode);
  const setIsBusinessMode = useComposerStore((state) => state.setIsBusinessMode);

  // Feature flags
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const toggleFlag = (key: FlagKey) => setFlags((prev) => ({ ...prev, [key]: !prev[key] }));

  // Network
  const [network, setNetwork] = useState<"live" | "slow" | "offline">("live");

  // Building search
  const [buildingSearch, setBuildingSearch] = useState("");
  const filteredBuildings = useMemo(() => {
    if (!buildingSearch.trim()) return singaporeBuildings.slice(0, 10);
    const q = buildingSearch.toLowerCase();
    return singaporeBuildings.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 10);
  }, [buildingSearch]);

  // Sample data
  const sampleDish = useMemo(() => repository.listPopularNearby()[0], [repository]);
  const sampleBuilding = useMemo(() => repository.listBuildings()[0], [repository]);
  const sampleVenue = useMemo(
    () => (sampleBuilding ? repository.listVenuesByBuilding(sampleBuilding.id)[0] : undefined),
    [sampleBuilding, repository],
  );
  const sampleStallVenueId = useMemo(() => {
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

    return mockVenues[0]?.id ?? "venue-tian-tian";
  }, [repository, sampleDish, sampleVenue]);
  const sampleArticle = useMemo(() => repository.listBlogPosts()[0], [repository]);

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

  const openBuilding = (buildingId: string) => {
    const building = singaporeBuildings.find((b) => b.id === buildingId);
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
    if (version === "v2") {
      navigation.navigate("StallDetailV2", { venueId: sampleStallVenueId });
      return;
    }

    navigation.navigate("StallDetail", { venueId: sampleStallVenueId });
  };

  // Data inspector stats
  const stats = useMemo(
    () => ({
      buildings: repository.listBuildings().length,
      sgBuildings: singaporeBuildings.length,
      venues: repository.listBuildings().flatMap((b) => repository.listVenuesByBuilding(b.id))
        .length,
      articles: repository.listBlogPosts().length,
    }),
    [repository],
  );

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

        {/* ── Post Composer V2 Settings ─────────────────── */}
        <CollapsibleSection
          title="Post Composer V2 Settings"
          subtitle="Configure the V2 composer state for testing."
          badge="V2"
          defaultExpanded
        >
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
            onPress={() => navigation.navigate("PostComposerV2" as any)}
            variant="primary"
            style={{ marginTop: 8 }}
          />
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
            onV1={() => navigation.navigate("MainTabs", { screen: "Discover" })}
            onV2={() => navigation.navigate("DiscoverV2")}
          />
          <VersionPair
            label="Search"
            onV1={() => navigation.navigate("SearchHome")}
            onV2={() => navigation.navigate("SearchHomeV2")}
          />
          <VersionPair
            label="Stall Detail"
            onV1={() => openSampleStallDetail("v1")}
            onV2={() => openSampleStallDetail("v2")}
          />
          <VersionPair
            label="Building"
            onV1={() => openBuilding("hc-maxwell")}
            onV2={() => navigation.navigate("BuildingDrillDownV2", { buildingId: "hc-maxwell" })}
          />
          <VersionPair
            label="QuickReview"
            onV1={() => navigation.navigate("ReviewStack", { screen: "ReviewMain" })}
            onV2={() => navigation.navigate("QuickReviewV2")}
          />
          <VersionPair
            label="Review Feed"
            onV1={() => navigation.navigate("MainTabs", { screen: "Review" })}
            onV2={() => navigation.navigate("ReviewFeedV2" as any)}
          />
          <VersionPair
            label="Post Composer"
            onV1={() => navigation.navigate("MainTabs", { screen: "Rate" })}
            onV2={() => navigation.navigate("PostComposerV2" as any)}
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
            <DevButton label="Quick Bites" onPress={() => navigation.navigate("QuickBites")} />
            <DevButton
              label="Design Gallery"
              onPress={() => navigation.navigate("DesignGallery")}
            />
            <DevButton
              label="Merchant Mode"
              onPress={() => navigation.navigate("MerchantTabs" as any)}
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
              onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
            />
            <DevButton
              label="Discover"
              onPress={() => navigation.navigate("MainTabs", { screen: "Discover" })}
            />
            <DevButton label="Search" onPress={() => navigation.navigate("SearchHome")} />
            <DevButton label="Map" onPress={() => navigation.navigate("DiscoverMap")} />
            <DevButton
              label="Wheel"
              onPress={() => {
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
            <DevButton label="Stall" onPress={() => openSampleStallDetail("v1")} />
            <DevButton
              label="Dish"
              onPress={() =>
                sampleDish && navigation.navigate("DishDetail", { dishId: sampleDish.id })
              }
            />
            <DevButton
              label="Review"
              onPress={() => navigation.navigate("MainTabs", { screen: "Review" })}
            />
            <DevButton
              label="Article"
              onPress={() =>
                sampleArticle && navigation.navigate("BlogPost", { postId: sampleArticle.id })
              }
            />
            <DevButton
              label="Composer"
              onPress={() => openProtected("Post", () => navigation.navigate("Post"))}
            />
            <DevButton label="Offline" onPress={() => navigation.navigate("Offline")} />
            <DevButton
              label="404"
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
                openProtected("Rate", () =>
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
        <CollapsibleSection
          title="SG Building Picker"
          subtitle={`${singaporeBuildings.length} buildings · jump to floor plan`}
        >
          <ScrollView
            style={{ maxHeight: 200 }}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: spacing[1] }}>
              {filteredBuildings.map((building) => (
                <Pressable
                  key={building.id}
                  onPress={() => openBuilding(building.id)}
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
        </CollapsibleSection>

        {/* ── Data Inspector ─────────────────────────────── */}
        <CollapsibleSection title="Data inspector" badge="Mock">
          <View style={{ gap: spacing[1] }}>
            {[
              { label: "Buildings", value: stats.buildings },
              { label: "Venues", value: stats.venues },
              { label: "Articles", value: stats.articles },
              { label: "Dishes", value: repository.listPopularNearby().length },
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
