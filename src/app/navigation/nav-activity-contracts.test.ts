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
  const types = read("src/app/navigation/navigationTypes.ts");

  assert.match(tabs, /import \{ House, Compass, BookOpenText, Plus, User \}/);
  assert.match(
    tabs,
    /key: "Home"[\s\S]*key: "Discover"[\s\S]*key: "Create"[\s\S]*key: "Review"[\s\S]*key: "Profile"/,
  );
  assert.match(tabs, /isCreateAction[\s\S]*navigate\("PostComposerV2"\)/);
  assert.match(tabs, /height: 62 \+ Math\.max\(insets\.bottom, spacing\[2\]\)/);
  assert.match(tabs, /paddingTop: spacing\[2\]/);
  assert.match(tabs, /backgroundColor: palette\.orange[\s\S]*borderRadius: radii\.pill/);
  assert.match(
    tabs,
    /<Icon color=\{isCreateAction \? palette\.white : currentColor\} size=\{26\} \/>/,
  );
  assert.match(
    tabs,
    /\{isCreateAction \? null : \(\s*<AppText[\s\S]*\{item\.label\}[\s\S]*<\/AppText>\s*\)\}/,
  );
  assert.match(tabs, /iconSlot: \{[\s\S]*height: 28[\s\S]*width: 40/);
  assert.match(tabs, /createButton: \{[\s\S]*height: 40[\s\S]*width: 40/);
  assert.doesNotMatch(tabs, /createTabItem/);
  assert.doesNotMatch(tabs, /borderWidth: 4/);
  assert.doesNotMatch(tabs, /<Tab\.Screen name="Create"/);
  assert.doesNotMatch(types, /Rate: undefined/);
  assert.doesNotMatch(types, /Create: undefined/);
});

