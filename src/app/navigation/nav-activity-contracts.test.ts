import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("bottom navigation puts create post in the center and review fourth", () => {
  const tabs = read("src/app/navigation/SwipeableTabNavigator.tsx");
  const tabItem = read("src/components/ui/AppBottomTabItem.tsx");
  const types = read("src/app/navigation/navigationTypes.ts");

  assert.match(tabs, /import \{ House, Compass, BookOpenText, Plus, User \}/);
  assert.match(
    tabs,
    /key: "Home"[\s\S]*key: "Discover"[\s\S]*key: "Create"[\s\S]*key: "Review"[\s\S]*key: "Profile"/,
  );
  assert.match(
    tabs,
    /const composerRoute = FEATURE_FLAGS\.prototypeRoutesEnabled \? "PostComposerV2" : "Post"/,
  );
  assert.match(tabs, /isCreateAction[\s\S]*navigate\("PostComposerV2"\)[\s\S]*navigate\("Post"\)/);
  assert.match(
    tabs,
    /height: componentSizes\.bottomTabBar \+ Math\.max\(insets\.bottom, spacing\[2\]\)/,
  );
  assert.match(tabs, /paddingTop: spacing\[2\]/);
  assert.match(tabItem, /backgroundColor: palette\.orange[\s\S]*borderRadius: radii\.pill/);
  assert.match(
    tabItem,
    /<Icon[\s\S]*color=\{createAction \? palette\.white : resolvedColor\}[\s\S]*size=\{componentSizes\.bottomTabIcon\}[\s\S]*\/>/,
  );
  assert.match(
    tabItem,
    /\{showLabel && !createAction \? \(\s*<AppText[\s\S]*\{label\}[\s\S]*<\/AppText>\s*\) : null\}/,
  );
  assert.match(
    tabItem,
    /height: componentSizes\.bottomTabIconSlotHeight[\s\S]*width: componentSizes\.bottomTabIconSlotWidth/,
  );
  assert.match(
    tabItem,
    /height: componentSizes\.bottomTabCreateButton[\s\S]*width: componentSizes\.bottomTabCreateButton/,
  );
  assert.doesNotMatch(tabs, /createTabItem/);
  assert.doesNotMatch(tabs, /borderWidth: 4/);
  assert.doesNotMatch(tabs, /<Tab\.Screen name="Create"/);
  assert.doesNotMatch(types, /Rate: undefined/);
  assert.doesNotMatch(types, /^\s+Create: undefined;/m);
});

