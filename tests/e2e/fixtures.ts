import { test as base, expect, type Page, type TestInfo } from "@playwright/test";

export type PageIssue = {
  type: "console" | "pageerror" | "requestfailed" | "response";
  message: string;
  url?: string;
  status?: number;
};

function isKnownNonCriticalIssue(issue: PageIssue) {
  const message = issue.message;
  const url = issue.url ?? "";
  return (
    message.includes("React DevTools") ||
    message.includes('"shadow*" style props are deprecated') ||
    message.includes('"textShadow*" style props are deprecated') ||
    message.includes("props.pointerEvents is deprecated") ||
    message.includes("Animated: `useNativeDriver` is not supported") ||
    message.includes("Failed to load resource: the server responded with a status of 400") ||
    url.includes("us-assets.i.posthog.com") ||
    url.includes("i.posthog.com") ||
    url.includes("/symbolicate") ||
    url.endsWith(".map")
  );
}

function collectPageIssues(page: Page) {
  const issues: PageIssue[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      issues.push({
        type: "console",
        message: message.text(),
      });
    }
  });

  page.on("pageerror", (error) => {
    issues.push({
      type: "pageerror",
      message: error.message,
    });
  });

  page.on("requestfailed", (request) => {
    const resourceType = request.resourceType();
    if (["document", "script", "xhr", "fetch"].includes(resourceType)) {
      issues.push({
        type: "requestfailed",
        message: request.failure()?.errorText ?? "Request failed",
        url: request.url(),
      });
    }
  });

  page.on("response", (response) => {
    const resourceType = response.request().resourceType();
    if (response.status() >= 400 && ["document", "script", "xhr", "fetch"].includes(resourceType)) {
      issues.push({
        type: "response",
        message: `${response.status()} ${response.statusText()}`,
        status: response.status(),
        url: response.url(),
      });
    }
  });

  return issues;
}

async function attachPageIssues(testInfo: TestInfo, issues: PageIssue[]) {
  if (!issues.length) {
    return;
  }

  await testInfo.attach("page-issues.json", {
    body: JSON.stringify(issues, null, 2),
    contentType: "application/json",
  });
}

export const test = base.extend<{ pageIssues: PageIssue[] }>({
  pageIssues: [
    async ({ page }, use, testInfo) => {
      const issues = collectPageIssues(page);
      await use(issues);
      await attachPageIssues(testInfo, issues);

      const criticalIssues = issues.filter((issue) => !isKnownNonCriticalIssue(issue));
      expect
        .soft(criticalIssues, "No critical page errors, console errors, or failed app requests")
        .toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
