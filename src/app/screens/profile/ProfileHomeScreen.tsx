import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Clipboard, Pressable, Share, View } from "react-native";
import { Image } from "expo-image";
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
} from "lucide-react-native";

import { AppText, Card, Button, EmptyState } from "@/components/ui";
import { FloatingShareSendButton, InAppShareCard } from "@/components/social";
import { FoodCredBadge } from "@/components/gamification/FoodCredBadge";
import { MissionBanner } from "@/components/gamification/MissionBanner";
import { toChatShareRecipient, type ChatShareRecipient } from "@/features/home/chatShare";
import { prefetchMerchantTab, preloadRoute } from "@/features/navigation/prefetch";
import { listSharedStallPosts } from "@/features/social/sharedStallPosts";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { useStoryStore } from "@/store/useStoryStore";
import { useSocialStore } from "@/store/useSocialStore";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import { ProfileScreenShell } from "./ProfileScreenShell";
import { useMerchantStore } from "@/store/useMerchantStore";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useActivityStore } from "@/store/useActivityStore";
import { useFoodCredStore } from "@/store/useFoodCredStore";
import { useMissionStore } from "@/store/useMissionStore";
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
  };
};

type ProfileHomeProps = {
  navigation: any;
  route?: ProfileRouteParams;
  mode?: "self" | "other";
  authorName?: string;
  authorAvatarUrl?: string;
};

