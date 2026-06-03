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
  const signUpSource = read("src/app/screens/auth/SignUpScreen.tsx");
  const forgotPasswordSource = read("src/app/screens/auth/ForgotPasswordScreen.tsx");
  const resetPasswordSource = read("src/app/screens/auth/ResetPasswordScreen.tsx");
  const emailVerificationSource = read("src/app/screens/auth/EmailVerificationScreen.tsx");
  const authCopySource = read("src/app/screens/auth/authCopy.ts");
  const providerButtonSource = read("src/app/screens/auth/AuthProviderButton.tsx");
  const providerLogoSource = read("src/components/icons/brand/AuthProviderLogos.tsx");

  assert.match(source, /getHungryService\(\)\.auth\.signIn\(/);
  assert.match(source, /const service = getHungryService\(\)/);
  assert.match(source, /service\.auth\.signInWithGoogle\(/);
  assert.match(source, /service\.auth\.signInWithApple\(/);
  assert.match(source, /FEATURE_FLAGS\.oauthProvidersEnabled/);
  assert.match(source, /AUTH_COPY\.login/);
  assert.match(
    source,
    /<AuthProviderButton[\s\S]*disabled=\{!oauthProvidersEnabled\}[\s\S]*intent="signIn"[\s\S]*provider="google"/,
  );
  assert.match(
    source,
    /<AuthProviderButton[\s\S]*disabled=\{!oauthProvidersEnabled\}[\s\S]*intent="signIn"[\s\S]*provider="apple"/,
  );
  assert.match(signUpSource, /AUTH_COPY\.signUp/);
  assert.match(signUpSource, /FEATURE_FLAGS\.oauthProvidersEnabled/);
  assert.match(
    signUpSource,
    /<AuthProviderButton[\s\S]*disabled=\{!oauthProvidersEnabled\}[\s\S]*intent="continue"[\s\S]*provider="google"/,
  );
  assert.match(
    signUpSource,
    /<AuthProviderButton[\s\S]*disabled=\{!oauthProvidersEnabled\}[\s\S]*intent="continue"[\s\S]*provider="apple"/,
  );
  assert.match(forgotPasswordSource, /AUTH_COPY\.forgotPassword/);
  assert.match(source, /<FeedErrorBoundary/);
  assert.match(authCopySource, /login: \{/);
  assert.match(authCopySource, /signUp: \{/);
  assert.match(authCopySource, /forgotPassword: \{/);
  assert.match(authCopySource, /getAuthProviderButtonLabel/);
  assert.match(authCopySource, /getAuthProviderUnavailableButtonLabel/);
  assert.match(authCopySource, /getAuthProviderUnavailableMessage/);
  assert.match(authCopySource, /getSignUpProviderSuccessMessage/);
  assert.doesNotMatch(source, /"Welcome back\."/);
  assert.doesNotMatch(signUpSource, /"Account created\. Please verify your email\."/);
  assert.doesNotMatch(forgotPasswordSource, /"If the email exists, a reset link was sent\."/);
  assert.match(providerButtonSource, /import \{ AppleLogo, GoogleLogo \}/);
  assert.match(providerButtonSource, /position: "absolute"/);
  assert.match(providerButtonSource, /textAlign: "center"/);
  assert.match(providerButtonSource, /getAuthProviderButtonLabel\(provider, intent\)/);
  assert.match(providerButtonSource, /getAuthProviderUnavailableButtonLabel\(provider\)/);
  assert.match(providerButtonSource, /accessibilityLabel=\{label\}/);
  assert.match(providerButtonSource, /accessibilityState=\{\{ disabled \}\}/);
  assert.match(providerButtonSource, /disabled=\{disabled\}/);
  assert.match(
    source,
    /accessibilityRole="button"[\s\S]*accessibilityLabel=\{AUTH_COPY\.login\.footerAction\}/,
  );
  assert.match(source, /accessibilityHint="Opens the account creation screen"/);
  assert.match(source, /accessibilityLabel=\{showPassword \? "Hide password" : "Show password"\}/);
  assert.match(source, /accessibilityHint=\{[\s\S]*Shows the password characters[\s\S]*\}/);
  assert.match(
    source,
    /accessibilityRole="button"[\s\S]*accessibilityLabel=\{AUTH_COPY\.login\.forgotPasswordLink\}/,
  );
  assert.match(source, /accessibilityHint="Opens password reset"/);
  assert.match(signUpSource, /accessibilityLabel=\{AUTH_COPY\.signUp\.footerAction\}/);
  assert.match(signUpSource, /accessibilityHint="Returns to the sign in screen"/);
  assert.match(
    signUpSource,
    /accessibilityLabel=\{showPassword \? "Hide password" : "Show password"\}/,
  );
  assert.match(
    forgotPasswordSource,
    /accessibilityLabel=\{AUTH_COPY\.forgotPassword\.backToLogin\}/,
  );
  assert.match(forgotPasswordSource, /accessibilityHint="Returns to the sign in screen"/);
  assert.match(resetPasswordSource, /accessibilityLabel="Back to Sign In"/);
  assert.match(
    resetPasswordSource,
    /accessibilityLabel=\{showPassword \? "Hide password" : "Show password"\}/,
  );
  assert.match(
    resetPasswordSource,
    /accessibilityLabel=\{\s*showConfirmPassword\s*\?\s*"Hide confirmation password"\s*:\s*"Show confirmation password"\s*\}/,
  );
  assert.match(emailVerificationSource, /accessibilityLabel=\{[\s\S]*Resend verification email/);
  assert.match(emailVerificationSource, /accessibilityHint="Requests a new verification email"/);
  assert.match(providerLogoSource, /export const AUTH_PROVIDER_LOGO_SIZE = 20/);
  assert.match(providerLogoSource, /export const AUTH_PROVIDER_APPLE_LOGO_SIZE = 26/);
  assert.match(providerLogoSource, /export function GoogleLogo/);
  assert.match(providerLogoSource, /size = AUTH_PROVIDER_LOGO_SIZE/);
  assert.match(providerLogoSource, /viewBox="1 1 21\.56 22"/);
  assert.match(providerLogoSource, /AUTH_PROVIDER_GOOGLE_LOGO_COLORS\.blue/);
  assert.match(providerLogoSource, /AUTH_PROVIDER_GOOGLE_LOGO_COLORS\.green/);
  assert.match(providerLogoSource, /AUTH_PROVIDER_GOOGLE_LOGO_COLORS\.yellow/);
  assert.match(providerLogoSource, /AUTH_PROVIDER_GOOGLE_LOGO_COLORS\.red/);
  assert.match(providerLogoSource, /export function AppleLogo/);
  assert.match(providerLogoSource, /size = AUTH_PROVIDER_APPLE_LOGO_SIZE/);
  assert.match(providerLogoSource, /viewBox="2\.94 2 17\.15 20"/);
  assert.match(providerLogoSource, /AUTH_PROVIDER_APPLE_LOGO_COLOR/);
});

test("Sprint 9 screen contract: Review screen submits via service and triggers success UI", () => {
  const source = read("src/app/screens/review/ReviewScreen.tsx");

  assert.match(source, /getHungryService\(\)\.reviews\.submitReview\(/);
  assert.match(source, /showReviewSuccess\(/);
  assert.match(source, /showToast\(\{ message: "Review posted!"/);
  assert.match(source, /<FeedErrorBoundary/);
});

test("Sprint 9 screen contract: onboarding icon controls and location rows are labelled", () => {
  const locationPermission = read("src/app/screens/onboarding/LocationPermissionScreen.tsx");
  const manualLocation = read("src/app/screens/onboarding/ManualLocationPickerScreen.tsx");
  const tasteProfileResult = read("src/app/screens/onboarding/TasteProfileResultScreen.tsx");
  const tasteQuiz = read("src/app/screens/onboarding/TasteQuizScreen.tsx");

  assert.match(locationPermission, /accessibilityLabel="Back to taste quiz"/);
  assert.match(locationPermission, /accessibilityHint="Returns to the taste preference questions"/);
  assert.match(manualLocation, /accessibilityLabel="Back to location permission"/);
  assert.match(manualLocation, /accessibilityLabel="Search Singapore location"/);
  assert.match(manualLocation, /accessibilityLabel=\{`Choose \$\{area\.name\}`\}/);
  assert.match(manualLocation, /accessibilityHint="Sets this as your Hungry discovery location"/);
  assert.match(tasteProfileResult, /accessibilityLabel=\{`Save \$\{dish\.name\}`\}/);
  assert.match(tasteProfileResult, /accessibilityHint="Adds this dish to your favourites"/);
  assert.match(
    tasteQuiz,
    /accessibilityRole="button"[\s\S]*accessibilityLabel=\{`\$\{labels\[index\]\} \$\{QUESTIONS\[currentKey\]\}`\}/,
  );
  assert.match(
    tasteQuiz,
    /accessibilityHint=\{`Selects \$\{choiceFoods\[index\]\.label\} as your answer for this taste question`\}/,
  );
  assert.match(
    tasteQuiz,
    /accessibilityState=\{\{ selected: isSelected, disabled: isTransitioning \}\}/,
  );
  assert.match(
    tasteQuiz,
    /accessibilityRole="checkbox"[\s\S]*accessibilityLabel=\{`Dietary preference \$\{option\.label\}`\}/,
  );
  assert.match(tasteQuiz, /accessibilityState=\{\{ checked: isSelected \}\}/);
  assert.match(tasteQuiz, /const \{ fontScale, width \} = useWindowDimensions\(\)/);
  assert.match(
    tasteQuiz,
    /const accessibilityFooterReserve = Math\.ceil\(Math\.max\(fontScale - 1, 0\) \* 96\)/,
  );
  assert.match(
    tasteQuiz,
    /const actionFooterBottomPadding = ONBOARDING_ACTIONS_BOTTOM_PADDING \+ spacing\[2\]/,
  );
  assert.match(tasteQuiz, /paddingBottom: spacing\[6\] \+ accessibilityFooterReserve/);
  assert.match(tasteQuiz, /flexShrink: 0/);
  assert.match(tasteQuiz, /paddingBottom: actionFooterBottomPadding/);
  assert.match(tasteQuiz, /labelNumberOfLines=\{fontScale > 1\.15 \? 2 : 1\}/);
});

test("Sprint 9 screen contract: stall menu cards expose dish actions", () => {
  const stallDetail = read("src/app/screens/detail/StallDetailScreen.tsx");

  assert.match(
    stallDetail,
    /accessibilityRole="button"[\s\S]*accessibilityLabel=\{`Open \$\{activeDish\.name\}`\}/,
  );
  assert.match(stallDetail, /accessibilityHint="Opens this dish detail page"/);
});

test("Sprint 9 screen contract: Search cards expose actionable semantics", () => {
  const search = read("src/app/screens/search/DishSearchScreen.tsx");
  const collectionDetail = read("src/app/screens/discover/CollectionDetailScreen.tsx");
  const buildingDrillDown = read("src/app/screens/discover/BuildingDrillDownScreen.tsx");
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");

  assert.match(search, /accessibilityLabel="Search dishes, stalls, or hawker centres"/);
  assert.match(search, /const suggestedDish = collections\[0\]\?\.topDishes\[0\]/);
  assert.match(
    search,
    /accessibilityRole="button"[\s\S]*accessibilityLabel=\{[\s\S]*`Open suggested dish \$\{suggestedDish\.name\}`/,
  );
  assert.match(search, /accessibilityHint="Opens this dish detail page"/);
  assert.match(search, /accessibilityState=\{\{ disabled: !suggestedDish \}\}/);
  assert.match(search, /accessibilityLabel=\{`Open \$\{collection\.venue\.name\} stall details`\}/);
  assert.match(search, /accessibilityHint="Opens this stall page with menu and dish information"/);
  assert.match(
    collectionDetail,
    /accessibilityLabel=\{`Open \$\{row\.venue\?\.name \?\? row\.item\.stallId\} stall details`\}/,
  );
  assert.match(
    collectionDetail,
    /accessibilityHint="Opens this stall page with menu and dish information"/,
  );
  assert.match(buildingDrillDown, /accessibilityLabel=\{`Show floor \$\{floor\}`\}/);
  assert.match(buildingDrillDown, /accessibilityState=\{\{ selected \}\}/);
  assert.match(rootNavigator, /accessibilityLabel="Go back"/);
  assert.match(rootNavigator, /accessibilityHint="Returns to the previous screen"/);
});

test("Sprint 9 screen contract: Home feed interactions are wired for like/save/comment/share", () => {
  const source = read("src/app/screens/home/HomeFeedScreen.tsx");
  const feedSource = read("src/features/home/feed.ts");
  const mapSource = read("src/app/screens/discover/HomeMapScreen.tsx");

  assert.doesNotMatch(feedSource, /dataRepositoryMock as fallbackRepository/);
  assert.doesNotMatch(feedSource, /fallbackRepository\.listStallPosts\(\)/);
  assert.match(feedSource, /repository\.getVenueById\(post\.venueId\)/);
  assert.match(feedSource, /repository\.getDishById\(dishId\)/);
  assert.match(source, /useSocialStore/);
  assert.doesNotMatch(source, /MissionBanner/);
  assert.doesNotMatch(source, /navigation\.navigate\("MissionsScreen"\)/);
  assert.match(source, /togglePostLike/);
  assert.match(source, /togglePostSave/);
  assert.match(source, /addPostComment/);
  assert.match(source, /addPostReply/);
  assert.match(source, /const bundle = await getHomeFeedBundle\(profile\)/);
  assert.match(source, /\.\.\.bundle\.socialFeed/);
  assert.match(source, /\.\.\.bundle\.sections\.flatMap\(\(section\) => section\.items\)/);
  assert.match(source, /mode === "social" \? \(/);
  assert.doesNotMatch(source, /mode === "social" && commentsEnabled/);
  assert.match(source, /const \[activeShareItem, setActiveShareItem\]/);
  assert.match(source, /const shareSheetRef = useRef<BottomSheetModal>\(null\)/);
  assert.match(source, /openShareSheet\(item\)/);
  assert.match(source, /sendPostToHungryUsers/);
  assert.match(source, /sharePostToChat\(chatId,/);
  assert.match(source, /incrementPostShare\(activeShareItem\.id\)/);
  assert.match(source, /const actionTargetName = item\.dishes\[0\]\?\.name \?\? item\.venue\.name/);
  assert.match(source, /accessibilityLabel=\{`Share \$\{actionTargetName\} in Hungry`\}/);
  assert.match(source, /accessibilityHint="Opens sharing options for this post"/);
  assert.match(
    source,
    /accessibilityLabel=\{`\$\{isSaved \? "Unsave" : "Save"\} \$\{actionTargetName\}`\}/,
  );
  assert.match(source, /isSaved\s*\?\s*"Removes this post from your saved items"/);
  assert.match(source, /accessibilityLabel=\{`Comment on \$\{actionTargetName\}`\}/);
  assert.match(source, /accessibilityHint="Opens the comments for this post"/);
  assert.match(
    source,
    /accessibilityLabel=\{`\$\{isLiked \? "Unlike" : "Like"\} \$\{actionTargetName\}`\}/,
  );
  assert.match(source, /isLiked\s*\?\s*"Removes your like from this post"/);
  assert.match(source, /accessibilityLabel="Home food feed"/);
  assert.match(
    source,
    /accessibilityHint="Swipe vertically to browse food posts and pull down to refresh"/,
  );
  assert.match(source, /directMessagesEnabled \? "Share in Hungry" : "Share post"/);
  assert.match(source, /FloatingShareSendButton/);
  assert.match(source, /selectedCount=\{selectedShareChatIds\.length\}/);
  assert.match(source, /accessibilityLabel="Send shared post"/);
  assert.doesNotMatch(source, /showSendAction/);
  assert.match(source, /recipients=\{directMessagesEnabled \? shareRecipients : \[\]\}/);
  assert.match(source, /toChatShareRecipient/);
  assert.doesNotMatch(source, /ACTIVITY_MESSAGES/);
  assert.match(source, /recipientAccessibilityLabelPrefix="Share post to"/);
  assert.match(source, /Clipboard\.setString/);
  assert.match(source, /Share\.share\(/);
  assert.match(source, /const openCommentSheet = useCallback/);
  assert.match(source, /const commentSheet = commentsSheetRef\.current/);
  assert.match(source, /openCommentSheet\(\)/);
  assert.match(
    source,
    /const loadCommentsForPost = useSocialStore\(\(state\) => state\.loadCommentsForPost\)/,
  );
  assert.match(source, /void loadCommentsForPost\(activeCommentItem\.id\)/);
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
    /openUserProfile\([\s\S]*item\.authorName,[\s\S]*item\.authorAvatarUrl,[\s\S]*item\.authorLocation/,
  );
  assert.match(source, /onPress=\{\(\) => openVenueOnMap\(item\)\}/);
  assert.match(
    source,
    /const followedAuthors = useSocialStore\(\(state\) => state\.followedAuthors\)/,
  );
  assert.match(
    source,
    /const followedUserIds = useSocialStore\(\(state\) => state\.followedUserIds\)/,
  );
  assert.match(
    source,
    /const toggleAuthorFollow = useSocialStore\(\(state\) => state\.toggleAuthorFollow\)/,
  );
  assert.match(source, /const toggleFollow = useSocialStore\(\(state\) => state\.toggleFollow\)/);
  assert.match(source, /const followTargetId = item\.authorId/);
  assert.match(
    source,
    /followTargetId[\s\S]*\? Boolean\(followedUserIds\[followTargetId\]\)[\s\S]*: Boolean\(followedAuthors\[item\.authorName\]\)/,
  );
  assert.match(
    source,
    /followTargetId[\s\S]*\? toggleFollow\(followTargetId\)[\s\S]*: toggleAuthorFollow\(item\.authorName\)/,
  );
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
    /selectedMarkerId=\{\s*highlightedStallVenueId \? `stall-\$\{highlightedStallVenueId\}` : undefined\s*\}/,
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
  assert.match(source, /handlePostLike\(item\)/);
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

test("Sprint 9 screen contract: Home feed supports pull-to-refresh without hiding ready content", () => {
  const source = read("src/app/screens/home/HomeFeedScreen.tsx");

  assert.match(source, /RefreshControl/);
  assert.match(source, /const \[isRefreshing, setIsRefreshing\] = useState\(false\)/);
  assert.match(source, /const refreshHomeFeed = useCallback\(async \(\) =>/);
  assert.match(source, /setIsRefreshing\(true\)/);
  assert.match(
    source,
    /await loadFeed\(\{ force: true, preserveReadyOnError: true, showLoading: false \}\)/,
  );
  assert.match(source, /refreshing=\{isRefreshing\}/);
  assert.match(source, /onRefresh=\{refreshHomeFeed\}/);
});

test("Sprint 9 screen contract: feed videos pause on tap and fast-forward only from edge holds", () => {
  const source = read("src/components/social/ZoomableVideo.tsx");

  assert.match(source, /const EDGE_FAST_FORWARD_FRACTION = 0\.2/);
  assert.match(source, /const \[videoWidth, setVideoWidth\] = useState\(0\)/);
  assert.match(source, /const startFastForward = \(touchX: number\) =>/);
  assert.match(source, /touchX <= leftEdge \|\| touchX >= rightEdge/);
  assert.match(source, /if \(!isEdgeHold\) \{\s*return;\s*\}/);
  assert.match(source, /player\.playbackRate = 2\.0/);
  assert.match(source, /player\.playbackRate = 1\.0/);
  assert.match(source, /player\.loop = true/);
  assert.match(source, /player\.addListener\("playToEnd"/);
  assert.match(source, /player\.currentTime = 0/);
  assert.match(source, /player\.play\(\)/);
  assert.match(source, /Gesture\.LongPress\(\)[\s\S]*runOnJS\(startFastForward\)\(event\.x\)/);
  assert.match(source, /Gesture\.Tap\(\)\.onEnd[\s\S]*runOnJS\(handleTogglePlay\)\(\)/);
  assert.match(
    source,
    /onLayout=\{\(event\) => \{\s*setVideoWidth\(event\.nativeEvent\.layout\.width\);/,
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

test("Taste recommendation contract: core surfaces use shared ranking and explicit signals", () => {
  const homeFeedSource = read("src/features/home/feed.ts");
  const searchSource = read("src/features/search/search.ts");
  const mockRepositorySource = read("src/lib/services/mock/repositories.ts");
  const supabaseRepositorySource = read("src/lib/services/supabase/supabaseRepository.ts");
  const homeScreenSource = read("src/app/screens/home/HomeFeedScreen.tsx");
  const discoverSource = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const searchScreenSource = read("src/app/screens/search/SearchResultsScreen.tsx");
  const decideSource = read("src/app/screens/discover/DecideForMeResultScreen.tsx");
  const profileStoreSource = read("src/store/useProfileStore.ts");

  assert.match(homeFeedSource, /runRecommendationPipeline/);
  assert.match(mockRepositorySource, /runRecommendationPipeline\(results/);
  assert.match(supabaseRepositorySource, /runRecommendationPipeline\(matched/);
  assert.match(searchSource, /return cloned;/);
  assert.match(homeScreenSource, /recordTasteInteraction/);
  assert.match(homeScreenSource, /type: "dish_like"/);
  assert.match(profileStoreSource, /recommendations\.recordExplicitFeedback/);
  assert.match(discoverSource, /type: "search_query"/);
  assert.match(discoverSource, /type: "dish_result_click"/);
  assert.match(searchScreenSource, /type: "search_query"/);
  assert.match(searchScreenSource, /type: "dish_result_click"/);
  assert.match(searchScreenSource, /onSubmitQuery=\{recordCommittedSearchQuery\}/);
  assert.match(decideSource, /type: "dismissed"/);
  assert.match(decideSource, /type: "food_button_click"/);
  assert.doesNotMatch(decideSource, /dish: nextDish,[\s\S]*buttonId: "try_another_pick"/);
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
  assert.match(navigatorSource, /getComponent=\{loadDishDetailScreenV2\} name="DishDetail"/);
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
  assert.match(source, /buildDishGallery\(dish\)/);
  assert.match(source, /function formatBasePrice\(price: number\)/);
  assert.match(source, /formatBasePrice\(dish\.price\)/);
  assert.match(source, /fontSize: 28, lineHeight: 34/);
  assert.match(source, /const heroGradientColors: readonly \[ColorValue, ColorValue, ColorValue\]/);
  assert.match(source, /palette\.detailHeroGradientStart/);
  assert.match(source, /palette\.detailHeroGradientMid/);
  assert.match(source, /palette\.bg/);
  assert.match(source, /colors=\{heroGradientColors\}/);
  assert.match(source, /locations=\{\[0, 0\.58, 1\]\}/);
  assert.doesNotMatch(source, /Epicurean Discovery/);
  assert.doesNotMatch(source, /borderBottomWidth: 1,[\s\S]*Epicurean Discovery/);
  assert.match(source, /View Taste Profile/);
  assert.match(source, /Opening Hours/);
  assert.match(source, /Signature Dishes/);
  assert.match(source, /From the Community/);
  assert.match(source, /const venueDishes = useMemo/);
  assert.match(source, /getSignatureDishes\(dish, venueDishes\)/);
  assert.doesNotMatch(source, /supplementalDishes/);
  assert.match(source, /const signatureGridItemWidth = width \/ 2/);
  assert.match(source, /const signatureGridItemHeight = signatureGridItemWidth \* 1\.5/);
  assert.match(source, /marginHorizontal: -spacing\[4\]/);
  assert.match(source, /signatureDishes\.slice\(0, 4\)\.map/);
  assert.match(source, /height: signatureGridItemHeight/);
  assert.match(source, /width: signatureGridItemWidth/);
  assert.match(source, /palette\.detailImageBadgeSurface/);
  assert.match(source, /shadowRadius: 12/);
  assert.match(source, /textShadowRadius: 3/);
  assert.match(source, /formatBasePrice\(item\.price\)/);
  assert.doesNotMatch(source, /\{dish\.priceRange\}/);
  assert.doesNotMatch(source, /\{item\.priceRange\}/);
  assert.match(source, /navigation\.navigate\(\"DishDetailV2\", \{ dishId: item\.id \}\)/);
  assert.match(navigatorSource, /const loadDishDetailScreenV2 =/);
  assert.match(navigatorSource, /getComponent=\{loadDishDetailScreenV2\} name="DishDetailV2"/);
  assert.match(navigationTypes, /DishDetailV2: \{ dishId\?: string; id\?: string \};/);
  assert.match(
    mockDataSource,
    /const FOOD_1 =\s*"https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/7\/71\/Hainanese_Chicken_Rice\.jpg"/,
  );
  assert.match(launcherSource, /function getSampleDish\(repository = getLauncherRepository\(\)\)/);
  assert.match(launcherSource, /const \{ dishes \} = getMockData\(\);/);
  assert.match(launcherSource, /repository\.listPopularNearby\(\)\[0\] \?\? dishes\[0\]/);
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
