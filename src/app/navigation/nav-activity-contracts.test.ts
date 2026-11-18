import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withEnglishCopy } from "@/test/englishCopy";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return withEnglishCopy(readFileSync(path.join(root, relativePath), "utf8"));
}

test("Release 0.1 bottom navigation gates social, post, and review actions", () => {
  const tabs = read("src/app/navigation/SwipeableTabNavigator.tsx");
  const tabItem = read("src/components/ui/AppBottomTabItem.tsx");
  const types = read("src/app/navigation/navigationTypes.ts");

  assert.match(tabs, /import \{ BookOpenText, House, PenLine, User \}/);
  // Discover is the home page (labelled Home) and the round middle button writes a review.
  assert.match(
    tabs,
    /key: "Discover",\s*route: routeByName\.get\("Discover"\),\s*icon: House,[\s\S]*?label: "Home"[\s\S]*FEATURE_FLAGS\.reviewCreationEnabled[\s\S]*key: "Create",\s*isCreateAction: true,\s*icon: PenLine,[\s\S]*?label: "Post"[\s\S]*key: "Review"[\s\S]*key: "Profile"/,
  );
  // iOS draws SF Symbols in the tab bar, outline at rest and filled while selected.
  assert.match(tabs, /symbol: "house",\s*focusedSymbol: "house\.fill"/);
  assert.match(tabs, /symbol: "book",\s*focusedSymbol: "book\.fill"/);
  assert.match(tabs, /symbol: "person",\s*focusedSymbol: "person\.fill"/);
  assert.match(tabs, /symbol=\{item\.symbol\}\s*focusedSymbol=\{item\.focusedSymbol\}/);
  assert.match(
    tabs,
    /isCreateAction[\s\S]*rootNavigation\?\.navigate\("ReviewStack", \{ screen: "ReviewMain" \}\)/,
  );
  assert.match(tabs, /initialRouteName="Discover"/);
  assert.doesNotMatch(tabs, /PostComposerV2/);
  assert.match(
    tabs,
    /height: componentSizes\.bottomTabBar \+ tabBarBottomPadding\(insets\.bottom, spacing\[2\]\)/,
  );
  assert.match(tabs, /paddingTop: spacing\[2\]/);
  // The write button looks like every other tab: same glyph size, slot and colours, and a label.
  assert.doesNotMatch(tabItem, /backgroundColor: palette\.orange/);
  assert.match(tabItem, /<Icon color=\{iconColor\} size=\{componentSizes\.bottomTabIcon\} \/>/);
  assert.doesNotMatch(tabItem, /bottomTabCreateButton|bottomTabIcon \+/);
  // Selected tabs use an orange outline icon, never a filled one.
  assert.match(tabItem, /focused \? palette\.orange : palette\.textMuted/);
  assert.doesNotMatch(tabItem, /fill=/);
  // Active tab stays highlighted (no fade-out timer) and is exposed as a selected tab.
  assert.doesNotMatch(tabs, /highlightVisible|setTimeout/);
  assert.match(tabs, /accessibilityRole="tablist"/);
  assert.match(tabItem, /accessibilityRole=\{createAction \? "button" : "tab"\}/);
  assert.match(tabItem, /accessibilityState=\{createAction \? \{\} : \{ selected: focused \}\}/);
  assert.match(tabItem, /focused \? palette\.orangeText : palette\.textMuted/);
  // Merchant tabs pass their own colour; it must use the same accessible token.
  assert.match(
    read("src/app/navigation/MerchantTabs.tsx"),
    /isFocused \? palette\.orangeText : palette\.textMuted/,
  );
  assert.match(
    tabItem,
    /\{showLabel \? \(\s*<AppText[\s\S]*\{label\}[\s\S]*<\/AppText>\s*\) : null\}/,
  );
  assert.match(
    tabItem,
    /height: componentSizes\.bottomTabIconSlotHeight[\s\S]*width: componentSizes\.bottomTabIconSlotWidth/,
  );
  assert.doesNotMatch(tabs, /createTabItem/);
  assert.doesNotMatch(tabs, /borderWidth: 4/);
  // The Post page sits in the swipe order (reached by the edge swipe); the bar button still opens
  // the review card, so the bar never navigates to it.
  assert.match(tabs, /<Tab\.Screen name="Create"/);
  assert.doesNotMatch(types, /Rate: undefined/);
  assert.match(types, /^\s+Create: undefined;/m);
});

