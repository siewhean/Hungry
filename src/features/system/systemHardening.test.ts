import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Sprint 6: required screens are wrapped by FeedErrorBoundary", () => {
  const screensWithBoundary = [
    "src/app/screens/auth/LoginScreen.tsx",
    "src/app/screens/auth/SignUpScreen.tsx",
    "src/app/screens/detail/DishDetailScreen.tsx",
    "src/app/screens/detail/StallDetailScreen.tsx",
    "src/app/screens/profile/ProfileStack.tsx",
    "src/app/screens/discover/HomeMapScreen.tsx",
  ];

  for (const screenPath of screensWithBoundary) {
    const content = fs.readFileSync(path.resolve(screenPath), "utf8");
    assert.ok(
      content.includes("FeedErrorBoundary"),
      `Screen ${screenPath} should be wrapped with FeedErrorBoundary`,
    );
  }
});

test("Sprint 6: dead files are removed", () => {
  const deadFiles = [
    "src/app/screens/discover/HomeMapScreen (1).tsx",
    "src/app/screens/discover/BuildingInfoSheet.tsx",
    "src/app/screens/discover/DiscoverTabScreen.tsx",
    ".tmp_todo_current.md",
  ];

  for (const file of deadFiles) {
    assert.ok(!fs.existsSync(path.resolve(file)), `File ${file} should have been deleted`);
  }
});

test("Sprint 6: environment template exists", () => {
  assert.ok(fs.existsSync(path.resolve(".env.example")), ".env.example should exist");
});

test("Sprint 6: detail fallback copy matches expected content", () => {
  const specPath = "docs/audit/ERR_BOUNDARY_SPEC.md";
  const content = fs.readFileSync(path.resolve(specPath), "utf8");

  // Verify specific fallback copy from Gemini spec
  assert.ok(content.includes("Details unavailable"), "Spec should define detail error title");
  assert.ok(
    content.includes("We couldn't load those delicious details"),
    "Spec should define detail error body",
  );
});
