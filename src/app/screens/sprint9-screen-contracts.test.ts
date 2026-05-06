import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Sprint 9 screen contract: Login screen uses service auth + error boundary", () => {
  const source = read("src/app/screens/auth/LoginScreen.tsx");

  assert.match(source, /getHungryService\(\)\.auth\.signIn\(/);
  assert.match(source, /getHungryService\(\)\.auth\.signInWithGoogle\(/);
  assert.match(source, /getHungryService\(\)\.auth\.signInWithApple\(/);
  assert.match(source, /<FeedErrorBoundary/);
});

test("Sprint 9 screen contract: Review screen submits via service and triggers success UI", () => {
  const source = read("src/app/screens/review/ReviewScreen.tsx");

  assert.match(source, /getHungryService\(\)\.reviews\.submitReview\(/);
  assert.match(source, /showReviewSuccess\(/);
  assert.match(source, /showToast\(\{ message: "Review posted!"/);
  assert.match(source, /<FeedErrorBoundary/);
});

test("Sprint 9 screen contract: Home feed interactions are wired for like/save/comment/share", () => {
  const source = read("src/app/screens/home/HomeFeedScreen.tsx");
  const feedSource = read("src/features/home/feed.ts");
  const mapSource = read("src/app/screens/discover/HomeMapScreen.tsx");

  assert.match(feedSource, /dataRepositoryMock as fallbackRepository/);
  assert.match(feedSource, /fallbackRepository\.listStallPosts\(\)/);
  assert.match(
    feedSource,
    /repository\.getVenueById\(post\.venueId\) \?\? fallbackRepository\.getVenueById\(post\.venueId\)/,
  );
  assert.match(
    feedSource,
    /repository\.getDishById\(dishId\) \?\? fallbackRepository\.getDishById\(dishId\)/,
  );
  assert.match(source, /useSocialStore/);
  assert.match(source, /togglePostLike/);
  assert.match(source, /togglePostSave/);
  assert.match(source, /addPostComment/);
  assert.match(source, /addPostReply/);
  assert.match(source, /initializeInteractions\(\[\.\.\.socialData/);
  assert.match(source, /const \[activeShareItem, setActiveShareItem\]/);
  assert.match(source, /const shareSheetRef = useRef<BottomSheetModal>\(null\)/);
  assert.match(source, /openShareSheet\(item\)/);
  assert.match(source, /sendPostToHungryUsers/);
  assert.match(source, /sharePostToChat\(chatId,/);
  assert.match(source, /incrementPostShare\(activeShareItem\.id\)/);
  assert.match(
    source,
    /accessibilityLabel=\{`Share \$\{item\.dishes\[0\]\?\.name \?\? item\.venue\.name\} in Hungry`\}/,
  );
  assert.match(source, /Share in Hungry/);
  assert.match(source, /FloatingShareSendButton/);
  assert.match(source, /selectedCount=\{selectedShareChatIds\.length\}/);
  assert.match(source, /accessibilityLabel="Send shared post"/);
  assert.doesNotMatch(source, /showSendAction/);
  assert.match(source, /recipients=\{ACTIVITY_MESSAGES\}/);
  assert.match(source, /recipientAccessibilityLabelPrefix="Share post to"/);
  assert.match(source, /Clipboard\.setString/);
  assert.match(source, /Share\.share\(/);
  assert.match(source, /commentsSheetRef\.current\?\.present\(\)/);
  assert.match(source, /<BottomSheetModal/);
  assert.match(source, /commentsByPostId\[activeCommentItem\.id\] \?\? \[\]/);
  assert.match(source, /addPostComment\(activeCommentItem\.id, newComment\)/);
  assert.match(source, /addPostReply\(activeCommentItem\.id, newReply\)/);
  assert.match(source, /repliesByCommentId\[comment\.id\] \?\? \[\]/);
  assert.match(source, /style=\{styles\.commentText\}/);
  assert.match(source, /style=\{styles\.replyText\}/);
  assert.match(source, /const styles = useMemo\(\(\) => createStyles\(theme\), \[theme\]\)/);
  assert.match(source, /const listHeader = useMemo\(\(\) => renderHeader\(\), \[renderHeader\]\)/);
  assert.match(source, /ListHeaderComponent=\{listHeader\}/);
  assert.match(source, /useDiscoveryStore/);
  assert.match(source, /const MAP_BUILDING_ID_ALIASES/);
  assert.match(source, /const openVenueOnMap = useCallback/);
  assert.match(source, /setSelectedBuilding\(toSummary\(mapBuilding\)\)/);
  assert.match(source, /setSelectedFloor\(item\.venue\.floor\)/);
  assert.match(source, /setHighlightedStallVenueId\(item\.venueId\)/);
  assert.match(source, /navigation\.navigate\("DiscoverMap"\)/);
  assert.match(source, /accessibilityLabel=\{`Show \$\{item\.venue\.name\} on map`\}/);
  assert.match(source, /accessibilityLabel=\{`Show \$\{item\.authorLocation\} on map`\}/);
  assert.match(source, /accessibilityLabel=\{`Open \$\{item\.authorName\} profile`\}/);
  assert.match(source, /accessibilityLabel=\{`Open \$\{item\.authorName\} profile photo`\}/);
  assert.match(
    source,
    /openUserProfile\(item\.authorName, item\.authorAvatarUrl, item\.authorLocation\)/,
  );
  assert.match(source, /onPress=\{\(\) => openVenueOnMap\(item\)\}/);
  assert.match(
    source,
    /const followedAuthors = useSocialStore\(\(state\) => state\.followedAuthors\)/,
  );
  assert.match(
    source,
    /const toggleAuthorFollow = useSocialStore\(\(state\) => state\.toggleAuthorFollow\)/,
  );
  assert.match(source, /const isFollowingAuthor = Boolean\(followedAuthors\[item\.authorName\]\)/);
  assert.match(
    source,
    /accessibilityLabel=\{`\$\{isFollowingAuthor \? "Unfollow" : "Follow"\} \$\{item\.authorName\}`\}/,
  );
  assert.match(source, /style=\{\[\s*styles\.followButton/);
  assert.match(source, /\{isFollowingAuthor \? "Following" : "Follow"\}/);
  assert.match(source, /function formatPostAge\(createdAt: string\)/);
  assert.match(source, /const COLLAPSED_CAPTION_MAX_CHARS = 118/);
  assert.match(source, /function formatCollapsedCaption\(caption: string\)/);
  assert.match(source, /const \[captionOverflowByPostId, setCaptionOverflowByPostId\]/);
  assert.match(source, /const handleCaptionTextLayout = useCallback/);
  assert.match(source, /current\[postId\] && !isOverflowing/);
  assert.match(source, /const postAgeLabel = formatPostAge\(item\.createdAt\)/);
  assert.doesNotMatch(source, /\{" · "\}\s*\{postAgeLabel\}/);
  assert.match(
    source,
    /const postTags =\s*\(item\.tags\?\.length \? item\.tags : item\.dishes\[0\]\?\.tasteTags\)\?\.slice\(0, 4\) \?\? \[\]/,
  );
  assert.match(
    source,
    /const mediaUrls =\s*item\.mediaType === "photo" && item\.mediaUrls\?\.length \? item\.mediaUrls : \[item\.mediaUrl\]/,
  );
  assert.match(
    source,
    /horizontal[\s\S]*pagingEnabled[\s\S]*showsHorizontalScrollIndicator=\{false\}/,
  );
  assert.match(source, /setCarouselIndexByPostId/);
  assert.match(source, /numberOfLines=\{2\}/);
  assert.match(source, /onTextLayout=\{\(event\) => handleCaptionTextLayout\(item\.id, event\)\}/);
  assert.match(source, /accessibilityLabel=\{`Read comments for \$\{item\.authorName\}'s post`\}/);
  assert.match(source, /onPress=\{\(\) => openComments\(item\)\}/);
  assert.match(
    source,
    /\{captionOverflows \? formatCollapsedCaption\(item\.caption\) : item\.caption\}/,
  );
  assert.match(source, /\{" more"\}/);
  assert.doesNotMatch(source, /Read more comments for/);
  assert.match(source, /styles\.postTag/);
  assert.match(source, /feedItemWrap:[\s\S]*marginBottom: spacing\[6\]/);
  assert.match(source, /activeCommentItem\.caption/);
  const profileFollowRowIndex = source.indexOf("{/* Row 1: Profile & Follow */}");
  const imageContainerIndex = source.indexOf("{/* Image Container */}");
  const iconRowIndex = source.indexOf("{/* Row 1: Icons */}");
  const captionRowIndex = source.indexOf("{/* Row 2: Caption */}");
  const captionTextIndex = source.indexOf("{item.caption}", captionRowIndex);
  const captionDateIndex = source.indexOf("{postAgeLabel}", captionTextIndex);
  assert.ok(profileFollowRowIndex >= 0);
  assert.ok(imageContainerIndex > profileFollowRowIndex);
  assert.ok(iconRowIndex > imageContainerIndex);
  assert.ok(captionRowIndex > iconRowIndex);
  assert.ok(captionDateIndex > captionTextIndex);
  assert.doesNotMatch(source, /Row 1: Profile & Icons Inline/);
  assert.match(mapSource, /highlightedStallVenueId/);
  assert.match(
    mapSource,
    /selectedMarkerId=\{highlightedStallVenueId \? `stall-\$\{highlightedStallVenueId\}` : undefined\}/,
  );
  assert.doesNotMatch(source, /interaction\.saveCount > 0/);
  assert.doesNotMatch(source, /localCommentsByPostId/);
  assert.doesNotMatch(source, /localRepliesByCommentId/);
});

test("Sprint 9 screen contract: Home feed double tap likes with heart animation", () => {
  const source = read("src/app/screens/home/HomeFeedScreen.tsx");

  assert.match(source, /const DOUBLE_TAP_DELAY_MS = 280/);
  assert.match(source, /lastImageTapRef/);
  assert.match(source, /singleTapTimerRef/);
  assert.match(source, /handlePostImagePress/);
  assert.match(
    source,
    /<ZoomableMedia[\s\S]*onPress=\{\(event\) => handlePostImagePress\(item, event\)\}/,
  );
  assert.match(source, /event\.nativeEvent\.locationX/);
  assert.match(source, /event\.nativeEvent\.locationY/);
  assert.doesNotMatch(source, /const targetDishId = item\.dishes\[0\]\?\.id \?\? item\.venueId/);
  assert.doesNotMatch(source, /navigateToDish\(targetDishId\)/);
  assert.match(source, /if \(!interactions\[item\.id\]\?\.liked\)/);
  assert.match(source, /void togglePostLike\(item\.id\)/);
  assert.match(source, /runDoubleTapHeartAnimation/);
  assert.match(source, /duration: 980/);
  assert.match(
    source,
    /const heartOriginX = heartBurst\?\.postId === item\.id \? heartBurst\.originX : screenWidth \/ 2/,
  );
  assert.match(
    source,
    /const heartOriginY = heartBurst\?\.postId === item\.id \? heartBurst\.originY : imageHeight \/ 2/,
  );
  assert.match(
    source,
    /const likeIconTargetTranslateX = screenWidth - spacing\[3\] - 12 - heartOriginX/,
  );
  assert.match(
    source,
    /const likeIconTargetTranslateY =\s*imageHeight \+ spacing\[3\] \+ 32 \+ spacing\[2\] \+ 12 - heartOriginY/,
  );
  assert.match(source, /<Animated\.View/);
  assert.match(source, /const authorRowHeight = spacing\[3\] \* 2 \+ 32/);
  assert.match(source, /top: authorRowHeight \+ heartBurst\.originY - 42/);
  assert.match(source, /left: heartBurst\.originX - 42/);
  assert.match(source, /<Heart color=\{palette\.error\} fill=\{palette\.error\} size=\{84\}/);
  assert.match(source, /translateX: heartBurstAnim\.interpolate/);
  assert.match(source, /translateY: heartBurstAnim\.interpolate/);
  assert.match(source, /inputRange: \[0, 0\.38, 0\.55, 1\]/);
  assert.match(
    source,
    /outputRange: \[\s*0,\s*0,\s*likeIconTargetTranslateX \* 0\.35,\s*likeIconTargetTranslateX,\s*\]/,
  );
  assert.match(source, /inputRange: \[0, 0\.24, 0\.42, 1\]/);
  assert.match(source, /outputRange: \[0, -76, -58, likeIconTargetTranslateY\]/);
  assert.match(source, /outputRange: \[0\.7, 1\.28, 1\.05, 0\.82, 0\.42\]/);
  assert.doesNotMatch(source, /handlePostLikeIconPress/);
  assert.doesNotMatch(source, /lastLikeIconTapRef/);
  assert.doesNotMatch(source, /likeIconSingleTapTimerRef/);
  assert.doesNotMatch(
    source,
    /<Heart color=\{palette\.white\} fill=\{palette\.error\} size=\{84\}/,
  );
});

test("Sprint 9 screen contract: Home feed header follows app header scale", () => {
  const source = read("src/app/screens/home/HomeFeedScreen.tsx");

  assert.match(source, /<AppHeader[\s\S]*title="Hungry"/);
  assert.match(source, /horizontalPadding=\{semanticSpacing\.screenEdge\}/);
  assert.match(source, /titleStyle=\{\{ color: palette\.orange \}\}/);
  assert.doesNotMatch(source, /<View style=\{\{ flex: 1, paddingTop: spacing\[3\] \}\}>/);
  assert.doesNotMatch(
    source,
    /variant="displayBold" style=\{\{ color: palette\.orange, fontSize: 32 \}\}/,
  );
});

test("Sprint 9 screen contract: routed dish detail uses gallery-backed share flow", () => {
  const source = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const navigatorSource = read("src/app/navigation/RootNavigator.tsx");

  assert.match(source, /const repository = getDataRepository\(\)/);
  assert.match(source, /buildDishGallery\(dish\)/);
  assert.match(source, /const canonicalDishUrl = `https:\/\/hungry\.sg\/dish\/\$\{dish\.id\}`/);
  assert.match(source, /ReviewShareSheet/);
  assert.match(source, /shareSheetRef\.current\?\.present\(\)/);
  assert.match(source, /link: canonicalDishUrl/);
  assert.doesNotMatch(navigatorSource, /import \{ DishDetailScreen \}/);
  assert.match(navigatorSource, /component=\{DishDetailScreenV2\} name=\"DishDetail\"/);
});

test("Sprint 9 screen contract: Stitch-inspired dish detail v2 is routed and data-backed", () => {
  const source = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const navigatorSource = read("src/app/navigation/RootNavigator.tsx");
  const navigationTypes = read("src/app/navigation/navigationTypes.ts");
  const launcherSource = read("src/app/screens/dev/DeveloperLauncherScreen.tsx");
  const mockDataSource = read("src/lib/services/mock/data.ts");

  assert.match(source, /getDataRepository\(\)/);
  assert.match(
    source,
    /type Props = NativeStackScreenProps<RootStackParamList, "DishDetail" \| "DishDetailV2">/,
  );
  assert.match(source, /fallbackDishes\.find/);
  assert.match(source, /buildDishGallery\(dish\)/);
  assert.match(source, /function formatBasePrice\(price: number\)/);
  assert.match(source, /formatBasePrice\(dish\.price\)/);
  assert.match(source, /fontSize: 28, lineHeight: 34/);
  assert.match(
    source,
    /colors=\{\["rgba\(255,255,255,0\)", "rgba\(255,255,255,0\.72\)", palette\.bg\]\}/,
  );
  assert.match(source, /locations=\{\[0, 0\.58, 1\]\}/);
  assert.doesNotMatch(source, /Epicurean Discovery/);
  assert.doesNotMatch(source, /borderBottomWidth: 1,[\s\S]*Epicurean Discovery/);
  assert.match(source, /View Taste Profile/);
  assert.match(source, /Opening Hours/);
  assert.match(source, /Signature Dishes/);
  assert.match(source, /From the Community/);
  assert.match(source, /\.\.\.fallbackDishes,/);
  assert.match(source, /const signatureGridItemWidth = width \/ 2/);
  assert.match(source, /const signatureGridItemHeight = signatureGridItemWidth \* 1\.5/);
  assert.match(source, /marginHorizontal: -spacing\[4\]/);
  assert.match(source, /signatureDishes\.slice\(0, 4\)\.map/);
  assert.match(source, /height: signatureGridItemHeight/);
  assert.match(source, /width: signatureGridItemWidth/);
  assert.match(source, /backgroundColor: "rgba\(15, 23, 42, 0\.48\)"/);
  assert.match(source, /shadowRadius: 12/);
  assert.match(source, /textShadowRadius: 3/);
  assert.match(source, /formatBasePrice\(item\.price\)/);
  assert.doesNotMatch(source, /\{dish\.priceRange\}/);
  assert.doesNotMatch(source, /\{item\.priceRange\}/);
  assert.match(source, /navigation\.navigate\(\"DishDetailV2\", \{ dishId: item\.id \}\)/);
  assert.match(navigatorSource, /import \{ DishDetailScreenV2 \}/);
  assert.match(navigatorSource, /component=\{DishDetailScreenV2\} name=\"DishDetailV2\"/);
  assert.match(navigationTypes, /DishDetailV2: \{ dishId\?: string; id\?: string \};/);
  assert.match(
    mockDataSource,
    /const FOOD_1 =\s*"https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/7\/71\/Hainanese_Chicken_Rice\.jpg"/,
  );
  assert.match(launcherSource, /dishes as mockDishes/);
  assert.match(launcherSource, /repository\.listPopularNearby\(\)\[0\] \?\? mockDishes\[0\]/);
  assert.match(launcherSource, /const openSampleDishDetail = \(version: "v1" \| "v2" = "v1"\)/);
  assert.match(launcherSource, /completeAuth\(\);[\s\S]*completeOnboarding\(false\);/);
  assert.match(
    launcherSource,
    /navigation\.navigate\(version === "v2" \? "DishDetailV2" : "DishDetail", \{ dishId: dish\.id \}\)/,
  );
  assert.match(
    launcherSource,
    /label="Dish Detail"[\s\S]*onV2=\{\(\) => openSampleDishDetail\("v2"\)\}/,
  );
  assert.match(
    launcherSource,
    /label="Dish V2"[\s\S]*onPress=\{\(\) => openSampleDishDetail\("v2"\)\}/,
  );
});
