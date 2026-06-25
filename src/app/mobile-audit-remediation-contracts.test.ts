import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { assertSourceIncludes, readRepoFile } from "@/test/sourceContracts";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((entry) => {
    const relativePath = path.join(dir, entry);
    const fullPath = path.join(root, relativePath);
    if (statSync(fullPath).isDirectory()) {
      return listSourceFiles(relativePath);
    }
    return /\.(ts|tsx)$/.test(entry) ? [relativePath] : [];
  });
}

test("mobile audit config has production splash, Android media permissions, and no example DSN", () => {
  const appConfig = JSON.parse(read("app.config.base.json")) as {
    expo: {
      splash?: { image?: string; resizeMode?: string; backgroundColor?: string };
      android?: { permissions?: string[] };
    };
  };
  const envExample = read(".env.example");

  assert.deepEqual(appConfig.expo.splash, {
    image: "./assets/images/Logo/hungry_logo_icon_transparent.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  });
  for (const permission of [
    "android.permission.CAMERA",
    "android.permission.READ_MEDIA_IMAGES",
    "android.permission.READ_MEDIA_VIDEO",
    "android.permission.READ_EXTERNAL_STORAGE",
  ]) {
    assert.ok(appConfig.expo.android?.permissions?.includes(permission), permission);
  }
  assert.match(envExample, /^EXPO_PUBLIC_SENTRY_DSN=$/m);
  assert.doesNotMatch(envExample, /sentry\.io/);
});

test("mobile audit accessibility lint rule is installed and enabled", () => {
  const eslintConfig = read("eslint.config.js");
  const packageJson = JSON.parse(read("package.json")) as {
    devDependencies?: Record<string, string>;
  };

  assert.ok(packageJson.devDependencies?.["eslint-plugin-react-native-a11y"]);
  assert.match(eslintConfig, /require\("eslint-plugin-react-native-a11y"\)/);
  assert.match(eslintConfig, /"react-native-a11y\/has-accessibility-props": "warn"/);
});

test("mobile audit wraps critical review and post-composer roots with recoverable boundaries", () => {
  const review = readRepoFile("src/app/screens/review/ReviewScreen.tsx");
  const composer = readRepoFile("src/app/screens/post/PostComposerScreen.tsx");

  assertSourceIncludes(
    review,
    [
      /<FeedErrorBoundary[\s\S]*screenName="ReviewScreen"/,
      /title="Review editor failed"/,
      /getHungryService\(\)\.reviews\.submitReview/,
    ],
    "ReviewScreen",
  );
  assertSourceIncludes(
    composer,
    [
      /<FeedErrorBoundary[\s\S]*screenName="PostComposerScreen"/,
      /title="Post composer failed"/,
      /publishComposerPost\(/,
    ],
    "PostComposerScreen",
  );
});

test("mobile audit flow contracts cover review, post, taste quiz, and filtered search paths", () => {
  const review = readRepoFile("src/app/screens/review/ReviewScreen.tsx");
  const composer = readRepoFile("src/app/screens/post/PostComposerScreen.tsx");
  const tasteQuiz = readRepoFile("src/app/screens/onboarding/TasteQuizScreen.tsx");
  const search = readRepoFile("src/app/screens/search/SearchResultsScreen.tsx");

  assertSourceIncludes(
    review,
    [
      /getHungryService\(\)\.reviews\.submitReview\(\{/,
      /trackAnalyticsEvent\("review_submitted"/,
      /navigation\.popToTop\(\)/,
    ],
    "review submission flow",
  );
  assertSourceIncludes(
    composer,
    [
      /publishComposerPost\(\{[\s\S]*publishMode: "post"/,
      /composer\.setCaption\(/,
      /composer\.addMedia\(selectedMedia\)/,
      /composer\.reset\(\)/,
    ],
    "post composer publish flow",
  );
  assertSourceIncludes(
    tasteQuiz,
    [/setTasteVector\(values\)/, /setDietaryPreferences\(dietaryPreferences\)/],
    "taste quiz persistence flow",
  );
  assertSourceIncludes(
    search,
    [
      /getSearchResultsAsync\(filters, profile\.tasteVector\)/,
      /onSubmitQuery=\{recordCommittedSearchQuery\}/,
      /rememberSearch\(filters\.query\)/,
    ],
    "search filter submission flow",
  );
});

test("mobile audit reduce-motion hook is shared by animated production surfaces", () => {
  const hook = readRepoFile("src/hooks/useReduceMotion.ts");
  const animatedFiles = [
    "src/app/screens/home/StoryViewerScreen.tsx",
    "src/components/social/BiteCard.tsx",
    "src/components/social/ZoomableMedia.tsx",
    "src/components/gamification/CredEarnedToast.tsx",
    "src/components/gamification/FoodCredBadge.tsx",
    "src/components/gamification/PassportPageFlip.tsx",
    "src/components/gamification/PassportStampCard.tsx",
  ];

  assertSourceIncludes(
    hook,
    [/AccessibilityInfo\.isReduceMotionEnabled/, /reduceMotionChanged/, /reducedMotionEnabled/],
    "useReduceMotion",
  );
  for (const file of animatedFiles) {
    const source = readRepoFile(file);
    assert.match(source, /useReduceMotion/, `${file} must consume useReduceMotion`);
  }
});

test("mobile audit keeps mock fixture data out of production source imports", () => {
  const serviceProvider = readRepoFile("src/lib/services/serviceProvider.ts");
  const productionImports = listSourceFiles("src").filter((file) => {
    if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) return false;
    if (file === "src/app/screens/dev/DeveloperLauncherScreen.tsx") return false;
    const source = readRepoFile(file);
    return /from ["']@\/lib\/services\/mock\/data["']|from ["'].*lib\/services\/mock\/data["']/.test(
      source,
    );
  });

  assert.deepEqual(productionImports, []);
  assert.match(serviceProvider, /function createMockProvider\(\)/);
  assert.match(serviceProvider, /require\("@\/lib\/services\/mock\/mockService"\)/);
  assert.match(serviceProvider, /require\("@\/lib\/services\/mock\/repositories"\)/);
  assert.doesNotMatch(serviceProvider, /from ["']@\/lib\/services\/mock\/data["']/);
});