export function ProfileHomeScreen({
  navigation,
  route,
  mode = "self",
  authorName,
  authorAvatarUrl,
}: ProfileHomeProps) {
  const viewerAuthorName = mode === "other" ? (authorName ?? route?.params?.authorName) : undefined;
  const viewerAuthorAvatarUrl =
    mode === "other" ? (authorAvatarUrl ?? route?.params?.authorAvatarUrl) : undefined;

  const { colorScheme, palette, spacing, radii, shadows } = useHungryTheme();
  const headerActionSize = spacing[8] + spacing[2.5];
  const profile = useProfileStore((state) => state.profile);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const signOut = useSessionStore((state) => state.signOut);
  const merchantAccount = useMerchantStore((state) => state.account);
  const followedAuthors = useSocialStore((state) => state.followedAuthors);
  const publishedPosts = usePublishedPostStore((state) => state.posts);
  const socialInteractions = useSocialStore((state) => state.interactions);
  const reviewEntries = useProfileStore((state) => state.reviewEntries);
  const sharePostToChat = useActivityStore((state) => state.sharePostToChat);
  const { loadStories } = useStoryStore();
  const loadCredProfile = useFoodCredStore((s) => s.loadCredProfile);
  const loadMissions = useMissionStore((s) => s.loadMissions);
  const insets = useSafeAreaInsets();
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const shareSnapPoints = useMemo(() => ["45%"], []);
  const [selectedShareChatIds, setSelectedShareChatIds] = useState<string[]>([]);
  const [shareRecipients, setShareRecipients] = useState<ChatShareRecipient[]>([]);
  const directMessagesEnabled = FEATURE_FLAGS.directMessagesEnabled;
  const [isTasteShareSheetOpen, setIsTasteShareSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profilePosts, setProfilePosts] = useState<StallPost[]>([]);
  const [activeShareTab, setActiveShareTab] = useState<"posts" | "reviews">("posts");

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

  const rootNavigation = getRootNavigation(navigation as any);
  const prefetchMerchantDashboard = useCallback(() => {
    const outlet = merchantAccount?.outlets[0];
    prefetchMerchantTab("Dashboard", outlet?.id, merchantAccount?.id);
    preloadRoute(rootNavigation, "MerchantTabs");
  }, [merchantAccount, rootNavigation]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadStories();
      void loadCredProfile(profile.id);
      void loadMissions(profile.id);
    }
  }, [isAuthenticated, loadStories, loadCredProfile, loadMissions, profile.id]);

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
        setProfilePosts(
          posts.filter(
            (post) =>
              post.authorId === profile.id ||
              post.authorName.toLowerCase() === profile.displayName.toLowerCase(),
          ),
        );
      } catch (error) {
        console.error("Failed to load profile posts:", error);
        if (isMounted) {
          setProfilePosts([]);
        }
      }
    };

    void loadProfilePosts();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, profile.displayName, profile.id, publishedPosts]);

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

  const initials = profile.displayName
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const socialCounts = useMemo(() => {
    const followedCount = Object.values(followedAuthors).filter(Boolean).length;
    const savedPostsCount = Object.values(socialInteractions).filter((item) => item.saved).length;

    return {
      followers: profile.stats.followersCount,
      following: profile.stats.followingCount + followedCount,
      saved: Math.max(0, profile.favouriteDishIds.length + savedPostsCount),
    };
  }, [
    followedAuthors,
    socialInteractions,
    profile.favouriteDishIds.length,
    profile.stats.followersCount,
    profile.stats.followingCount,
  ]);
  const reviewSignalLabel =
    profile.stats.dishesReviewed === 0
      ? "No reviews yet"
      : profile.stats.dishesReviewed === 1
        ? "Updated based on your latest review"
        : `Updated based on ${profile.stats.dishesReviewed} reviews`;

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
      />
    );
  }

  return (
    <ProfileScreenShell
      title="Profile"
      subtitle={isAuthenticated ? undefined : "Join Hungry to save dishes and find your taste."}
      showBack={false}
      testID="profile-home-screen"
      headerRight={
        <View style={{ position: "relative", alignItems: "flex-end" }}>
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
              {isAuthenticated && (
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
            marginBottom: spacing[0.5],
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
              <AppText variant="h1" style={{ color: palette.orange }}>
                {isAuthenticated ? initials : "U"}
              </AppText>
            </View>
            {isAuthenticated && (
              <Pressable
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
            <AppText variant="h1" style={{ color: palette.text }}>
              {isAuthenticated ? profile.displayName : "Guest User"}
            </AppText>
            {isAuthenticated ? (
              <View style={{ flexDirection: "row", gap: spacing[2] }}>
                <AppText variant="body" tone="secondary">
                  {socialCounts.followers} followers
                </AppText>
                <AppText variant="body" tone="secondary">
                  {socialCounts.following} following
                </AppText>
              </View>
            ) : (
              <AppText variant="bodySmall" tone="secondary">
                Sign in to see your culinary journey
              </AppText>
            )}
          </View>

          {isAuthenticated && <FoodCredBadge size="md" style={{ alignSelf: "flex-start" }} />}
        </View>

        {!isAuthenticated ? (
          <Card
            style={{
              gap: spacing[4],
              padding: spacing[5],
              backgroundColor: palette.bgSoft,
              borderColor: palette.orange,
            }}
          >
            <View style={{ gap: spacing[2] }}>
              <AppText variant="h2">Unlock your taste profile</AppText>
              <AppText tone="secondary">
                Save your favorite dishes, review hawker stalls, and build your personalized taste
                fingerprint.
              </AppText>
            </View>
            <Button
              label="Sign In / Create Account"
              onPressIn={() => preloadRoute(rootNavigation, "AuthStack", { screen: "Login" })}
              onPress={() => navigation.navigate("AuthStack" as any, { screen: "Login" })}
            />
          </Card>
        ) : (
          <View style={{ gap: spacing[4] }}>
            <View style={{ flexDirection: "row", gap: spacing[2], marginTop: spacing[2] }}>
              <StatBlock
                label="Followers"
                value={socialCounts.followers}
                icon={<Heart size={14} color={palette.orange} />}
                onPressIn={() => preloadRoute(navigation, "Followers")}
                onPress={() => navigation.navigate("Followers")}
              />
              <StatBlock
                label="Following"
                value={socialCounts.following}
                icon={<Send size={14} color={palette.orange} />}
                onPressIn={() => preloadRoute(navigation, "Following")}
                onPress={() => navigation.navigate("Following")}
              />
            </View>
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              <StatBlock
                label="Reviews"
                value={profile.stats.dishesReviewed}
                icon={<PencilLine size={14} color={palette.orange} />}
                onPressIn={() => preloadRoute(navigation, "ReviewHistory")}
                onPress={() => navigation.navigate("ReviewHistory")}
              />
              <StatBlock
                label="Stalls"
                value={profile.stats.stallsVisited}
                icon={<Utensils size={14} color={palette.orange} />}
                onPressIn={() => preloadRoute(navigation, "VisitedStalls")}
                onPress={() => navigation.navigate("VisitedStalls")}
              />
              <StatBlock
                label="Saved"
                value={socialCounts.saved}
                icon={<Bookmark size={14} color={palette.orange} />}
                onPressIn={() => preloadRoute(navigation, "SocialGrid", { type: "saved" })}
                onPress={() => navigation.navigate("SocialGrid", { type: "saved" })}
              />
            </View>
            {/* Gamification */}
            <MissionBanner onPress={() => navigation.navigate("MissionsScreen" as any)} />
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
                    borderRadius: radii.xl,
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
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyBold">Detailed Analysis</AppText>
                    <AppText variant="micro" tone="secondary">
                      {reviewSignalLabel}
                    </AppText>
                  </View>
                </View>

                <View style={{ gap: spacing[2] }}>
                  <TasteBar
                    label="Spicy"
                    value={profile.tasteVector.spicy}
                    max={10}
                    color={palette.orange}
                  />
                  <TasteBar
                    label="Salty"
                    value={profile.tasteVector.salty}
                    max={10}
                    color={palette.info}
                  />
                  <TasteBar
                    label="Sweet"
                    value={profile.tasteVector.sweet}
                    max={10}
                    color={palette.statusFast}
                  />
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
                      color: activeShareTab === "posts" ? palette.white : palette.text,
                    }}
                  >
                    Posts
                  </AppText>
                </Pressable>
                <Pressable
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
                      color: activeShareTab === "reviews" ? palette.white : palette.text,
                    }}
                  >
                    Reviews
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
                          <Image
                            accessibilityLabel={`Post image ${post.caption || post.id}`}
                            alt={`Post image ${post.caption || post.id}`}
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
                    body="Shared posts will appear here."
                    icon={<MessageCircleMore size={36} color={palette.textSecondary} />}
                  />
                )
              ) : sharedReviews.length ? (
                <View style={{ gap: spacing[3] }}>
                  {sharedReviews.map((item) => (
                    <Card key={item.id} style={{ gap: spacing[3] }}>
                      <View style={{ gap: spacing[1] }}>
                        <AppText variant="bodyBold">{item.title}</AppText>
                        <AppText variant="micro" tone="secondary">
                          {item.subtitle}
                        </AppText>
                        <AppText>{item.text}</AppText>
                      </View>
                      <AppText variant="micro" tone="secondary">
                        Review • {formatTimeAgo(item.createdAt)}
                      </AppText>
                    </Card>
                  ))}
                </View>
              ) : (
                <EmptyState
                  title="No reviews yet"
                  body={"Dish reviews you share will appear here."}
                  icon={<MessageCircleMore size={36} color={palette.textSecondary} />}
                />
              )}
            </View>
          </View>
        )}

        <BottomSheetModal
          ref={shareSheetRef}
          snapPoints={shareSnapPoints}
          index={0}
          enablePanDownToClose
          onDismiss={resetShareSheet}
          backdropComponent={(props) => (
            <BottomSheetBackdrop
              {...props}
              appearsOnIndex={0}
              disappearsOnIndex={-1}
              opacity={0.4}
              pressBehavior="close"
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
                    label: "Copy link",
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
  value: number;
  icon: ReactNode;
  onPressIn?: () => void;
  onPress?: () => void;
}) {
  const { palette, spacing, radii, colorScheme } = useHungryTheme();

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
    borderRadius: radii.lg,
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
  const { palette, spacing, radii } = useHungryTheme();
  return (
    <Pressable
      onPressIn={onPressIn}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
          backgroundColor: pressed ? palette.bgSoft : palette.surface,
          borderRadius: radii.lg,
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