test("activity routes remain feature-gated and the inbox has no messages tab", () => {
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const activity = read("src/app/screens/home/ActivityInboxScreen.tsx");
  const activityData = read("src/features/home/activity.ts");
  const activityStore = read("src/store/useActivityStore.ts");
  const supabaseService = read("src/lib/services/supabase/supabaseService.ts");

  assert.match(activity, /isActivityUpdateForViewer\(update, userId\)/);
  assert.match(
    rootNavigator,
    /FEATURE_FLAGS\.activityEnabled \? \([\s\S]*getComponent=\{loadActivityInboxScreen\} name="ActivityInbox"/,
  );
  assert.match(
    rootNavigator,
    /getComponent=\{loadActivityPostDetailScreen\}\s*name="ActivityPostDetail"/,
  );
  assert.match(activity, /navigation\.navigate\("ActivityPostDetail"/);
  assert.match(activity, /postId: update\.postId/);
  assert.match(
    activity,
    /const dbActivityEvents = useActivityStore\(\(state\) => state\.dbActivityEvents\)/,
  );
  assert.match(
    activity,
    /const fetchActivityEvents = useActivityStore\(\(state\) => state\.fetchActivityEvents\)/,
  );
  assert.match(
    activity,
    /selectActivitySourceUpdates\(\s*getServiceProvider\(\)\.mode,\s*dbActivityEvents,\s*activityUpdates,\s*\)/,
  );
  assert.match(
    activityData,
    /mode === "mock"\s*\? \[\.\.\.ACTIVITY_UPDATES, \.\.\.localActivityUpdates\]\s*: \[\.\.\.dbActivityEvents, \.\.\.localActivityUpdates\]/,
  );
  assert.match(activity, /visibleUpdates/);
  assert.match(activity, /stylesInline\.kindBadge/);
  assert.doesNotMatch(activity, /\.chat\b|ChatDetail|MessagesTab|directMessagesEnabled/);
  assert.match(activity, /markActivityRead\("update", memberId\)/);
  assert.match(activity, /stylesInline\.updateMediaSlot/);
  assert.match(activity, /stylesInline\.updateUnreadSlot/);
  assert.match(activity, /stylesInline\.unreadDot/);
  assert.match(activity, /updateMediaSlot: \{[\s\S]*flexDirection: "row"[\s\S]*width: 76/);
  assert.match(activity, /updateUnreadSlot: \{[\s\S]*width: 14/);
  assert.match(activityStore, /name: "hungry-activity-v1"/);
  assert.match(activityStore, /readActivityIds/);
  assert.match(activityStore, /dbActivityEvents/);
  assert.match(activityStore, /fetchActivityEvents: \(\) => Promise<void>/);
  assert.match(
    activityStore,
    /getActivityUnreadCount\(get\(\)\.readActivityIds, \[[\s\S]*\.\.\.get\(\)\.dbActivityEvents,[\s\S]*\.\.\.get\(\)\.activityUpdates/,
  );
  assert.match(activityStore, /notifications\.listActivityEvents\(/);
  assert.match(activityStore, /notifications\.markActivityRead\(id\)/);
  assert.doesNotMatch(activityStore, /console\.error\("Failed to fetch activity events"/);
  assert.match(activityStore, /console\.warn\("Failed to fetch activity events"/);
  // A failed fetch keeps the last list and flags the error; it never shows as "No updates yet".
  assert.doesNotMatch(activityStore, /set\(\{ dbActivityEvents: \[\] \}\)/);
  assert.match(activityStore, /activityLoadFailed: true/);
  assert.match(supabaseService, /function isMissingActivityEventsSchemaError/);
  assert.match(supabaseService, /if \(isMissingActivityEventsSchemaError\(error\)\) return \[\]/);
  assert.match(supabaseService, /if \(isMissingMarkActivityReadRpcError\(error\)\) return/);
  assert.match(activityData, /ACTIVITY_UPDATES/);
  assert.match(activityData, /postId: "post-/);
  assert.match(activityData, /kind: "comment"/);
  assert.match(activityData, /kind: "like"/);
  assert.match(activityData, /ActivityUpdateKind[\s\S]*share/);
});

test("activity update posts are functional routes, not static mockups", () => {
  const detail = read("src/app/screens/home/ActivityPostDetailScreen.tsx");
  const types = read("src/app/navigation/navigationTypes.ts");

  assert.match(types, /ActivityPostDetail: \{ postId: string; updateId\?: string \}/);
  assert.match(
    detail,
    /type Props = NativeStackScreenProps<RootStackParamList, "ActivityPostDetail">/,
  );
  assert.match(detail, /listSharedStallPostsSync\(repository\)/);
  // Sample updates only in mock mode; the post itself is fetched by id.
  assert.match(detail, /getServiceProvider\(\)\.mode === "mock" \? ACTIVITY_UPDATES : \[\]/);
  assert.match(detail, /social\.getPostById\(postId\)/);
  assert.match(detail, /title="This post is no longer available"/);
  assert.match(detail, /if \(requireSignIn\(\)\) void toggleLike\(post\.id\)/);
  // Visitors: comments and the safety menu need sign-in; share is link-only.
  assert.match(detail, /if \(!requireSignIn\(\)\) return;\s*setActiveCommentReview/);
  assert.match(detail, /requireSignIn\(\) &&\s*promptPostSafetyActions/);
  assert.match(detail, /if \(isAuthenticated\) incrementShare\(postId, channel\)/);
  assert.match(
    read("src/lib/services/supabase/supabaseService.ts"),
    /async getPostById\(postId\) \{[^}]*if \(!UUID_PATTERN\.test\(postId\)\) return null;/,
  );
  assert.match(detail, /dbActivityEvents\.find/);
  assert.match(detail, /void fetchActivityEvents\(\)/);
  assert.match(detail, /markActivityRead\("update", updateId\)/);
  assert.match(detail, /toggleLike\(post\.id\)/);
  assert.match(detail, /toggleSave\(post\.id\)/);
  assert.match(detail, /navigation\.navigate\("DishDetail"/);
  assert.match(detail, /ReviewCommentsSheet/);
  assert.match(detail, /const commentsEnabled = FEATURE_FLAGS\.commentsEnabled/);
  assert.match(detail, /\{commentsEnabled \? \(/);
  assert.match(detail, /commentsSheetRef\.current\?\.present\(\)/);
  assert.match(detail, /setActiveCommentReview/);
  // The detail screen reuses the Home feed card (its comment button opens the sheet).
  assert.match(detail, /<FeedPostCard/);
  assert.match(detail, /openComments: \(\) => \{/);
  assert.match(detail, /seededCommentsForActiveReview/);
  assert.match(read("src/components/social/FeedPostCard.tsx"), /likeCount: 0/);
  assert.match(read("src/components/social/FeedPostCard.tsx"), /commentCount: 0/);
  assert.match(detail, /ReviewShareSheet/);
  assert.match(detail, /onShared=\{\(postId, channel\) => \{/);
  assert.match(detail, /incrementShare\(postId, channel\)/);
  assert.doesNotMatch(detail, /likeCount: primaryDish\?\.reviews\.length/);
  assert.doesNotMatch(detail, /commentCount: primaryDish\?\.reviews\.length/);
  assert.doesNotMatch(detail, /localCommentCount/);
  assert.doesNotMatch(detail, /setLocalCommentCount/);
  assert.doesNotMatch(detail, /incrementShare\(post\.id\)/);
  assert.doesNotMatch(detail, /interaction\.shareCount > 0/);
});
