import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Clipboard, Pressable, Share, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import {
  ChevronRight,
  Settings,
  Utensils,
  Heart,
  Edit2,
  Menu,
  PencilLine,
  Send,
  Copy,
  Share2,
  BarChart3,
  LogOut,
  Store,
  Bookmark,
  MessageCircleMore,
  ImagePlus,
  Trophy,
} from "lucide-react-native";

import { AccessibleImage, AppText, Card, EmptyState } from "@/components/ui";
import { FloatingShareSendButton, InAppShareCard } from "@/components/social";
import { MissionBanner } from "@/components/gamification/MissionBanner";
import { PassportCard } from "@/components/gamification/PassportCard";
import { toChatShareRecipient, type ChatShareRecipient } from "@/features/home/chatShare";
import { prefetchMerchantTab, preloadRoute } from "@/features/navigation/prefetch";
import { listSharedStallPosts } from "@/features/social/sharedStallPosts";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useUIStore } from "@/store/useUIStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { useStoryStore } from "@/store/useStoryStore";
import { useSocialStore } from "@/store/useSocialStore";
import { ProfileScreenShell } from "./ProfileScreenShell";
import { useMerchantStore } from "@/store/useMerchantStore";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { TASTE_DIMENSIONS } from "@/constants/taste";
import { useActivityStore } from "@/store/useActivityStore";
import { useFoodCredStore } from "@/store/useFoodCredStore";
import { usePassportStore } from "@/store/usePassportStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useStallSubmissionStore } from "@/store/useStallSubmissionStore";
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { StallPost } from "@/types/domain";
import { UserProfileContent } from "./UserProfileContent";

type ProfileRouteParams = {
  params?: {
    authorName?: string;
    authorAvatarUrl?: string;
    reviewSignalLabel?: string;
    authorId?: string;
  };
};

function normalizePersonName(name: string) {
  return name.trim().toLowerCase();
}

function haveEqualPosts(left: StallPost[], right: StallPost[]) {
  if (left.length !== right.length) return false;

  for (let i = 0; i < left.length; i += 1) {
    const lhs = left[i];
    const rhs = right[i];

    if (
      lhs.id !== rhs.id ||
      lhs.authorId !== rhs.authorId ||
      lhs.authorName !== rhs.authorName ||
      lhs.createdAt !== rhs.createdAt ||
      lhs.venueId !== rhs.venueId
    ) {
      return false;
    }
  }

  return true;
}

type ProfileHomeProps = {
  navigation: any;
  route?: ProfileRouteParams;
  mode?: "self" | "other";
  authorName?: string;
  authorAvatarUrl?: string;
  reviewSignalLabel?: string;
  authorId?: string;
};

