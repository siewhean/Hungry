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
  // Google/Apple (and the "or" divider) are hidden, not shown disabled, when the flag is off;
  // while a request runs every auth button is disabled and the submit shows loading.
  assert.match(
    source,
    /\{oauthProvidersEnabled \? \([\s\S]*<AuthProviderButton[\s\S]*disabled=\{isBusy\}[\s\S]*intent="continue"[\s\S]*provider="apple"[\s\S]*provider="google"[\s\S]*\) : null\}/,
  );
  assert.match(source, /loading=\{isSubmitting\}/);
  assert.doesNotMatch(source, /disabled=\{!oauthProvidersEnabled\}/);
  assert.match(signUpSource, /AUTH_COPY\.signUp/);
  assert.match(signUpSource, /FEATURE_FLAGS\.oauthProvidersEnabled/);
  assert.match(
    signUpSource,
    /\{oauthProvidersEnabled \? \([\s\S]*<AuthProviderButton[\s\S]*disabled=\{isBusy\}[\s\S]*intent="continue"[\s\S]*provider="apple"[\s\S]*provider="google"[\s\S]*\) : null\}/,
  );
  assert.match(signUpSource, /loading=\{isSubmitting\}/);
  assert.doesNotMatch(signUpSource, /disabled=\{!oauthProvidersEnabled\}/);
  // Password managers: email, current-password on Login, new-password with rules on SignUp.
  assert.match(source, /autoComplete="email"/);
  assert.match(source, /autoComplete="current-password"/);
  assert.match(signUpSource, /autoComplete="new-password"/);
  assert.match(signUpSource, /passwordRules=\{PASSWORD_RULES\}/);
  assert.match(forgotPasswordSource, /AUTH_COPY\.forgotPassword/);
  assert.match(source, /<FeedErrorBoundary/);
  assert.match(authCopySource, /login: \{/);
  assert.match(authCopySource, /signUp: \{/);
  assert.match(authCopySource, /forgotPassword: \{/);
  assert.match(authCopySource, /getAuthProviderButtonLabel/);
  assert.doesNotMatch(authCopySource, /getAuthProviderUnavailableButtonLabel|Supabase Auth/);
  assert.match(authCopySource, /getAuthProviderUnavailableMessage/);
  assert.match(authCopySource, /getSignUpProviderSuccessMessage/);
  assert.doesNotMatch(source, /"Welcome back\."/);
  assert.doesNotMatch(signUpSource, /"Account created\. Please verify your email\."/);
  assert.doesNotMatch(forgotPasswordSource, /"If the email exists, a reset link was sent\."/);
  assert.match(providerButtonSource, /import \{ AppleLogo, GoogleLogo \}/);
  assert.match(providerButtonSource, /position: "absolute"/);
  assert.match(providerButtonSource, /textAlign: "center"/);
  assert.match(providerButtonSource, /getAuthProviderButtonLabel\(provider, intent\)/);
  assert.doesNotMatch(providerButtonSource, /getAuthProviderUnavailableButtonLabel/);
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
  assert.match(resetPasswordSource, /"Back to sign in"/);
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
  // One confirmation: the success modal, not a toast on top of it.
  assert.doesNotMatch(source, /message: "Review posted!"/);
  assert.match(source, /<FeedErrorBoundary/);
});

test("Sprint 9 screen contract: onboarding icon controls and location rows are labelled", () => {
  const locationPermission = read("src/app/screens/onboarding/LocationPermissionScreen.tsx");
  const manualLocation = read("src/app/screens/onboarding/ManualLocationPickerScreen.tsx");
  const tasteProfileResult = read("src/app/screens/onboarding/TasteProfileResultScreen.tsx");
  const tasteQuiz = read("src/app/screens/onboarding/TasteQuizScreen.tsx");

  assert.match(locationPermission, /accessibilityLabel="Back to welcome"/);
  assert.match(locationPermission, /accessibilityHint="Returns to the welcome screen"/);
  assert.match(manualLocation, /accessibilityLabel="Go back"/);
  // From Settings (already onboarded) Continue saves and returns; first run moves on to the quiz.
  assert.match(
    manualLocation,
    /if \(!isOnboarding\) \{[\s\S]*?navigation\.goBack\(\);[\s\S]*?return;[\s\S]*?navigation\.navigate\("TasteQuiz"\)/,
  );
  assert.match(
    manualLocation,
    /accessibilityLabel="Search for an area, mall, hawker centre or address"/,
  );
  assert.match(manualLocation, /accessibilityLabel=\{`Choose \$\{result\.title\}`\}/);
  assert.match(
    tasteProfileResult,
    /accessibilityLabel=\{`\$\{isSaved \? "Unsave" : "Save"\} \$\{dish\.name\}`\}/,
  );
  assert.match(tasteProfileResult, /"Saved once you create your account at the end of setup"/);
  // Signed-in users save for real; signed-out users are told the account step comes last.
  assert.match(
    tasteProfileResult,
    /if \(isAuthenticated\) \{\s*void toggleFavourite\(dish\)[\s\S]*return;\s*\}/,
  );
  // Saving a dish never opens the account step early; it is the step after Done.
  assert.doesNotMatch(tasteProfileResult, /setPendingSaveDish/);
  assert.match(
    tasteProfileResult,
    /if \(!isAuthenticated\) \{\s*navigation\.navigate\("OnboardingAuth"\);\s*return;/,
  );
  // Result is ranked by the quiz taste vector, not a fixed popular list.
  assert.match(tasteProfileResult, /tasteValues: tasteVector/);
  assert.match(tasteProfileResult, /searchDishes\(getResultFilters\(\), tasteVector\)/);
  // Supabase has no cached catalog during onboarding, so the screen asks the server's
  // taste ranking (with the user's vector and a real radius that widens), and only says
  // "Picked to match your taste" when the list came from taste ranking.
  assert.match(
    tasteProfileResult,
    /recommendations\.getSlate\(\{[\s\S]*?tasteProfile: tasteVector,/,
  );
  assert.match(tasteProfileResult, /TASTE_PICK_RADII_METERS = \[3000, 10000, undefined\]/);
  assert.doesNotMatch(tasteProfileResult, /getSearchResultsAsync/);
  // p_radius_meters is an integer: a "no limit" MAX_SAFE_INTEGER radius is sent as null.
  assert.match(
    read("src/lib/services/supabase/supabaseService.ts"),
    /p_radius_meters: toRpcRadiusMeters\(request\.radiusMeters\)/,
  );
  assert.match(
    tasteProfileResult,
    /dishes\.length > 0 && tasteRanked\s*\? "Picked to match your taste/,
  );
  assert.doesNotMatch(tasteProfileResult, /generated food photo/);
  // The three cards of a question are one radio group (r2 onboarding-L9).
  assert.match(tasteQuiz, /accessibilityRole="radiogroup"/);
  assert.match(
    tasteQuiz,
    /accessibilityRole="radio"[\s\S]*accessibilityLabel=\{`\$\{QUESTIONS\[currentKey\]\} \$\{labels\[index\]\}`\}/,
  );
  assert.match(tasteQuiz, /accessibilityHint=\{`For example, \$\{choiceFoods\[index\]\.label\}`\}/);
  assert.match(
    tasteQuiz,
    /accessibilityState=\{\{ checked: isSelected, disabled: isTransitioning \}\}/,
  );
  assert.match(
    tasteQuiz,
    /accessibilityRole="checkbox"[\s\S]*accessibilityLabel=\{`Dietary preference \$\{label\}`\}/,
  );
  assert.match(tasteQuiz, /accessibilityState=\{\{ checked: isSelected \}\}/);
  assert.match(tasteQuiz, /const \{ fontScale, height, width \} = useWindowDimensions\(\)/);
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
    /accessibilityRole="button"[\s\S]*accessibilityLabel=\{menuDishAccessibilityLabel\(dish\)\}/,
  );
  // The label carries the price, or "sold out today" (detail-L24).
  assert.match(stallDetail, /\$\{dish\.name\}, sold out today/);
  assert.match(stallDetail, /accessibilityHint="Opens this dish detail page"/);
});

test("Sprint 9 screen contract: Search cards expose actionable semantics", () => {
  const search = read("src/app/screens/search/DishSearchScreen.tsx");
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");

  assert.match(search, /accessibilityLabel="Search dishes, stalls, or hawker centres"/);
  assert.match(rootNavigator, /accessibilityLabel="Go back"/);
  assert.match(rootNavigator, /accessibilityHint="Returns to the previous screen"/);
});

test("Sprint 9 screen contract: Home feed interactions are wired for like/save/comment/share", () => {
  // The post card lives in its own component: read the screen and the card together.
  const source = [
    read("src/app/screens/home/HomeFeedScreen.tsx"),
    read("src/components/social/FeedPostCard.tsx"),
  ].join("\n");
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
  assert.match(source, /const bundle = await getHomeFeedBundle\(profileRef\.current,\s*\{/);
  assert.match(source, /followedAuthors,/);
  assert.match(source, /followedUserIds,/);
  assert.match(source, /refreshSeed: feedRefreshSeedRef\.current/);
  assert.match(source, /initializeInteractions\(bundle\.socialFeed, now\)/);
  assert.doesNotMatch(source, /bundle\.sections/);
  assert.doesNotMatch(source, /mode === "social"/);
  assert.match(source, /const \[activeShareItem, setActiveShareItem\]/);
  assert.match(source, /const shareSheetRef = useRef<BottomSheetModal>\(null\)/);
  assert.match(source, /share: openShareSheet/);
  assert.match(source, /actions\.share\(item\)/);
  assert.match(source, /sendPostToHungryUsers/);
  assert.match(source, /sharePostToChat\(chatId,/);
  assert.match(source, /incrementPostShare\(activeShareItem\.id, "in_app"\)/);
  assert.match(source, /incrementPostShare\(activeShareItem\.id, "copy_link"\)/);
  assert.match(source, /incrementPostShare\(activeShareItem\.id, "system_share"\)/);
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
  assert.match(source, /Clipboard\.setStringAsync/);
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
  assert.match(source, /repliesByCommentId\[commentId\] \?\? \[\]/);
  assert.match(source, /visibleRepliesFor\(comment\.id\)\.map\(\(reply\)/);
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
  assert.match(source, /`Show \$\{item\.venue\.name\} on map`/);
  assert.match(source, /accessibilityLabel=\{`Open \$\{item\.authorName\} profile`\}/);
  assert.match(source, /accessibilityLabel=\{`Open \$\{item\.authorName\} profile photo`\}/);
  assert.match(
    source,
    /openUserProfile\([\s\S]*item\.authorName,[\s\S]*item\.authorAvatarUrl,[\s\S]*item\.authorLocation/,
  );
  assert.match(source, /onPress=\{\(\) => actions\.openVenue\(item\)\}/);
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
  assert.match(source, /const canUseAuthorFallbackFollow =/);
  assert.match(
    source,
    /canShowFollow=\{Boolean\(item\.authorId\) \|\| canUseAuthorFallbackFollow\}/,
  );
  assert.match(
    source,
    /followTargetId\s*\? Boolean\(state\.followedUserIds\[followTargetId\]\)\s*: Boolean\(state\.followedAuthors\[item\.authorName\]\)/,
  );
  assert.match(
    source,
    /followTargetId[\s\S]*\? toggleFollow\(followTargetId\)[\s\S]*: toggleAuthorFollow\(item\.authorName\)/,
  );
  assert.match(
    source,
    /accessibilityLabel=\{`\$\{isFollowRequested \? "Cancel follow request to" : isFollowingAuthor \? "Unfollow" : "Follow"\} \$\{item\.authorName\}`\}/,
  );
  assert.match(source, /style=\{\[\s*styles\.followButton/);
  assert.match(
    source,
    /\{isFollowRequested \? "Requested" : isFollowingAuthor \? "Following" : "Follow"\}/,
  );
  assert.match(source, /function formatPostAge\(createdAt: string\)/);
  assert.match(source, /const COLLAPSED_CAPTION_MAX_CHARS = 118/);
  assert.match(source, /function formatCollapsedCaption\(caption: string\)/);
  assert.match(source, /const \[captionOverflow, setCaptionOverflow\] = useState\(false\)/);
  assert.match(source, /const handleCaptionTextLayout = useCallback/);
  assert.match(source, /current === isOverflowing \|\| current/);
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
  assert.match(source, /setCarouselIndex/);
  // " more" expands the caption in place; comments open from the comment button.
  assert.match(source, /numberOfLines=\{isCaptionExpanded \? undefined : 2\}/);
  assert.match(source, /onTextLayout=\{handleCaptionTextLayout\}/);
  assert.match(source, /setIsCaptionExpanded\(true\)/);
  assert.match(source, /onPress=\{\(\) => actions\.openComments\(item\)\}/);
  assert.match(
    source,
    /captionOverflows && !isCaptionExpanded\s*\? formatCollapsedCaption\(item\.caption\)\s*: item\.caption/,
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
  assert.ok(profileFollowRowIndex >= 0);
  assert.ok(imageContainerIndex > profileFollowRowIndex);
  assert.ok(iconRowIndex > imageContainerIndex);
  assert.ok(captionRowIndex > iconRowIndex);
  // The post age moved from under the caption to the author row (one venue name, not two).
  assert.match(source, /\{postAgeLabel\}/);
  assert.doesNotMatch(source, /Row 1: Profile & Icons Inline/);
  assert.match(mapSource, /highlightedStallVenueId/);
  assert.match(
    mapSource,
    /selectedMarkerId=\{\s*selectedVenueId \|\| highlightedStallVenueId\s*\? `stall-\$\{selectedVenueId \?\? highlightedStallVenueId\}`\s*: undefined\s*\}/,
  );
  assert.doesNotMatch(source, /interaction\.saveCount > 0/);
  assert.doesNotMatch(source, /localCommentsByPostId/);
  assert.doesNotMatch(source, /localRepliesByCommentId/);
});

test("Sprint 9 screen contract: Home feed double tap likes with heart animation", () => {
  const source = read("src/components/social/FeedPostCard.tsx");

  assert.match(source, /const DOUBLE_TAP_DELAY_MS = 280/);
  assert.match(source, /lastTapAtRef/);
  assert.match(source, /singleTapTimerRef/);
  assert.match(source, /handleImagePress/);
  assert.match(
    source,
    /<ZoomableMedia[\s\S]*onPress=\{\(event\) => handleImagePress\(event, false\)\}/,
  );
  assert.match(source, /event\.nativeEvent\.locationX/);
  assert.match(source, /event\.nativeEvent\.locationY/);
  assert.doesNotMatch(source, /const targetDishId = item\.dishes\[0\]\?\.id \?\? item\.venueId/);
  assert.doesNotMatch(source, /navigateToDish\(targetDishId\)/);
  assert.match(source, /if \(!useSocialStore\.getState\(\)\.interactions\[item\.id\]\?\.liked\)/);
  assert.match(source, /actions\.like\(item\)/);
  assert.match(source, /runHeartBurst/);
  assert.match(source, /duration: 980/);
  assert.match(source, /heartBurst\?\.x \?\? screenWidth \/ 2/);
  assert.match(source, /heartBurst\?\.y \?\? imageHeight \/ 2/);
  assert.match(source, /const likeIconTargetTranslateX =/);
  assert.match(
    source,
    /const likeIconTargetTranslateY =\s*imageHeight \+ spacing\[3\] \+ 32 \+ spacing\[2\] \+ 12 -/,
  );
  assert.match(source, /<Animated\.View/);
  assert.match(source, /const authorRowHeight = spacing\[3\] \* 2 \+ 32/);
  assert.match(source, /top: authorRowHeight \+ heartBurst\.y - 42/);
  assert.match(source, /left: heartBurst\.x - 42/);
  assert.match(source, /<Heart color=\{palette\.error\} fill=\{palette\.error\} size=\{84\}/);
  assert.match(source, /translateX: heartBurstAnim\.interpolate/);
  assert.match(source, /translateY: heartBurstAnim\.interpolate/);
  assert.match(source, /inputRange: \[0, 0\.38, 0\.55, 1\]/);
  assert.match(
    source,
    /outputRange: \[0, 0, likeIconTargetTranslateX \* 0\.35, likeIconTargetTranslateX\]/,
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
  assert.match(source, /const feedRefreshSeedRef = useRef\(0\)/);
  assert.match(source, /const refreshHomeFeed = useCallback\(async \(\) =>/);
  assert.match(source, /setIsRefreshing\(true\)/);
  assert.match(source, /feedRefreshSeedRef\.current \+= 1/);
  assert.match(source, /await loadFeed\(\{ force: true, showLoading: false \}\)/);
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

  assert.match(source, /<AppHeader[\s\S]*title="Home"/);
  assert.match(source, /horizontalPadding=\{semanticSpacing\.screenEdge\}/);
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

  // The Home feed is newest-first (followed authors first); it runs no taste ranking.
  assert.doesNotMatch(homeFeedSource, /runRecommendationPipeline/);
  assert.match(mockRepositorySource, /runRecommendationPipeline\(results/);
  assert.match(supabaseRepositorySource, /runRecommendationPipeline\(matched/);
  assert.match(searchSource, /discovery\.searchDishes\(/);
  assert.match(homeScreenSource, /recordTasteInteraction/);
  assert.match(homeScreenSource, /type: "dish_like"/);
  assert.match(profileStoreSource, /recommendations\.recordExplicitFeedback/);
  assert.match(discoverSource, /type: "search_query"/);
  assert.match(discoverSource, /type: "dish_result_click"/);
  assert.match(searchScreenSource, /type: "search_query"/);
  assert.match(searchScreenSource, /type: "dish_result_click"/);
  assert.match(searchScreenSource, /lastRecordedQueryRef\.current === key\) return/);
  assert.match(decideSource, /type: "dismissed"/);
  assert.match(decideSource, /type: "food_button_click"/);
  assert.doesNotMatch(decideSource, /dish: nextDish,[\s\S]*buttonId: "try_another_pick"/);
});

test("Sprint 9 screen contract: routed dish detail uses gallery-backed share flow", () => {
  const source = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const navigatorSource = read("src/app/navigation/RootNavigator.tsx");

  assert.match(source, /const repository = getDataRepository\(\)/);
  assert.match(source, /buildDishGallery\(dish\)/);
  assert.match(source, /const canonicalDishUrl = webShareUrl\("dish", dish\.id\)/);
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
  assert.match(source, /type Props = NativeStackScreenProps<RootStackParamList, "DishDetail">/);
  assert.match(source, /buildDishGallery\(dish\)/);
  // Unpriced dishes show the range or "Price not listed", never S$0.00.
  assert.match(read("src/features/detail/dishPrice.ts"), /function formatDishPrice\(/);
  assert.match(read("src/features/detail/dishPrice.ts"), /Price not listed/);
  assert.match(source, /const dishPrice = formatDishPrice\(dish\)/);
  assert.match(source, /fontSize: 28, lineHeight: 34/);
  assert.match(source, /const heroGradientColors: readonly \[ColorValue, ColorValue, ColorValue\]/);
  assert.match(source, /palette\.detailHeroGradientStart/);
  assert.match(source, /palette\.detailHeroGradientMid/);
  assert.match(source, /palette\.bg/);
  assert.match(source, /colors=\{heroGradientColors\}/);
  assert.match(source, /locations=\{\[0, 0\.58, 1\]\}/);
  assert.doesNotMatch(source, /Epicurean Discovery/);
  assert.doesNotMatch(source, /borderBottomWidth: 1,[\s\S]*Epicurean Discovery/);
  assert.match(source, /How it tastes to you/);
  // Owner decision (round 2): similar dishes nearby replace the hours on the dish page.
  assert.match(source, /useSimilarDishesNearby\(/);
  assert.match(source, /More from \{venueName\}/);
  assert.match(source, /<AppText variant="h2">Community Palate Feedback<\/AppText>/);
  assert.match(source, /const cachedVenueDishes = useMemo/);
  // Never repeats the dish being viewed.
  assert.match(source, /getMoreFromStall\(dish, venueDishes\)/);
  assert.match(source, /if \(dish\.id !== currentDish\.id\)/);
  assert.doesNotMatch(source, /supplementalDishes/);
  assert.match(source, /const signatureGridItemWidth = Math\.min\(width \* 0\.56, 220\)/);
  assert.match(source, /marginHorizontal: -spacing\[4\]/);
  assert.match(source, /moreFromStall\.map/);
  assert.match(source, /horizontal\s+showsHorizontalScrollIndicator=\{false\}/);
  assert.match(source, /height: signatureGridItemWidth \* 0\.62/);
  assert.match(source, /width: signatureGridItemWidth/);
  assert.match(source, /backgroundColor: palette\.surface/);
  assert.match(source, /formatDishPrice\(item\)/);
  assert.doesNotMatch(source, /\{dish\.priceRange\}/);
  assert.doesNotMatch(source, /\{item\.priceRange\}/);
  // push, so Back returns to the previous dish.
  assert.match(source, /navigation\.push\("DishDetail", \{ dishId: item\.id \}\)/);
  assert.match(navigatorSource, /const loadDishDetailScreenV2 =/);
  // The redundant DishDetailV2 alias route was removed; DishDetail is the V2 screen.
  assert.doesNotMatch(navigatorSource, /name="DishDetailV2"/);
  assert.doesNotMatch(navigationTypes, /DishDetailV2:/);
  assert.match(
    mockDataSource,
    /const FOOD_1 =\s*"https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/7\/71\/Hainanese_Chicken_Rice\.jpg"/,
  );
  assert.match(launcherSource, /function getSampleDish\(repository = getLauncherRepository\(\)\)/);
  assert.match(launcherSource, /const \{ dishes \} = getMockData\(\);/);
  assert.match(launcherSource, /repository\.listPopularNearby\(\)\[0\] \?\? dishes\[0\]/);
  assert.match(launcherSource, /const openSampleDishDetail = \(\) =>/);
  assert.match(launcherSource, /completeAuth\(\);[\s\S]*completeOnboarding\(false\);/);
  assert.match(launcherSource, /navigation\.navigate\("DishDetail", \{ dishId: dish\.id \}\)/);
  assert.match(launcherSource, /label="Dish"[\s\S]*onPress=\{\(\) => openSampleDishDetail\(\)\}/);
});

test("search home hands every query to the paged results and keeps a see-all action", () => {
  const search = read("src/app/screens/search/DishSearchScreen.tsx");

  assert.doesNotMatch(search, /getSearchResultsAsync|inlineResults/);
  assert.match(search, /"See all results"/);
  assert.match(
    search,
    /navigation\.navigate\("SearchResults", \{[\s\S]*?initialQuery: trimmedQuery \|\| undefined,/,
  );
});