test("home bell opens a combined activity inbox with messages and updates", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const activity = read("src/app/screens/home/ActivityInboxScreen.tsx");
  const activityData = read("src/features/home/activity.ts");
  const activityStore = read("src/store/useActivityStore.ts");

  assert.match(home, /<Bell color=\{palette\.text\} size=\{22\}/);
  assert.match(home, /navigation\.navigate\("ActivityInbox", \{ initialTab: "updates" \}\)/);
  assert.match(home, /useActivityStore\(\(state\) => state\.getUnreadCount\(\)\)/);
  assert.match(rootNavigator, /component=\{ActivityInboxScreen\} name="ActivityInbox"/);
  assert.match(rootNavigator, /component=\{ActivityPostDetailScreen\} name="ActivityPostDetail"/);
  assert.match(rootNavigator, /component=\{ChatDetailScreen\} name="ChatDetail"/);
  assert.match(activity, /navigation\.navigate\("ActivityPostDetail"/);
  assert.match(activity, /postId: update\.postId/);
  assert.match(activity, /stylesInline\.kindBadge/);
  assert.match(activity, /type ActivityTab = "messages" \| "updates"/);
  assert.match(activity, /const TABS: ActivityTab\[\] = \["messages", "updates"\]/);
  assert.match(activity, /getActivityMessageUnreadCount\(message, readActivityIds\)/);
  assert.match(
    activity,
    /const unreadCount = getActivityMessageUnreadCount\(chat, readActivityIds\)/,
  );
  assert.match(activity, /<UnreadCountBadge/);
  assert.match(activity, /accessibilityLabel=\{`\$\{unreadCount\} unread messages`\}/);
  assert.match(activity, /stylesInline\.unreadCountBadge/);
  assert.match(activity, /markActivityRead\("message", chat\.id\)/);
  assert.match(activity, /markActivityRead\("update", update\.id\)/);
  assert.match(activity, /stylesInline\.updateMediaSlot/);
  assert.match(activity, /stylesInline\.updateUnreadSlot/);
  assert.match(activity, /stylesInline\.unreadDot/);
  assert.match(activity, /updateMediaSlot: \{[\s\S]*flexDirection: "row"[\s\S]*width: 76/);
  assert.match(activity, /updateUnreadSlot: \{[\s\S]*width: 14/);
  assert.match(activityStore, /name: "hungry-activity-v1"/);
  assert.match(activityStore, /readActivityIds/);
  assert.match(activityStore, /sharedPostMessages/);
  assert.match(activityStore, /sharePostToChat/);
  assert.match(activityStore, /getActivityUnreadCount\(get\(\)\.readActivityIds\)/);
  assert.match(activityData, /export type SharedPostPayload/);
  assert.match(activityData, /sharedPost\?: SharedPostPayload/);
  assert.match(activityData, /unreadCount\?: number/);
  assert.match(activityData, /export function getActivityMessageUnreadCount/);
  assert.match(activityData, /total \+ \(message\.unreadCount \?\? 1\)/);
  assert.match(activityData, /ACTIVITY_MESSAGES/);
  assert.match(activityData, /ACTIVITY_CHAT_MESSAGES/);
  assert.match(activityData, /ACTIVITY_UPDATES/);
  assert.match(activityData, /postId: "post-/);
  assert.match(activityData, /kind: "comment"/);
  assert.match(activityData, /kind: "like"/);
  assert.doesNotMatch(activityData, /kind: "share"/);
});

test("activity messages and update posts are functional routes, not static mockups", () => {
  const chat = read("src/app/screens/home/ChatDetailScreen.tsx");
  const detail = read("src/app/screens/home/ActivityPostDetailScreen.tsx");
  const types = read("src/app/navigation/navigationTypes.ts");

  assert.match(types, /ActivityPostDetail: \{ postId: string; updateId\?: string \}/);
  assert.match(chat, /const \[messages, setMessages\]/);
  assert.match(chat, /markActivityRead\("message", chatId\)/);
  assert.match(chat, /ACTIVITY_CHAT_MESSAGES\[chatId\]/);
  assert.match(chat, /sharedPostMessages/);
  assert.match(chat, /msg\.sharedPost/);
  assert.match(chat, /styles\.sharedPostCard/);
  assert.match(
    chat,
    /navigation\.navigate\("ActivityPostDetail", \{ postId: msg\.sharedPost!\.postId \}\)/,
  );
  assert.match(chat, /const sendMessage = \(\) =>/);
  assert.match(chat, /setMessages\(\(current\) => \[\.\.\.current, sentMessage\]\)/);
  assert.match(chat, /setTimeout\(\(\) =>/);
  assert.doesNotMatch(chat, /Phone/);
  assert.doesNotMatch(chat, /Video/);
  assert.doesNotMatch(chat, /Start voice call/);
  assert.doesNotMatch(chat, /Start video call/);
  assert.match(
    detail,
    /type Props = NativeStackScreenProps<RootStackParamList, "ActivityPostDetail">/,
  );
  assert.match(detail, /repository\.listStallPosts\(\)/);
  assert.match(detail, /ACTIVITY_UPDATES\.find/);
  assert.match(detail, /markActivityRead\("update", updateId\)/);
  assert.match(detail, /toggleLike\(post\.id\)/);
  assert.match(detail, /toggleSave\(post\.id\)/);
  assert.match(detail, /navigation\.navigate\("DishDetail"/);
  assert.match(detail, /const \[commentsOpen, setCommentsOpen\] = useState\(false\)/);
  assert.match(detail, /accessibilityLabel="Open comments"/);
  assert.match(detail, /onPress=\{\(\) => setCommentsOpen\(true\)\}/);
  assert.match(detail, /comments\.map\(\(comment\) =>/);
  assert.doesNotMatch(detail, /localCommentCount/);
  assert.doesNotMatch(detail, /setLocalCommentCount/);
  assert.doesNotMatch(detail, /incrementShare\(post\.id\)/);
  assert.doesNotMatch(detail, /interaction\.shareCount > 0/);
});
