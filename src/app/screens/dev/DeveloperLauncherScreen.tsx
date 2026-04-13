/**
 * DeveloperLauncherScreen — feature-rich debug panel
 *
 * Additions vs v1:
 *  - Feature flag toggles (floor plan, Bites, Decide-for-Me, AI recs)
 *  - Network condition simulator (live / slow / offline)
 *  - Singapore building picker — jump directly to any building's floor plan
 *  - Data inspector: shows counts of mock entities
 *  - All section groups collapsed by default, expand on tap
 */

import { useState, useMemo } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronDown, ChevronRight, FlaskConical, Wifi, WifiOff, Zap } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Badge, Button, Card, Screen } from "@/components/ui";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { singaporeBuildings } from "@/lib/geo/singaporeBuildings";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useSessionStore, type PendingRoute } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

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
    <Card>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <AppText variant="h3">{title}</AppText>
            {badge ? <Badge label={badge} tone="orange" /> : null}
          </View>
          {subtitle ? <AppText tone="secondary" variant="bodySmall">{subtitle}</AppText> : null}
        </View>
        {expanded ? (
          <ChevronDown size={18} color={palette.textMuted} />
        ) : (
          <ChevronRight size={18} color={palette.textMuted} />
        )}
      </Pressable>

      {expanded ? <View style={{ gap: 10, marginTop: 14 }}>{children}</View> : null}
    </Card>
  );
}

function LaunchButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Button label={label} variant="secondary" onPress={onPress} />;
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
    () => repository.listVenuesByBuilding(sampleBuilding.id)[0],
    [sampleBuilding.id, repository]
  );
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
    showToast({ message: "Session → Authenticated (onboarding pending)", tone: "info" });
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

  // Data inspector stats
  const stats = useMemo(
    () => ({
      buildings: repository.listBuildings().length,
      sgBuildings: singaporeBuildings.length,
      venues: repository.listBuildings().flatMap((b) =>
        repository.listVenuesByBuilding(b.id)
      ).length,
      articles: repository.listBlogPosts().length,
    }),
    [repository]
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
          <Badge label={isAuthenticated ? "Authenticated" : "Signed out"} tone={isAuthenticated ? "success" : "neutral"} />
          <Badge
            label={network === "live" ? "Live" : network === "slow" ? "Slow 3G" : "Offline"}
            tone={network === "live" ? "success" : network === "slow" ? "warning" : "error"}
          />
        </View>

        <Button
          label="Open normal app flow"
          onPress={() => navigation.replace("Splash")}
        />

        {/* ── Session Presets ────────────────────────────── */}
        <CollapsibleSection
          title="Session presets"
          subtitle="Reset session to a known state before testing flows."
          defaultExpanded
        >
          <LaunchButton label="Signed out" onPress={resetToSignedOut} />
          <LaunchButton
            label="Authenticated · onboarding incomplete"
            onPress={resetToAuthIncomplete}
          />
          <LaunchButton
            label="Authenticated · onboarding complete"
            onPress={resetToAuthComplete}
          />
        </CollapsibleSection>

        {/* ── Feature Flags ──────────────────────────────── */}
        <CollapsibleSection
          title="Feature flags"
          subtitle="Toggle features on/off without restarting."
          badge="Local"
        >
          {(Object.keys(flags) as FlagKey[]).map((key) => (
            <View
              key={key}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
            >
              <AppText style={{ flex: 1 }}>{FLAG_LABELS[key]}</AppText>
              <Switch
                value={flags[key]}
                onValueChange={() => toggleFlag(key)}
                trackColor={{ false: palette.border, true: `${palette.orange}66` }}
                thumbColor={flags[key] ? palette.orange : palette.textMuted}
              />
            </View>
          ))}
        </CollapsibleSection>

        {/* ── Network Simulation ─────────────────────────── */}
        <CollapsibleSection
          title="Network simulation"
          subtitle="Simulate connectivity conditions for error state testing."
        >
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
                    backgroundColor:
                      network === preset.id ? palette.orange : palette.surfaceRaised,
                    borderColor: network === preset.id ? palette.orange : palette.border,
                    borderWidth: 1,
                    borderRadius: radii.md,
                    paddingVertical: spacing[3],
                  }}
                >
                  {icon}
                  <AppText
                    variant="bodySmall"
                    tone={network === preset.id ? "inverse" : "secondary"}
                  >
                    {preset.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </CollapsibleSection>

        {/* ── Auth flow ──────────────────────────────────── */}
        <CollapsibleSection title="Auth flow">
          {[
            { label: "Login", screen: "Login" },
            { label: "Sign Up", screen: "SignUp" },
            { label: "Email Verification", screen: "EmailVerification" },
            { label: "Forgot Password", screen: "ForgotPassword" },
            { label: "Reset Password", screen: "ResetPassword" },
            { label: "Reset Password Success", screen: "ResetPasswordSuccess" },
          ].map(({ label, screen }) => (
            <LaunchButton
              key={label}
              label={label}
              onPress={() => navigation.navigate("AuthStack", { screen: screen as any })}
            />
          ))}
        </CollapsibleSection>

        {/* ── Onboarding flow ────────────────────────────── */}
        <CollapsibleSection title="Onboarding flow">
          {[
            { label: "Intro 1 — Dish first", screen: "OnboardingIntro1" },
            { label: "Intro 2 — Social cues", screen: "OnboardingIntro2" },
            { label: "Taste Quiz", screen: "TasteQuiz" },
            { label: "Location Permission", screen: "LocationPermission" },
          ].map(({ label, screen }) => (
            <LaunchButton
              key={label}
              label={label}
              onPress={() => navigation.navigate("OnboardingStack", { screen: screen as any })}
            />
          ))}
        </CollapsibleSection>

        {/* ── Core app ───────────────────────────────────── */}
        <CollapsibleSection title="Core app" defaultExpanded>
          <LaunchButton
            label="Home feed"
            onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
          />
          <LaunchButton
            label="Discover"
            onPress={() => navigation.navigate("MainTabs", { screen: "Discover" })}
          />
          <LaunchButton label="Search" onPress={() => navigation.navigate("SearchHome")} />
          <LaunchButton
            label="Map Browse"
            onPress={() => navigation.navigate("MainTabs", { screen: "Maps" })}
          />
          <LaunchButton
            label="Floor Plan — Maxwell Food Centre"
            onPress={() => openBuilding("hc-maxwell")}
          />
          <LaunchButton
            label="Floor Plan — Old Airport Road"
            onPress={() => openBuilding("hc-old-airport-road")}
          />
          <LaunchButton
            label="What to eat? (Dish Roulette)"
            onPress={() => {
              const dish = repository.getDecideForMe({ sweet: 3, spicy: 3, sour: 3, salty: 3, rich: 3, aromatic: 3 });
              if (dish) setDecideForMe(dish);
              navigation.navigate("DecideForMeResult");
            }}
          />
          <LaunchButton
            label="Stall Detail"
            onPress={() => navigation.navigate("StallDetail", { venueId: sampleVenue.id })}
          />
          <LaunchButton
            label="Dish Detail"
            onPress={() => navigation.navigate("DishDetail", { dishId: sampleDish.id })}
          />
          <LaunchButton
            label="Read feed"
            onPress={() => navigation.navigate("MainTabs", { screen: "Reads" })}
          />
          <LaunchButton
            label="Article"
            onPress={() => navigation.navigate("BlogPost", { postId: sampleArticle.id })}
          />
          <LaunchButton
            label="Post composer"
            onPress={() => openProtected("Post", () => navigation.navigate("Post"))}
          />
          <LaunchButton label="Offline screen" onPress={() => navigation.navigate("Offline")} />
          <LaunchButton
            label="Not found"
            onPress={() =>
              navigation.navigate("NotFound", {
                title: "Debug",
                body: "Opened from dev launcher.",
              })
            }
          />
        </CollapsibleSection>

        {/* ── Profile & Review ───────────────────────────── */}
        <CollapsibleSection title="Profile & Review">
          <LaunchButton
            label="Profile"
            onPress={() =>
              openProtected("Profile", () =>
                navigation.navigate("MainTabs", { screen: "Profile", params: { screen: "ProfileHome" } })
              )
            }
          />
          <LaunchButton
            label="Edit Profile"
            onPress={() =>
              openProtected("EditProfile", () => navigation.navigate("EditProfile"))
            }
          />
          <LaunchButton
            label="Favourites"
            onPress={() =>
              openProtected("Favourites", () => navigation.navigate("Favourites"))
            }
          />
          <LaunchButton
            label="Review History"
            onPress={() =>
              openProtected("ReviewHistory", () => navigation.navigate("ReviewHistory"))
            }
          />
          <LaunchButton
            label="Settings"
            onPress={() =>
              openProtected("Settings", () => navigation.navigate("Settings"))
            }
          />
          <LaunchButton
            label="Quick Review"
            onPress={() =>
              openProtected("Review", () =>
                navigation.navigate("ReviewStack", { screen: "ReviewHub" })
              )
            }
          />
        </CollapsibleSection>

        {/* ── SG Building Picker ─────────────────────────── */}
        <CollapsibleSection
          title="Singapore Building Picker"
          subtitle={`${singaporeBuildings.length} buildings in dataset · tap any to open floor plan`}
        >
          <View
            style={{
              backgroundColor: palette.surfaceRaised,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: palette.border,
              padding: spacing[3],
            }}
          >
            <AppText variant="bodySmall" tone="muted">
              Search…
            </AppText>
          </View>
          <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <View style={{ gap: spacing[2] }}>
              {singaporeBuildings.map((building) => (
                <Pressable
                  key={building.id}
                  onPress={() => openBuilding(building.id)}
                  style={{
                    backgroundColor: palette.surfaceRaised,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: palette.border,
                    padding: spacing[3],
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodySmall" style={{ fontFamily: "Nunito_700Bold" }} numberOfLines={1}>
                      {building.name}
                    </AppText>
                    <AppText variant="micro" tone="muted">
                      {building.venueCount} stalls · {building.floors.join(", ")}
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
          <View style={{ gap: spacing[3] }}>
            {[
              { label: "Mock buildings", value: stats.buildings },
              { label: "SG dataset buildings", value: stats.sgBuildings },
              { label: "Mock venues/stalls", value: stats.venues },
              { label: "Blog articles", value: stats.articles },
              { label: "Total dishes", value: repository.listPopularNearby().length },
            ].map(({ label, value }) => (
              <View
                key={label}
                style={{ flexDirection: "row", justifyContent: "space-between" }}
              >
                <AppText tone="secondary">{label}</AppText>
                <AppText style={{ fontFamily: "DMMono_400Regular" }}>{value}</AppText>
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
