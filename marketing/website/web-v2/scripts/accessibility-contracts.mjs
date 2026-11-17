import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function requireMarker(sourceText, marker, file) {
  if (!sourceText.includes(marker)) {
    failures.push(`${file} is missing marker: ${marker}`);
  }
}

const appLayout = await source("src/components/layout/AppLayoutWrapper.tsx");
const globals = await source("src/app/globals.css");
const consoleLayout = await source("src/app/console/ConsoleClientLayout.tsx");
const merchantLayout = await source("src/app/merchant/MerchantClientLayout.tsx");
const merchantLogin = await source("src/app/merchant/login/page.tsx");
const merchantSignup = await source("src/app/merchant/signup/page.tsx");
const merchantForgot = await source("src/app/merchant/forgot-password/page.tsx");

async function requireDialogSemantics(relativePath) {
  const file = await source(relativePath);
  const lines = file.split("\n");

  lines.forEach((line, index) => {
    if (!line.includes("styles.modalCard") && !line.includes("styles.drawerPanel")) return;

    const elementBlock = lines.slice(index, index + 12).join("\n");
    if (!elementBlock.includes('role="dialog"')) {
      failures.push(`${relativePath}:${index + 1} is missing role="dialog" on modal/drawer panel.`);
    }
    if (!elementBlock.includes('aria-modal="true"')) {
      failures.push(`${relativePath}:${index + 1} is missing aria-modal="true" on modal/drawer panel.`);
    }
    if (!elementBlock.includes("aria-label=") && !elementBlock.includes("aria-labelledby=")) {
      failures.push(`${relativePath}:${index + 1} is missing an accessible modal/drawer label.`);
    }
  });
}

requireMarker(appLayout, 'className="skipLink"', "AppLayoutWrapper.tsx");
requireMarker(appLayout, 'href="#main-content"', "AppLayoutWrapper.tsx");
requireMarker(appLayout, 'id="main-content"', "AppLayoutWrapper.tsx");
requireMarker(globals, ".skipLink", "globals.css");
requireMarker(globals, ".skipLink:focus-visible", "globals.css");
requireMarker(globals, '[tabindex="-1"]:focus', "globals.css");
requireMarker(consoleLayout, 'id="main-content"', "console/ConsoleClientLayout.tsx");
requireMarker(consoleLayout, "tabIndex={-1}", "console/ConsoleClientLayout.tsx");
requireMarker(merchantLayout, 'id="main-content"', "merchant/MerchantClientLayout.tsx");
requireMarker(merchantLayout, "tabIndex={-1}", "merchant/MerchantClientLayout.tsx");
requireMarker(merchantLogin, "<main", "merchant/login/page.tsx");
requireMarker(merchantLogin, 'id="main-content"', "merchant/login/page.tsx");
requireMarker(merchantLogin, "tabIndex={-1}", "merchant/login/page.tsx");
requireMarker(merchantSignup, "<main", "merchant/signup/page.tsx");
requireMarker(merchantSignup, 'id="main-content"', "merchant/signup/page.tsx");
requireMarker(merchantSignup, "tabIndex={-1}", "merchant/signup/page.tsx");
requireMarker(merchantForgot, "<main", "merchant/forgot-password/page.tsx");
requireMarker(merchantForgot, 'id="main-content"', "merchant/forgot-password/page.tsx");
requireMarker(merchantForgot, "tabIndex={-1}", "merchant/forgot-password/page.tsx");

await Promise.all([
  requireDialogSemantics("src/app/console/feature-flags/page.tsx"),
  requireDialogSemantics("src/app/console/feedback/page.tsx"),
  requireDialogSemantics("src/app/console/merchant-applications/page.tsx"),
  requireDialogSemantics("src/app/console/merchants/page.tsx"),
  requireDialogSemantics("src/app/console/notifications/page.tsx"),
  requireDialogSemantics("src/app/console/reports/page.tsx"),
  requireDialogSemantics("src/app/console/users/page.tsx"),
  requireDialogSemantics("src/app/merchant/menu/page.tsx"),
  requireDialogSemantics("src/app/merchant/page.tsx"),
  requireDialogSemantics("src/app/merchant/promotions/page.tsx"),
  requireDialogSemantics("src/app/merchant/reviews/page.tsx"),
  requireDialogSemantics("src/app/merchant/settings/page.tsx"),
  requireDialogSemantics("src/app/merchant/verification/page.tsx"),
]);

if (failures.length > 0) {
  console.error("Accessibility contracts failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Accessibility contracts passed.");