export function ProfileHomeScreen({
  navigation,
  route,
  mode = "self",
  authorName,
  authorAvatarUrl,
  reviewSignalLabel,
  authorId,
}: ProfileHomeProps) {
  const resolvedReviewSignalLabel =
    reviewSignalLabel ?? route?.params?.reviewSignalLabel ?? "Reviews";
  const viewerAuthorName = mode === "other" ? (authorName ?? route?.params?.authorName) : undefined;
  const viewerAuthorAvatarUrl =
    mode === "other" ? (authorAvatarUrl ?? route?.params?.authorAvatarUrl) : undefined;
  const viewerAuthorId = mode === "other" ? (authorId ?? route?.params?.authorId) : undefined;
  const isOtherUserProfile = mode === "other";

  const { colorScheme, componentRadii, palette, spacing, radii, shadows } = useHungryTheme();
  const headerActionSize = spacing[8] + spacing[2.5];
  const tasteBarColors = {
    sweet: palette.statusFast,
    spicy: palette.orange,
    sour: palette.warning,
    salty: palette.info,
    rich: palette.amber,
    aromatic: palette.teal,
  };
  const profile = useProfileStore((state) => state.profile);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const signOut = useSessionStore((state) => state.signOut);
  const merchantAccount = useMerchantStore((state) => state.account);
  const followedUserIds = useSocialStore((state) => state.followedUserIds);
  const reviewEntries = useProfileStore((state) => state.reviewEntries);
  const sharePostToChat = useActivityStore((state) => state.sharePostToChat);
  const { loadStories } = useStoryStore();
  const loadCredProfile = useFoodCredStore((s) => s.loadCredProfile);
  const loadMissions = useMissionStore((s) => s.loadMissions);
  const loadStallSubmissions = useStallSubmissionStore((s) => s.loadSubmissions);
  const stallSubmissions = useStallSubmissionStore((s) => s.submissions);
  const loadStallInteractions = useStallInteractionStore((s) => s.loadInteractions);
  const stallInteractions = useStallInteractionStore((state) => state.interactions);
  const computePassportProgress = usePassportStore((s) => s.computeProgress);
  const insets = useSafeAreaInsets();
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const shareSnapPoints = useMemo(() => ["45%"], []);
  const [profileFollowerCount, setProfileFollowerCount] = useState<number | null>(null);
  const [profileFollowingCount, setProfileFollowingCount] = useState<number | null>(null);
  const triedStallIds = useMemo(
    () =>
      Object.values(stallInteractions)
        .filter((interaction) => interaction.isTried)
        .map((interaction) => interaction.stallId),
    [stallInteractions],
  );

  const [selectedShareChatIds, setSelectedShareChatIds] = useState<string[]>([]);
  const [shareRecipients, setShareRecipients] = useState<ChatShareRecipient[]>([]);
  const directMessagesEnabled = FEATURE_FLAGS.directMessagesEnabled;
  const gamificationEnabled = FEATURE_FLAGS.gamificationEnabled;
  const storiesEnabled = FEATURE_FLAGS.storiesEnabled;
  const [isTasteShareSheetOpen, setIsTasteShareSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profilePosts, setProfilePosts] = useState<StallPost[]>([]);
  const rootNavigation = getRootNavigation(navigation as any);

  const openProfileConnections = useCallback(
    (target: "Followers" | "Following", params: { userId?: string; userDisplayName?: string }) => {
      const routeNames = navigation?.getState?.()?.routeNames ?? [];
      if (routeNames.includes(target)) {
        navigation.navigate(target, params);
        return;
      }

      rootNavigation.navigate("MainTabs", {
        screen: "Profile",
        params: { screen: target, params },
      });
    },
    [navigation, rootNavigation],
  );
  const [activeShareTab, setActiveShareTab] = useState<"posts" | "reviews">("posts");
  const handleReviewsCardPress = useCallback(() => {
    if (isOtherUserProfile) {
      setActiveShareTab((current) => (current === "reviews" ? current : "reviews"));
      return;
    }

    preloadRoute(navigation, "ReviewHistory");
    navigation.navigate("ReviewHistory");
  }, [isOtherUserProfile, navigation]);
  const avatarSize = spacing[20];
  const avatarInitials = useMemo(
    () =>
      (isAuthenticated ? profile.displayName : "Guest User")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "HU",
    [isAuthenticated, profile.displayName],
  );

  const loadChatConversations = useCallback(async () => {
    if (!FEATURE_FLAGS.directMessagesEnabled) {
      setShareRecipients([]);
      return;
    }

    try {
      const conversations = await getHungryService().chat.listConversations();
      setShareRecipients(conversations.map(toChatShareRecipient));
    } catch {
      setShareRecipients([]);
    }
  }, []);

  const prefetchMerchantDashboard = useCallback(() => {
    const outlet = merchantAccount?.outlets[0];
    prefetchMerchantTab("Dashboard", outlet?.id, merchantAccount?.id);
    preloadRoute(rootNavigation, "MerchantTabs");
  }, [merchantAccount, rootNavigation]);

  // The tab navigator preloads Profile in the background; only redirect a guest who actually opened it.
  const isFocused = useIsFocused();
  useEffect(() => {
    if (mode !== "self" || isAuthenticated || !isFocused) {
      return;
    }

    setReturnRoute("Profile");
    rootNavigation.reset({
      index: 0,
      routes: [{ name: "AuthStack", params: { screen: "Login" } }],
    });
  }, [isAuthenticated, isFocused, mode, rootNavigation, setReturnRoute]);

  useEffect(() => {
    if (isAuthenticated) {
      if (storiesEnabled) {
        void loadStories().catch(() => undefined);
      }

      void loadStallSubmissions().catch(() =>
        useUIStore.getState().showToast({
          message: "Could not load your stall submissions. Try again.",
          tone: "warning",
        }),
      );

      if (gamificationEnabled) {
        void loadCredProfile(profile.id).catch(() => undefined);
        void loadMissions(profile.id).catch(() => undefined);
        void loadStallInteractions(profile.id)
          .then(() => {
            computePassportProgress(triedStallIds);
          })
          .catch(() =>
            useUIStore.getState().showToast({
              message: "Could not refresh visited stalls. Open Visited stalls to retry.",
              tone: "warning",
            }),
          );
      }
    }
  }, [
    computePassportProgress,
    gamificationEnabled,
    isAuthenticated,
    loadCredProfile,
    loadMissions,
    loadStallSubmissions,
    loadStallInteractions,
    loadStories,
    storiesEnabled,
    triedStallIds,
    profile.id,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      setProfilePosts([]);
      return;
    }

    let isMounted = true;

    const loadProfilePosts = async () => {
      try {
        const posts = await listSharedStallPosts();
        if (!isMounted) return;
        const nextPosts = posts.filter((post) => post.authorId === profile.id);
        setProfilePosts((current) => (haveEqualPosts(current, nextPosts) ? current : nextPosts));
      } catch {
        if (isMounted)
          useUIStore.getState().showToast({
            message: "Could not refresh your posts. Your last loaded posts are still available.",
            tone: "warning",
          });
      }
    };

    void loadProfilePosts();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, profile.displayName, profile.id]);

  const sortedProfilePosts = useMemo(() => {
    return [...profilePosts].sort((a, b) => {
      if (a.createdAt === b.createdAt) return 0;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [profilePosts]);

  const sharedReviews = useMemo(() => {
    const repository = getDataRepository();

    const reviewItems = profile.reviewedDishIds
      .map((dishId) => {
        const entry = reviewEntries[dishId];
        const dish = repository.getDishById(dishId);
        return {
          id: dishId,
          title: dish?.name ?? "Review",
          subtitle: dish ? `Review for ${dish.name}` : "Review",
          text: entry?.text || "You reviewed this dish.",
          createdAt: entry?.createdAt ?? new Date(0).toISOString(),
        };
      })
      .filter((item) => Boolean(item.text));

    if (!reviewItems.length) return [];
    return reviewItems.sort((a, b) => {
      if (a.createdAt === b.createdAt) return 0;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [profile.reviewedDishIds, reviewEntries]);

  const profileStatSummary = useMemo(
    () => ({
      followers: profileFollowerCount ?? "unavailable",
      following: profileFollowingCount ?? "unavailable",
      saved: profile.favouriteDishIds.length,
    }),
    [profileFollowerCount, profileFollowingCount, profile.favouriteDishIds.length],
  );
  useEffect(() => {
    let active = true;
    setProfileFollowerCount(null);
    setProfileFollowingCount(null);
    if (isAuthenticated && isFocused) {
      void Promise.all([
        getHungryService().social.listFollowers(profile.id),
        getHungryService().social.listFollowing(profile.id),
      ])
        .then(([followers, following]) => {
          if (!active) return;
          setProfileFollowerCount(new Set(followers.map((person) => person.userId)).size);
          setProfileFollowingCount(new Set(following.map((person) => person.userId)).size);
        })
        .catch(() => {
          if (active)
            useUIStore.getState().showToast({
              message:
                "Could not refresh relationship counts. Open Followers or Following to retry.",
              tone: "warning",
            });
        });
    }
    return () => {
      active = false;
    };
  }, [isAuthenticated, isFocused, profile.id, followedUserIds]);

  const handleShareTaste = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsTasteShareSheetOpen(true);
    await loadChatConversations();
    shareSheetRef.current?.present();
  }, [isAuthenticated, loadChatConversations]);

  const tasteShareMessage = useMemo(() => {
    const topTastes = Object.entries(profile.tasteVector)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([key, val]) => `${key} ${Math.round((val / 10) * 100)}%`);

    return `Check out my Taste Fingerprint on Hungry!\n\nTop taste traits: ${topTastes.join(", ")}`;
  }, [profile.tasteVector]);

  const copyTasteFingerprintLink = useCallback(() => {
    Clipboard.setString(tasteShareMessage);
  }, [tasteShareMessage]);

  const shareTasteProfileOutsideApp = useCallback(async () => {
    try {
      await Share.share({ message: tasteShareMessage });
    } catch (error) {
      console.error("Error sharing taste fingerprint outside app:", error);
    }
  }, [tasteShareMessage]);

  const sendTasteProfileToHungryUsers = useCallback(async () => {
    if (!FEATURE_FLAGS.directMessagesEnabled) return;
    if (selectedShareChatIds.length === 0) return;

    try {
      await Promise.all(
        selectedShareChatIds.map((chatId) =>
          sharePostToChat(chatId, {
            postId: `taste-fingerprint-${profile.id}`,
            title: "Taste Fingerprint",
            subtitle: `${profile.displayName} · Taste profile`,
            imageUrl: profile.avatarUrl ?? "",
            authorName: profile.displayName,
          }),
        ),
      );
    } catch {
      Alert.alert("Could not share taste profile", "Please try again.");
      return;
    }

    setSelectedShareChatIds([]);
    shareSheetRef.current?.dismiss();
  }, [profile.avatarUrl, profile.displayName, profile.id, selectedShareChatIds, sharePostToChat]);

  const resetShareSheet = useCallback(() => {
    setIsTasteShareSheetOpen(false);
    setSelectedShareChatIds([]);
  }, []);

  const toggleShareChat = useCallback((chatId: string) => {
    setSelectedShareChatIds((current) =>
      current.includes(chatId)
        ? current.filter((candidate) => candidate !== chatId)
        : [...current, chatId],
    );
  }, []);
  const handleMenuToggle = useCallback(() => {
    setMenuOpen((current) => !current);
  }, []);

  if (mode === "other" && viewerAuthorName) {
    return (
      <UserProfileContent
        navigation={navigation as any}
        authorName={viewerAuthorName}
        authorAvatarUrl={viewerAuthorAvatarUrl}
        authorId={viewerAuthorId}
      />
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ProfileScreenShell
      title="Profile"
      showBack={false}
      testID="profile-home-screen"
      headerRight={
        <View style={{ position: "relative", alignItems: "flex-end", zIndex: 30, elevation: 30 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={menuOpen ? "Close quick access" : "Open quick access"}
            hitSlop={10}
            onPress={handleMenuToggle}
            style={{
              borderRadius: radii.pill,
              alignItems: "center",
              height: headerActionSize,
              justifyContent: "center",
              width: headerActionSize,
            }}
          >
            <Menu color={palette.text} size={22} />
          </Pressable>
          {menuOpen && (
            <View
              style={{
                position: "absolute",
                top: spacing[8] + spacing[0.5],
                right: 0,
                gap: spacing[1],
                ...shadows.floating,
                ...(colorScheme === "dark"
                  ? {
                      shadowColor: palette.white,
                      shadowOpacity: 0.24,
                      shadowRadius: 14,
                      shadowOffset: { width: 0, height: 10 },
                      elevation: 18,
                    }
                  : {}),
                paddingVertical: spacing[1],
                minWidth: 230,
                alignItems: "stretch",
                zIndex: 20,
              }}
            >
              {FEATURE_FLAGS.merchantCentreEnabled && merchantAccount !== null && (
                <MenuRow
                  label="Merchant Dashboard"
                  icon={<Store size={20} color={palette.orange} />}
                  onPressIn={prefetchMerchantDashboard}
                  onPress={() => {
                    setMenuOpen(false);
                    rootNavigation.navigate("MerchantTabs" as any);
                  }}
                />
              )}
              {isAuthenticated && FEATURE_FLAGS.collectionsEnabled && (
                <MenuRow
                  label="Liked Content"
                  icon={<Heart size={20} color={palette.error} fill={palette.error} />}
                  onPressIn={() => preloadRoute(navigation, "SocialGrid", { type: "liked" })}
                  onPress={() => {
                    setMenuOpen(false);
                    navigation.navigate("SocialGrid", { type: "liked" });
                  }}
                />
              )}
              {isAuthenticated && (
                <MenuRow
                  label="Add Discovered Stall"
                  icon={<ImagePlus size={20} color={palette.orange} />}
                  onPressIn={() => preloadRoute(navigation, "AddStall")}
                  onPress={() => {
                    setMenuOpen(false);
                    navigation.navigate("AddStall");
                  }}
                />
              )}
              {isAuthenticated && FEATURE_FLAGS.collectionsEnabled && (
                <MenuRow
                  label="My Checklists"
                  icon={<Bookmark size={20} color={palette.orange} />}
                  onPressIn={() => preloadRoute(navigation, "ChecklistsHome")}
                  onPress={() => {
                    setMenuOpen(false);
                    navigation.navigate("ChecklistsHome");
                  }}
                />
              )}
              {isAuthenticated && FEATURE_FLAGS.portfoliosEnabled && (
                <MenuRow
                  label="Hungry Portfolios"
                  icon={<BarChart3 size={20} color={palette.orange} />}
                  onPressIn={() => preloadRoute(navigation, "PortfoliosHome")}
                  onPress={() => {
                    setMenuOpen(false);
                    navigation.navigate("PortfoliosHome");
                  }}
                />
              )}
              <MenuRow
                label="Review History"
                icon={<PencilLine size={20} color={palette.text} />}
                onPressIn={() => preloadRoute(navigation, "ReviewHistory")}
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate("ReviewHistory");
                }}
              />
              <MenuRow
                label="Settings"
                icon={<Settings size={20} color={palette.text} />}
                onPressIn={() => preloadRoute(navigation, "Settings")}
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate("Settings");
                }}
              />
              {isAuthenticated && (
                <MenuRow
                  label="Sign Out"
                  icon={<LogOut size={20} color={palette.error} />}
                  onPress={() => {
                    setMenuOpen(false);
                    signOut();
                    rootNavigation.reset({
                      index: 0,
                      routes: [{ name: "AuthStack", params: { screen: "Login" } }],
                    });
                  }}
                />
              )}
            </View>
          )}
        </View>
      }
    >
      <View style={{ gap: spacing[1], paddingBottom: spacing[8], position: "relative" }}>
        {menuOpen && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close quick access menu"
            onPress={() => setMenuOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 5,
            }}
          />
        )}
        {/* Profile Header Block */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[4],
            marginBottom: spacing[4],
          }}
        >
          <View style={{ position: "relative" }}>
            <View
              style={[
                shadows.card,
                {
                  alignItems: "center",
                  backgroundColor: palette.orangeLight,
                  borderRadius: radii.pill,
                  height: spacing[20],
                  justifyContent: "center",
                  width: spacing[20],
                  borderWidth: 2,
                  borderColor: palette.surface,
                },
              ]}
            >
              {profile.avatarUrl ? (
                <AccessibleImage
                  source={{ uri: profile.avatarUrl }}
                  accessibilityLabel={`${profile.displayName} profile photo`}
                  style={{
                    borderRadius: radii.pill,
                    height: avatarSize,
                    width: avatarSize,
                  }}
                  contentFit="cover"
                />
              ) : (
                <AppText variant="h1" style={{ color: palette.orange }}>
                  {avatarInitials}
                </AppText>
              )}
            </View>
            {isAuthenticated && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit profile photo"
                accessibilityHint="Opens profile editing"
                onPressIn={() => preloadRoute(navigation, "EditProfile")}
                onPress={() => navigation.navigate("EditProfile")}
                style={{
                  position: "absolute",
                  bottom: -spacing[0.5],
                  right: -spacing[0.5],
                  backgroundColor: palette.orange,
                  width: spacing[6] + spacing[1],
                  height: spacing[6] + spacing[1],
                  borderRadius: radii.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: palette.surface,
                }}
              >
                <Edit2 color={palette.white} size={14} />
              </Pressable>
            )}
          </View>

          <View style={{ flex: 1, gap: spacing[1] }}>
            <AppText
              variant="h1"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              style={{ color: palette.text }}
            >
              {isAuthenticated ? profile.displayName : "Guest User"}
            </AppText>
          </View>
        </View>

        <View style={{ gap: spacing[4] }}>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <StatBlock
              label="Followers"
              value={profileFollowerCount ?? "—"}
              icon={<Heart size={14} color={palette.orange} />}
              onPress={() =>
                openProfileConnections("Followers", {
                  userId: profile.id,
                  userDisplayName: profile.displayName,
                })
              }
            />
            <StatBlock
              label="Following"
              value={profileFollowingCount ?? "—"}
              icon={<Send size={14} color={palette.orange} />}
              onPress={() =>
                openProfileConnections("Following", {
                  userId: profile.id,
                  userDisplayName: profile.displayName,
                })
              }
            />
          </View>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <StatBlock
              label="Reviews"
              value={profile.stats.dishesReviewed}
              icon={<PencilLine size={14} color={palette.orange} />}
              onPressIn={() =>
                !isOtherUserProfile ? preloadRoute(navigation, "ReviewHistory") : undefined
              }
              onPress={handleReviewsCardPress}
            />
            <StatBlock
              label="Stalls"
              value={profile.stats.stallsVisited}
              icon={<Utensils size={14} color={palette.orange} />}
              onPressIn={() => preloadRoute(navigation, "VisitedStalls")}
              onPress={() => navigation.navigate("VisitedStalls")}
            />
            {!isOtherUserProfile ? (
              <StatBlock
                label="Saved"
                value={profileStatSummary.saved}
                icon={<Bookmark size={14} color={palette.orange} />}
                onPressIn={() => preloadRoute(navigation, "Favourites")}
                onPress={() => navigation.navigate("Favourites")}
              />
            ) : null}
          </View>
          {isAuthenticated && gamificationEnabled ? (
            <>
              <PassportCard
                onPressIn={() => preloadRoute(rootNavigation, "PassportScreen")}
                onPress={() => rootNavigation.navigate("PassportScreen")}
              />
              <MissionBanner onPress={() => navigation.navigate("MissionsScreen" as any)} />
            </>
          ) : null}
          <StallContributionCard
            submissionCount={stallSubmissions.length}
            menuSubmissionCount={
              stallSubmissions.filter((submission) => submission.menuItems.length > 0).length
            }
            onPressIn={() => preloadRoute(navigation, "AddStall")}
            onPress={() => navigation.navigate("AddStall")}
          />
          {stallSubmissions.slice(0, 3).map((submission) => (
            <Card key={submission.id}>
              <AppText variant="bodyBold">{submission.stallName}</AppText>
              <AppText tone="muted">
                {submission.status} · {new Date(submission.createdAt).toLocaleDateString()}
              </AppText>
            </Card>
          ))}
          {/* Taste Fingerprint Section */}
          <View style={{ gap: spacing[4], marginTop: spacing[4] }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: spacing[1],
              }}
            >
              <AppText variant="h2">Taste Fingerprint</AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share Taste Fingerprint"
                accessibilityHint="Opens sharing options for your Taste Fingerprint"
                onPress={handleShareTaste}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Send size={16} color={palette.orange} />
                <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                  SHARE
                </AppText>
              </Pressable>
            </View>

            <View
              style={[
                shadows.card,
                {
                  backgroundColor: palette.surface,
                  borderRadius: componentRadii.card,
                  padding: spacing[5],
                  borderWidth: 1,
                  borderColor: palette.border,
                  gap: spacing[4],
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                }}
              >
                <View
                  style={{
                    backgroundColor: palette.orangeLight,
                    width: 40,
                    height: 40,
                    borderRadius: radii.pill,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BarChart3 size={20} color={palette.orange} />
                </View>
              </View>

              <View style={{ gap: spacing[2] }}>
                {TASTE_DIMENSIONS.map((dimension) => (
                  <TasteBar
                    key={dimension.key}
                    label={dimension.label}
                    value={profile.tasteVector[dimension.key]}
                    max={10}
                    color={tasteBarColors[dimension.key]}
                  />
                ))}
              </View>
            </View>
          </View>
          <View style={{ gap: spacing[4], marginTop: spacing[5] }}>
            <AppText variant="h2">Posts</AppText>
            <View
              style={{
                alignSelf: "stretch",
                flexDirection: "row",
                borderWidth: 1,
                borderRadius: radii.pill,
                borderColor: palette.border,
                backgroundColor: palette.surface,
                overflow: "hidden",
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show profile posts"
                accessibilityState={{ selected: activeShareTab === "posts" }}
                onPress={() => setActiveShareTab("posts")}
                style={{
                  flex: 1,
                  paddingVertical: spacing[2],
                  alignItems: "center",
                  backgroundColor: activeShareTab === "posts" ? palette.orange : "transparent",
                }}
              >
                <AppText
                  style={{
                    fontWeight: activeShareTab === "posts" ? 700 : 500,
                    color: activeShareTab === "posts" ? palette.textOnOrange : palette.text,
                  }}
                >
                  Posts
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Show profile ${resolvedReviewSignalLabel.toLowerCase()}`}
                accessibilityState={{ selected: activeShareTab === "reviews" }}
                onPress={() => setActiveShareTab("reviews")}
                style={{
                  flex: 1,
                  paddingVertical: spacing[2],
                  alignItems: "center",
                  backgroundColor: activeShareTab === "reviews" ? palette.orange : "transparent",
                }}
              >
                <AppText
                  style={{
                    fontWeight: activeShareTab === "reviews" ? 700 : 500,
                    color: activeShareTab === "reviews" ? palette.textOnOrange : palette.text,
                  }}
                >
                  {resolvedReviewSignalLabel}
                </AppText>
              </Pressable>
            </View>
            {activeShareTab === "posts" ? (
              sortedProfilePosts.length ? (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    marginHorizontal: -spacing[4],
                  }}
                >
                  {sortedProfilePosts.map((post) => (
                    <Pressable
                      key={post.id}
                      aria-label={`Open post ${post.caption || post.id}`}
                      accessibilityLabel={`Open post ${post.caption || post.id}`}
                      accessibilityRole="button"
                      role="button"
                      testID={`profile-post-tile-${post.id}`}
                      style={{
                        width: "33.333%",
                        aspectRatio: 1,
                      }}
                      onPress={() =>
                        rootNavigation.navigate("ActivityPostDetail", {
                          postId: post.id,
                        })
                      }
                    >
                      <View style={{ flex: 1 }}>
                        <AccessibleImage
                          decorative
                          source={{ uri: post.mediaUrl }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <EmptyState
                  title="No posts yet"
                  body="Published posts will appear here."
                  icon={<MessageCircleMore size={36} color={palette.textSecondary} />}
                />
              )
            ) : sharedReviews.length ? (
              <View style={{ gap: spacing[3] }}>
                {sharedReviews.map((item) => (
                  <Card key={item.id} style={{ gap: spacing[3] }}>
                    <View style={{ gap: spacing[1] }}>
                      <AppText variant="bodyBold">{item.title}</AppText>
                    </View>
                  </Card>
                ))}
              </View>
            ) : (
              <EmptyState
                title="No reviews yet"
                body="Reviews will appear here after they are published."
                icon={<MessageCircleMore size={36} color={palette.textSecondary} />}
              />
            )}
          </View>
        </View>

        <BottomSheetModal
          ref={shareSheetRef}
          snapPoints={shareSnapPoints}
          index={0}
          enablePanDownToClose
          accessibilityLabel="Share taste fingerprint"
          accessibilityViewIsModal
          onDismiss={resetShareSheet}
          backdropComponent={(props) => (
            <BottomSheetBackdrop
              {...props}
              appearsOnIndex={0}
              disappearsOnIndex={-1}
              opacity={0.4}
              pressBehavior="close"
              accessibilityRole="button"
              accessibilityLabel="Close share sheet"
              accessibilityHint="Dismisses the taste fingerprint sharing sheet"
            />
          )}
          backgroundStyle={{ backgroundColor: palette.surface }}
          handleIndicatorStyle={{ backgroundColor: palette.border }}
          footerComponent={
            directMessagesEnabled
              ? (props) => (
                  <BottomSheetFooter {...props}>
                    <FloatingShareSendButton
                      selectedCount={selectedShareChatIds.length}
                      onPress={sendTasteProfileToHungryUsers}
                      bottomInset={insets.bottom}
                      accessibilityLabel="Send shared taste profile"
                      placement="inline"
                    />
                  </BottomSheetFooter>
                )
              : undefined
          }
        >
          <BottomSheetView style={{ flex: 1 }}>
            <BottomSheetScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                gap: spacing[3],
                padding: spacing[4],
                paddingBottom: insets.bottom + spacing[12],
              }}
            >
              <InAppShareCard
                title={
                  directMessagesEnabled ? "Share taste fingerprint" : "Share taste fingerprint link"
                }
                quickActions={[
                  {
                    key: "copy",
                    label: "Copy taste summary",
                    accessibilityLabel: "Copy taste fingerprint link",
                    icon: ({ color, size }) => <Copy color={color} size={size} />,
                    onPress: copyTasteFingerprintLink,
                  },
                  {
                    key: "share",
                    label: "Share",
                    accessibilityLabel: "Share taste fingerprint to another app",
                    icon: ({ color, size }) => <Share2 color={color} size={size} />,
                    onPress: () => void shareTasteProfileOutsideApp(),
                  },
                ]}
                recipients={directMessagesEnabled ? shareRecipients : []}
                selectedRecipientIds={selectedShareChatIds}
                onToggleRecipient={toggleShareChat}
                onSend={sendTasteProfileToHungryUsers}
                lastRecipientId={
                  directMessagesEnabled
                    ? shareRecipients[shareRecipients.length - 1]?.id
                    : undefined
                }
                recipientAccessibilityLabelPrefix="Share taste profile to"
              />
            </BottomSheetScrollView>
          </BottomSheetView>
        </BottomSheetModal>
      </View>
    </ProfileScreenShell>
  );
}

function StallContributionCard({
  submissionCount,
  menuSubmissionCount,
  onPressIn,
  onPress,
}: {
  submissionCount: number;
  menuSubmissionCount: number;
  onPressIn?: () => void;
  onPress: () => void;
}) {
  const { componentRadii, palette, shadows, spacing } = useHungryTheme();
  const nextScoutTarget = submissionCount >= 5 ? 10 : 5;
  const scoutProgress = Math.min(submissionCount, nextScoutTarget);

  return (
    <Pressable
      accessibilityRole="button"
      onPressIn={onPressIn}
      onPress={onPress}
      accessibilityLabel="Add a stall you discovered online"
      accessibilityHint="Opens the stall contribution form"
      style={{
        ...shadows.card,
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        gap: spacing[4],
        padding: spacing[4],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: palette.orangeLight,
            borderRadius: componentRadii.iconButton,
            height: 44,
            justifyContent: "center",
            width: 44,
          }}
        >
          <ImagePlus color={palette.orange} size={22} />
        </View>
        <View style={{ flex: 1, gap: spacing[0.5] }}>
          <AppText variant="h3">Add stalls from online finds</AppText>
          <AppText variant="bodySmall" tone="muted">
            Submit a stall name, image, menu notes, hours, and source link for review.
          </AppText>
        </View>
        <ChevronRight color={palette.textMuted} size={18} />
      </View>

      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        <ScoutMetric
          icon={<Store size={14} color={palette.orange} />}
          label="Submitted"
          value={submissionCount}
        />
        <ScoutMetric
          icon={<Utensils size={14} color={palette.orange} />}
          label="With menu"
          value={menuSubmissionCount}
        />
        <ScoutMetric
          icon={<Trophy size={14} color={palette.orange} />}
          label="Scout"
          value={`${scoutProgress}/${nextScoutTarget}`}
        />
      </View>
    </Pressable>
  );
}

function ScoutMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  return (
    <View
      style={{
        backgroundColor: palette.bgSoft,
        borderRadius: radii.lg,
        flex: 1,
        gap: spacing[1],
        padding: spacing[3],
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
        {icon}
        <AppText variant="bodySmallBold">{value}</AppText>
      </View>
      <AppText variant="micro" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

function TasteBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const { palette, spacing, radii } = useHungryTheme();
  const width = `${(value / max) * 100}%` as any;

  return (
    <View style={{ gap: spacing[1] }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <AppText variant="micro" style={{ fontWeight: "700" }}>
          {label}
        </AppText>
        <AppText variant="micro" tone="secondary">
          {value.toFixed(1)}
        </AppText>
      </View>
      <View
        style={{
          height: 6,
          backgroundColor: palette.border,
          borderRadius: radii.pill,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width,
            backgroundColor: color,
            borderRadius: radii.pill,
          }}
        />
      </View>
    </View>
  );
}

function StatBlock({
  label,
  value,
  icon,
  onPressIn,
  onPress,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  onPressIn?: () => void;
  onPress?: () => void;
}) {
  const { colorScheme, componentRadii, palette, spacing } = useHungryTheme();

  const row = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
        {icon}
        <AppText variant="h3" style={{ color: palette.text }}>
          {value}
        </AppText>
      </View>
      <AppText
        variant="micro"
        tone="secondary"
        style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        {label}
      </AppText>
    </>
  );

  const baseStyle = {
    backgroundColor: colorScheme === "dark" ? palette.surfaceRaised : palette.bgSoft,
    borderRadius: componentRadii.card,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    alignItems: "center" as const,
    flex: 1,
    gap: spacing[1],
  };

  if (!onPress) {
    return <View style={baseStyle}>{row}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      onPressIn={onPressIn}
      onPress={onPress}
      style={({ pressed }) => {
        const pressedStyle =
          pressed &&
          (colorScheme === "dark"
            ? { backgroundColor: palette.surface }
            : { backgroundColor: palette.bgSoft, opacity: 0.92 });
        return [baseStyle, pressedStyle];
      }}
    >
      {row}
    </Pressable>
  );
}

function MenuRow({
  label,
  icon,
  onPressIn,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPressIn?: () => void;
  onPress: () => void;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={onPressIn}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
          backgroundColor: pressed ? palette.bgSoft : palette.surface,
          borderRadius: componentRadii.button,
          padding: spacing[4],
          gap: spacing[3],
          borderWidth: 1,
          borderColor: palette.border,
        },
      ]}
    >
      {icon}
      <AppText
        numberOfLines={1}
        style={{ flex: 1, minWidth: 0, fontWeight: "600", color: palette.text }}
      >
        {label}
      </AppText>
      <ChevronRight color={palette.textMuted} size={18} />
    </Pressable>
  );
}