test("home bell opens activity inbox and gates messages by feature flag", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const activity = read("src/app/screens/home/ActivityInboxScreen.tsx");
  const activityData = read("src/features/home/activity.ts");
  const activityStore = read("src/store/useActivityStore.ts");
  const supabaseService = read("src/lib/services/supabase/supabaseService.ts");

  assert.match(home, /<Bell color=\{palette\.text\} size=\{22\}/);
  assert.match(home, /navigation\.navigate\("ActivityInbox", \{ initialTab: "updates" \}\)/);
  assert.match(home, /import \{ getActivityUnreadCount \} from "@\/features\/home\/activity"/);
  assert.match(
    home,
    /const dbActivityEvents = useActivityStore\(\(state\) => state\.dbActivityEvents\)/,
  );
  assert.match(
    home,
    /const fetchActivityEvents = useActivityStore\(\(state\) => state\.fetchActivityEvents\)/,
  );
  assert.match(
    home,
    /serviceProviderMode === "mock"[\s\S]*\? activityUpdates[\s\S]*: \[\.\.\.dbActivityEvents, \.\.\.activityUpdates\]/,
  );
  assert.match(home, /void fetchActivityEvents\(\)/);
  assert.match(home, /getHungryService\(\)[\s\S]*\.chat\.listConversations\(\)/);
  assert.match(home, /if \(!FEATURE_FLAGS\.directMessagesEnabled\)/);
  assert.match(home, /recipients=\{directMessagesEnabled \? shareRecipients : \[\]\}/);
  assert.doesNotMatch(home, /ACTIVITY_MESSAGES/);
  assert.match(rootNavigator, /getComponent=\{loadActivityInboxScreen\} name="ActivityInbox"/);
  assert.match(
    rootNavigator,
    /getComponent=\{loadActivityPostDetailScreen\} name="ActivityPostDetail"/,
  );
  assert.match(rootNavigator, /FEATURE_FLAGS\.directMessagesEnabled \? \(/);
  assert.match(rootNavigator, /getComponent=\{loadChatDetailScreen\} name="ChatDetail"/);
  assert.match(rootNavigator, /getComponent=\{loadDirectMessagesScreen\} name="DirectMessages"/);
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
    /getServiceProvider\(\)\.mode === "mock"[\s\S]*\[\.\.\.ACTIVITY_UPDATES, \.\.\.activityUpdates\][\s\S]*\[\.\.\.dbActivityEvents, \.\.\.activityUpdates\]/,
  );
  assert.match(activity, /visibleUpdates/);
  assert.match(activity, /stylesInline\.kindBadge/);
  assert.match(activity, /type ActivityTab = "messages" \| "updates"/);
  assert.match(
    activity,
    /FEATURE_FLAGS\.directMessagesEnabled\s+\? \["messages", "updates"\]\s+: \["updates"\]/,
  );
  assert.match(activity, /route\.params\?\.initialTab === "messages"/);
  assert.match(activity, /getHungryService\(\)[\s\S]*\.chat[\s\S]*\.listConversations\(\)/);
  assert.match(activity, /type \{ ChatConversation \}/);
  assert.match(activity, /conversation\.unreadCount/);
  assert.match(activity, /void getHungryService\(\)\.chat\.markConversationRead\(chatId\)/);
  assert.match(activity, /<UnreadCountBadge/);
  assert.match(activity, /accessibilityLabel=\{`\$\{unreadCount\} unread messages`\}/);
  assert.match(activity, /stylesInline\.unreadCountBadge/);
  assert.match(activity, /markActivityRead\("update", update\.id\)/);
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
  assert.match(activityStore, /notifications\.listActivityEvents\(\)/);
  assert.match(activityStore, /notifications\.markActivityRead\(id\)/);
  assert.doesNotMatch(activityStore, /console\.error\("Failed to fetch activity events"/);
  assert.match(activityStore, /console\.warn\("Failed to fetch activity events"/);
  assert.match(activityStore, /set\(\{ dbActivityEvents: \[\] \}\)/);
  assert.match(supabaseService, /function isMissingActivityEventsSchemaError/);
  assert.match(supabaseService, /if \(isMissingActivityEventsSchemaError\(error\)\) return \[\]/);
  assert.match(supabaseService, /if \(isMissingMarkActivityReadRpcError\(error\)\) return/);
  assert.match(activityData, /export type SharedPostPayload/);
  assert.match(activityData, /sharedPost\?: SharedPostPayload/);
  assert.match(activityData, /unreadCount\?: number/);
  assert.match(activityData, /export function getActivityMessageUnreadCount/);
  assert.match(activityData, /message\.unreadCount \?\? 1/);
  assert.match(activityData, /ACTIVITY_MESSAGES/);
  assert.match(activityData, /ACTIVITY_UPDATES/);
  assert.match(activityData, /postId: "post-/);
  assert.match(activityData, /kind: "comment"/);
  assert.match(activityData, /kind: "like"/);
  assert.match(activityData, /ActivityUpdateKind[\s\S]*share/);
});

test("activity messages and update posts are functional routes, not static mockups", () => {
  const chat = read("src/app/screens/home/ChatDetailScreen.tsx");
  const detail = read("src/app/screens/home/ActivityPostDetailScreen.tsx");
  const types = read("src/app/navigation/navigationTypes.ts");

  assert.match(types, /ActivityPostDetail: \{ postId: string; updateId\?: string \}/);
  assert.match(chat, /getHungryService\(\)\.chat/);
  assert.match(chat, /\.listMessages\(chatId\)/);
  assert.match(chat, /\.markConversationRead\(chatId\)/);
  assert.match(chat, /\.subscribeToConversation\(chatId/);
  assert.match(chat, /\.sendMessage\(\{/);
  assert.match(chat, /Text messages only for now/);
  assert.doesNotMatch(chat, /ACTIVITY_CHAT_MESSAGES/);
  assert.doesNotMatch(chat, /sharedPostMessages/);
  assert.doesNotMatch(chat, /setTimeout\(\(\) =>/);
  assert.doesNotMatch(chat, /ImagePicker/);
  assert.doesNotMatch(chat, /Paperclip/);
  assert.doesNotMatch(chat, /Phone/);
  assert.doesNotMatch(chat, /Start voice call/);
  assert.doesNotMatch(chat, /Start video call/);
  assert.match(
    detail,
    /type Props = NativeStackScreenProps<RootStackParamList, "ActivityPostDetail">/,
  );
  assert.match(detail, /listSharedStallPostsSync\(repository\)/);
  assert.match(detail, /ACTIVITY_UPDATES\.find/);
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
  assert.match(detail, /accessibilityLabel="Open comments"/);
  assert.match(detail, /seededCommentsForActiveReview/);
  assert.match(detail, /likeCount: 0/);
  assert.match(detail, /commentCount: 0/);
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
