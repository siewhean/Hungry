import { readFile } from "node:fs/promises";
import path from "node:path";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  footerBrand,
  footerSections,
  isActiveSiteHref,
  isExternalFooterHref,
  mainNavLinks,
  siteBrand,
  waitlistLink,
} from "../_components/footerData";

type StitchOptions = {
  waitlistForm?: boolean;
};

const STITCH_HTML_DIR = path.join(process.cwd(), "stitch", "html");

const DIRECT_LINKS: [RegExp, string][] = [
  [/href="#">For Foodies/g, 'href="/for-foodies">For Foodies'],
  [/href="#">For Merchants/g, 'href="/for-merchants">For Merchants'],
  [/href="#">About/g, 'href="/about">About'],
  [/href="#">Merchant Portal/g, 'href="/merchant/login">Merchant Portal'],
  [/href="#">Privacy Policy/g, 'href="/privacy">Privacy Policy'],
  [/href="#">Terms of Service/g, 'href="/terms">Terms of Service'],
];

const VISUAL_MENU_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCdYDrvxyqyFaICeK_UZgc8NBJqXP7OFu83U011VW8FrhTgPYpVQV-GeRGw0q_KhcRTsthuWmEn_0-Fk46Kc18tP3ysd4Sgr1Gvnb7edHDnfkFjitVSwnuXT3FdmA6Hnb08FP_UHHiz1rioxVOq8CWrY82bj3Z5w0g__l3S41N92cBx3kZRTt19sZeg-d5ltcRrqmKN6T3pJEuPmQQjUENWA5VNjZhm0l88hVNIPqn6inLLrYszUUdlCwiutFMsdQses9MMBl_cZas";

const MERCHANT_HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBlPI9jMs2n7IunTLaQRKYj9Vamm7qK95k1-EJV83SsRMeNav-oab3mL2bZFh70C6FSCZwGnf0fpxSSApXGgOGVkiUer2J36DvtZN5fjYBlWaN5jPpYB-snGsm1B9ny_nBDdFg1pRSuavAVf4n2dmDkHVbYCpukugenXtKxymeRyGvrspXmlJW9ZHhzMZp8dtLiivABoMfFfBRcWfi4oNt3TvBYA_ZC3gICXMoF5l-qB93VFEIDMX-hS8im9nIf-1-ceDvcwCOSFkw";

const MERCHANT_LOGIN_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBoFAO4jtL7MU9Rk0PCbpALmY1T0J0XaJpIo-0gXVBpeenjB8CVn6ksKKn8bGaV1NKv2S5MZirflmce7f2lR5HAQ1FKJ3lBQgklIDXjRlSHxst0wvMuRKIHQaKq3AtfRBRcrWiLLRpWoOBX8Vyx94wDVozyyLY0rvoWYoD6_BnKPxpdbjFswIq_ZbDXL8d7TtQprcY6EDBnYyr_Xq5pLEE4jJ49WbFS-VQK0hmLJC5RHaONKdYJf94HN1nXi8LWo1Cu109FDPAeoxs";

const HOME_BASED_IMAGE = MERCHANT_LOGIN_IMAGE;

function makeWaitlistFormSubmittable(html: string, request: NextRequest): string {
  const params = new URL(request.url).searchParams;
  const submitted = params.get("submitted") === "1";
  const errored = params.has("error");

  const nextHtml = html
    .replace(/<form\b([^>]*)>/i, (_match, attrs: string) => {
      const cleanedAttrs = attrs
        .replace(/\saction=(["']).*?\1/g, "")
        .replace(/\smethod=(["']).*?\1/g, "");

      return `<form action="/api/waitlist" method="post"${cleanedAttrs}>`;
    })
    .replaceAll('name="user_type"', 'name="joining_as"')
    .replaceAll('value="foodie"', 'value="diner"')
    .replaceAll('value="merchant"', 'value="hawker"');

  if (!submitted && !errored) {
    return nextHtml;
  }

  const banner = submitted
    ? '<div class="mb-lg rounded-lg border border-autumn-green bg-[#EEF5E5] p-md text-autumn-green font-body-sm text-body-sm">You are on the list. We will send Hungry launch updates to your inbox.</div>'
    : `<div class="mb-lg rounded-lg border border-error bg-error-container p-md text-on-error-container font-body-sm text-body-sm">${errorMessageForWaitlist(params.get("error"))}</div>`;

  return nextHtml.replace(/<form\b/i, `${banner}<form`);
}

function errorMessageForWaitlist(error: string | null): string {
  const errors = new Set((error ?? "").split(",").filter(Boolean));
  const messages: string[] = [];

  if (errors.has("name")) {
    messages.push("full name");
  }

  if (errors.has("email")) {
    messages.push("valid email");
  }

  if (errors.has("establishment")) {
    messages.push("establishment type");
  }

  if (messages.length === 1) {
    return `Missing: ${messages[0]}.`;
  }

  if (messages.length > 1) {
    return `Missing: ${messages.join(", ")}.`;
  }

  return "Please check the highlighted fields and try again.";
}

function enhanceWaitlistPage(html: string): string {
  return html
    .replace(
      /<header class="w-full py-lg px-screen-edge flex justify-center items-center">[\s\S]*?<\/header>/,
      `<header class="w-full py-lg px-screen-edge flex justify-between items-center max-w-7xl mx-auto sticky top-0 z-[90] bg-paper-warm">
<a class="text-hungry-orange font-h1 text-h1 tracking-tight" href="/for-foodies">Hungry</a>
<div class="hidden md:flex items-center gap-8 font-['Plus_Jakarta_Sans']">
<a class="text-stone-600 font-medium hover:text-[#E8531E] transition-colors" href="/for-foodies">For Foodies</a>
<a class="text-stone-600 font-medium hover:text-[#E8531E] transition-colors" href="/for-merchants">For Merchants</a>
<a class="text-stone-600 font-medium hover:text-[#E8531E] transition-colors" href="/about">About</a>
<a class="text-stone-600 font-medium hover:text-[#E8531E] transition-colors" href="/merchant/login">Merchant Portal</a>
</div>
<button class="md:hidden text-hungry-orange" aria-label="Open navigation">
<span class="material-symbols-outlined text-3xl">menu</span>
</button>
</header>`,
    )
    .replace('placeholder="Ah Beng"', 'placeholder="Full Name"')
    .replace('placeholder="makan@shiok.sg"', 'placeholder="Email"')
    .replace(
      /<!-- Postal Code \(Optional, adds local flavor\) -->[\s\S]*?<\/div>\n<\/div>\n<!-- Submit Button -->/,
      "<!-- Submit Button -->",
    )
    .replace(
      "</div>\n</div>\n<!-- Name Input -->",
      `</div>
<div id="merchant-establishment" class="hidden mt-lg">
<label class="block font-body-sm text-body-sm text-text-secondary mb-xs" for="establishment_type">What kind of establishment do you run?</label>
<select class="block w-full h-[48px] border-line-border rounded-lg bg-surface-white font-body text-body text-text-primary focus:ring-hungry-orange focus:border-hungry-orange transition-colors" id="establishment_type" name="establishment_type">
<option value="">Select establishment type</option>
<option value="hawker_stall">Hawker stall</option>
<option value="food_court_stall">Food court stall</option>
<option value="restaurant">Restaurant</option>
<option value="cafe">Cafe</option>
<option value="home_based">Home-based food business</option>
<option value="other">Other</option>
</select>
</div>
</div>
<!-- Name Input -->`,
    )
    .replace("<span>Get Early Access</span>", "<span>Join Waitlist</span>")
    .replace("© 2024 Hungry Singapore.", "© 2026 Hungry Singapore.")
    .replace('href="#">Terms of Service', 'href="/privacy">Terms of Service')
    .replace('href="#">Privacy Policy', 'href="/privacy">Privacy Policy');
}

function enhanceMerchantLoginPage(html: string): string {
  return html
    .replace(
      '<div class="font-h1 text-h1 text-hungry-orange tracking-tight">Hungry</div>',
      '<a class="font-h1 text-h1 text-hungry-orange tracking-tight" href="/for-foodies">Hungry</a>',
    )
    .replace(
      /<main class="flex-grow flex items-center justify-center px-screen-edge py-region-gap">[\s\S]*?<\/main>/,
      `<main class="flex-grow flex items-center justify-center px-screen-edge py-region-gap bg-paper-warm">
<section class="w-full max-w-5xl min-h-[620px] bg-surface-white rounded-[28px] border border-line-border shadow-sm overflow-hidden grid grid-cols-2">
<div class="relative min-h-full overflow-hidden bg-deep-navy">
<img alt="Food business counter ready for merchant login" class="absolute inset-0 w-full h-full object-cover" data-alt="A warm food business counter with fresh dishes and welcoming service lighting." src="${MERCHANT_LOGIN_IMAGE}"/>
<div class="absolute inset-0 bg-gradient-to-br from-deep-navy/80 via-deep-navy/50 to-hungry-orange/35"></div>
<div class="absolute top-0 right-[-44px] md:right-[-74px] h-full w-[96px] md:w-[150px] bg-surface-white" style="clip-path: polygon(48% 0, 100% 0, 100% 100%, 0 100%);"></div>
<div class="relative z-10 h-full flex flex-col justify-end p-md md:p-xl lg:p-xxl text-surface-white">
<p class="font-micro text-micro uppercase tracking-wider text-surface-container-high mb-sm">Merchant Portal</p>
<h2 class="font-display text-h1 md:text-display leading-tight max-w-sm">Manage your stall from one place.</h2>
</div>
</div>
<div class="p-sm md:p-lg lg:p-xl flex items-center">
<div class="w-full max-w-[400px] mx-auto flex flex-col gap-region-gap">
<div class="text-left flex flex-col gap-sm">
<h1 class="font-display text-h2 md:text-display text-text-primary">Merchant Portal Login</h1>
<p class="font-body text-body text-text-muted">Manage your hawker stall or restaurant.</p>
</div>
<form action="#" class="flex flex-col gap-section-gap" method="POST">
<div class="flex flex-col gap-lg">
<div class="flex flex-col gap-xs">
<label class="font-body-sm text-body-sm text-text-secondary font-medium px-1" for="email">Email Address</label>
<div class="relative">
<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
<span class="material-symbols-outlined text-text-muted" data-icon="mail">mail</span>
</div>
<input class="w-full h-[48px] pl-10 pr-4 rounded-[18px] border border-line-border bg-surface-white font-body text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-hungry-orange focus:border-transparent placeholder-text-muted transition-colors" id="email" name="email" placeholder="Email" required="" type="email"/>
</div>
</div>
<div class="flex flex-col gap-xs">
<div class="flex justify-between items-center px-1">
<label class="font-body-sm text-body-sm text-text-secondary font-medium" for="password">Password</label>
<a class="font-micro text-micro text-hungry-orange hover:opacity-80 transition-opacity" href="#">Forgot?</a>
</div>
<div class="relative">
<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
<span class="material-symbols-outlined text-text-muted" data-icon="lock">lock</span>
</div>
<input class="w-full h-[48px] pl-10 pr-4 rounded-[18px] border border-line-border bg-surface-white font-body text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-hungry-orange focus:border-transparent placeholder-text-muted transition-colors" id="password" name="password" placeholder="Password" required="" type="password"/>
</div>
</div>
</div>
<div class="flex flex-col gap-md pt-sm">
<button class="w-full h-[52px] bg-hungry-orange text-surface-white font-h3 text-h3 rounded-[18px] flex items-center justify-center gap-sm hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hungry-orange" type="submit">
<span>Sign In</span>
<span class="material-symbols-outlined" data-icon="arrow_forward">arrow_forward</span>
</button>
<div class="text-center mt-sm">
<span class="font-body-sm text-body-sm text-text-secondary">Don't have an account? </span>
<a class="font-body-sm text-body-sm text-hungry-orange font-medium hover:underline transition-all" href="/join-waitlist?joining_as=hawker">Register Interest</a>
</div>
</div>
</form>
</div>
</div>
</section>
</main>`,
    );
}

function rewriteLinks(html: string): string {
  return DIRECT_LINKS.reduce((current, [pattern, replacement]) => {
    return current.replace(pattern, replacement);
  }, html);
}

function activeHrefForStitchFile(fileName: string): string | undefined {
  if (fileName.startsWith("01-merchant-login-")) return "/merchant/login";
  if (fileName.startsWith("03-about-")) return "/about";
  if (fileName.startsWith("04-for-merchants-")) return "/for-merchants";
  if (fileName.startsWith("05-for-foodies-")) return "/for-foodies";
  return undefined;
}

function stitchNavHtml(activeHref?: string): string {
  const links = mainNavLinks
    .map((link) => {
      const active = isActiveSiteHref(activeHref, link.href);
      const stateClass = active
        ? "border-[#E8531E] text-[#E8531E]"
        : "border-transparent text-stone-600 hover:text-[#E8531E]";

      return `<a class="border-b-2 pb-2 transition-colors ${stateClass}" href="${link.href}">${link.label}</a>`;
    })
    .join("\n");

  return `<nav class="sticky top-0 z-50 border-b border-[#E7DED4] bg-white font-['Plus_Jakarta_Sans']">
<div class="mx-auto grid h-20 max-w-7xl grid-cols-[auto_1fr_auto] items-center px-6">
<a class="justify-self-start text-2xl md:text-3xl font-extrabold tracking-tight text-[#E8531E] hover:text-[#C94618] transition-colors" href="${siteBrand.href}" aria-label="Hungry home">${siteBrand.label}</a>
<div class="hidden md:flex justify-self-center items-center gap-10 text-lg font-semibold">
${links}
<a class="md:hidden rounded-[18px] bg-[#E8531E] px-5 py-3 font-bold text-white" href="${waitlistLink.href}">${waitlistLink.label}</a>
</div>
<a class="hidden md:inline-flex justify-self-end rounded-[18px] bg-[#E8531E] px-8 py-4 text-lg font-bold text-white hover:bg-[#C94618] transition-colors" href="${waitlistLink.href}">${waitlistLink.label}</a>
<button class="md:hidden justify-self-end text-[#E8531E]" type="button" aria-label="Open navigation">
<span class="material-symbols-outlined text-4xl">menu</span>
</button>
</div>
</nav>`;
}

function standardizeNavigation(html: string, activeHref?: string): string {
  const nav = stitchNavHtml(activeHref);

  if (/<nav\b/i.test(html)) {
    return html.replace(/<nav\b[\s\S]*?<\/nav>/i, nav);
  }

  if (/<header\b/i.test(html)) {
    return html.replace(/<header\b[\s\S]*?<\/header>/i, nav);
  }

  return html;
}

function standardizeCommonHtml(html: string): string {
  return html
    .replaceAll("© 2024 Hungry Singapore.", "© 2026 Hungry Singapore.")
    .replaceAll('href="/privacy">Terms of Service', 'href="/terms">Terms of Service')
    .replaceAll('href="#">Terms of Service', 'href="/terms">Terms of Service')
    .replaceAll('href="#">Privacy Policy', 'href="/privacy">Privacy Policy')
    .replaceAll('href="#">Hawker Centres', 'href="/for-foodies#hawker-centres">Hawker Centres')
    .replaceAll('href="#">Nearby Makan', 'href="/for-foodies#nearby-makan">Nearby Makan')
    .replaceAll('href="#">Merchant Support', 'href="/for-merchants">Merchant Support')
    .replaceAll('href="#">Contact Us', 'href="mailto:hello@hungry.sg">Contact Us');
}

function stitchFooterHtml() {
  const sections = footerSections
    .map((section) => {
      const links = section.links
        .map((link) => {
          const external =
            isExternalFooterHref(link.href) && link.href.startsWith("http")
              ? ' target="_blank" rel="noreferrer"'
              : "";
          return `<a class="block text-sm leading-6 text-stone-500 hover:text-[#E8531E] transition-colors" href="${link.href}"${external}>${link.label}</a>`;
        })
        .join("\n");

      return `<div class="space-y-3">
<h2 class="text-sm font-extrabold text-[#111827]">${section.title}</h2>
${links}
</div>`;
    })
    .join("\n");

  return `<footer class="w-full border-t border-[#E7DED4] bg-white py-10 text-sm font-['Plus_Jakarta_Sans']">
<div class="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 md:grid-cols-4">
<div class="space-y-3">
<a class="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold tracking-tight text-[#E8531E]" href="${footerBrand.href}">${footerBrand.label}</a>
<p class="max-w-xs text-sm leading-6 text-stone-500">${footerBrand.copy}</p>
</div>
${sections}
</div>
</footer>`;
}

function standardizeFooter(html: string): string {
  const footer = stitchFooterHtml();

  if (/<footer\b/i.test(html)) {
    return html.replace(/<footer\b[\s\S]*?<\/footer>/i, footer);
  }

  return html;
}

function injectNavigationScript(html: string): string {
  const script = `<script>
(() => {
  const routeFor = (text) => {
    const value = (text || "").replace(/\\s+/g, " ").trim().toLowerCase();
    if (value.includes("for foodies")) return "/for-foodies";
    if (value.includes("for merchants")) return "/for-merchants";
    if (value === "about" || value.includes("about hungry")) return "/about";
    if (value.includes("merchant portal") || value.includes("login")) return "/merchant/login";
    if (value.includes("register merchant interest") || value.includes("merchant interest")) return "/join-waitlist?joining_as=hawker";
    if (value.includes("dashboard")) return "/merchant/dashboard";
    if (value.includes("menu management") || value.includes("manage menu")) return "/merchant/menu";
    if (value.includes("hours") || value.includes("schedule")) return "/merchant/hours";
    if (value.includes("profile") || value.includes("storefront")) return "/merchant/profile";
    if (value.includes("analytics")) return "/merchant/analytics";
    if (value.includes("showcase") || value.includes("app mockup")) return "/showcase";
    if (value.includes("trust")) return "/trust";
    if (value.includes("visual feast")) return "/foodie-hero";
    if (value.includes("join") || value.includes("waitlist") || value.includes("early access") || value.includes("register merchant interest")) return "/join-waitlist";
    return null;
  };

  const toggleMobileMenu = (button) => {
    const navBar = button.closest("nav,header");
    const menu = navBar?.querySelector("div.hidden.md\\\\:flex, nav.hidden.md\\\\:flex");
    if (!menu) return;

    const isOpen = menu.getAttribute("data-mobile-open") === "true";
    menu.setAttribute("data-mobile-open", String(!isOpen));
    navBar.style.position = navBar.style.position || "sticky";
    menu.querySelectorAll("a").forEach((link) => {
      Object.assign(link.style, isOpen ? {
        display: "",
        width: "",
        maxWidth: "",
        justifyContent: "",
        textAlign: "",
      } : {
        display: "inline-flex",
        width: "260px",
        maxWidth: "100%",
        justifyContent: "center",
        textAlign: "center",
      });
    });
    Object.assign(menu.style, isOpen ? {
      display: "",
      position: "",
      left: "",
      right: "",
      top: "",
      width: "",
      transform: "",
      flexDirection: "",
      gap: "",
      alignItems: "",
      padding: "",
      background: "",
      borderBottom: "",
      boxShadow: "",
      zIndex: "",
      textAlign: "",
    } : {
      display: "flex",
      position: "fixed",
      left: "0",
      right: "0",
      top: "80px",
      width: "100vw",
      transform: "none",
      flexDirection: "column",
      gap: "18px",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px 24px 24px",
      background: "#FDFCFB",
      borderBottom: "1px solid #E7DED4",
      boxShadow: "0 18px 40px rgba(17, 24, 39, 0.12)",
      zIndex: "999",
      textAlign: "center",
      boxSizing: "border-box",
    });
  };

  document.addEventListener("click", (event) => {
    const control = event.target.closest("a,button");
    if (!control) return;
    if (control.tagName === "BUTTON" && control.closest("form") && (control.type || "submit") === "submit") return;
    const label = (control.textContent || "").replace(/\\s+/g, " ").trim().toLowerCase();
    if (control.tagName === "BUTTON" && label === "menu") {
      event.preventDefault();
      toggleMobileMenu(control);
      return;
    }
    const href = control.getAttribute("href");
    const target = routeFor(label);
    if (target && (control.tagName === "BUTTON" || !href || href === "#")) {
      event.preventDefault();
      window.location.href = target;
    }
  });

  const establishmentField = document.getElementById("merchant-establishment");
  const joiningOptions = document.querySelectorAll('input[name="joining_as"]');
  const requestedJoiningAs = new URLSearchParams(window.location.search).get("joining_as");
  if (requestedJoiningAs && joiningOptions.length) {
    const requestedOption = document.querySelector('input[name="joining_as"][value="' + requestedJoiningAs + '"]');
    if (requestedOption) requestedOption.checked = true;
  }
  const updateEstablishmentField = () => {
    if (!establishmentField) return;
    const selected = document.querySelector('input[name="joining_as"]:checked')?.value;
    establishmentField.classList.toggle("hidden", selected !== "hawker" && selected !== "both");
  };
  joiningOptions.forEach((option) => option.addEventListener("change", updateEstablishmentField));
  updateEstablishmentField();
})();
</script>`;

  return html.replace("</body>", `${script}</body>`);
}

function enhanceForFoodiesPage(html: string): string {
  return html
    .replace(
      'class="relative w-full h-[870px] flex items-center justify-center overflow-hidden"',
      'class="relative w-full h-[calc(100svh-80px)] min-h-[calc(100svh-80px)] flex items-center justify-center overflow-hidden"',
    )
    .replace(
      '<img class="w-full h-full object-cover" data-alt="A high-impact, full-width, ultra-high-resolution photograph of an authentic Singaporean Laksa bowl viewed from slightly above.',
      '<img class="w-full h-full object-cover object-center" data-alt="A high-impact, full-width, ultra-high-resolution photograph of an authentic Singaporean Laksa bowl viewed from slightly above.',
    )
    .replace(
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">',
      '<div id="nearby-makan" class="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">',
    )
    .replace(
      '<div class="col-span-1 bg-surface-container rounded-[24px] border border-line-border p-8 flex flex-col items-start justify-center">\n<div class="w-12 h-12 rounded-full bg-surface-white text-hungry-orange flex items-center justify-center mb-6 shadow-sm">\n<span class="material-symbols-outlined" data-weight="fill">menu_book</span>\n</div>\n<h3 class="font-h2 text-h2 text-text-primary mb-3">See menus before you go</h3>\n<p class="font-body text-body text-text-secondary">Browse visual menus with actual photos of the food, so you know exactly what to order.</p>\n</div>',
      `<div class="col-span-1 bg-surface-container rounded-[24px] border border-line-border relative overflow-hidden group min-h-[300px]">
<img alt="Real hawker menu dishes laid out for browsing" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" data-alt="A realistic Singapore hawker menu table with several photographed dishes, handwritten prices, and warm stall lighting." src="${VISUAL_MENU_IMAGE}"/>
<div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10"></div>
<div class="relative z-10 h-full p-8 flex flex-col items-start justify-end">
<div class="w-12 h-12 rounded-full bg-surface-white text-hungry-orange flex items-center justify-center mb-6 shadow-sm">
<span class="material-symbols-outlined" data-weight="fill">menu_book</span>
</div>
<h3 class="font-h2 text-h2 text-surface-white mb-3">See menus before you go</h3>
<p class="font-body text-body text-surface-container-highest">Browse visual menus with actual photos of the food, so you know exactly what to order.</p>
</div>
</div>`,
    )
    .replace(
      '<div class="col-span-1 md:col-span-2 bg-surface-variant rounded-[24px] border border-line-border p-8 relative overflow-hidden flex items-center">',
      '<div id="hawker-centres" class="col-span-1 md:col-span-2 bg-surface-variant rounded-[24px] border border-line-border p-8 relative overflow-hidden flex items-center min-h-[300px]">',
    )
    .replace(
      '<div class="w-full md:w-1/2 z-10 space-y-4">',
      '<div class="w-[70%] max-w-[520px] md:w-1/2 z-10 space-y-4 bg-surface-white/70 md:bg-transparent backdrop-blur-[2px] md:backdrop-blur-none rounded-[18px] md:rounded-none p-4 md:p-0 border border-line-border/60 md:border-0">',
    )
    .replace(
      '<div class="hidden md:block absolute -right-10 -bottom-10 w-2/3 h-[120%] rotate-[-10deg]">',
      '<div class="absolute inset-0 md:inset-auto md:-right-10 md:-bottom-10 md:w-2/3 h-full md:h-[120%] md:rotate-[-10deg] opacity-60 md:opacity-100">',
    )
    .replace("© 2024 Hungry Singapore.", "© 2026 Hungry Singapore.")
    .replace('href="/privacy">Terms of Service', 'href="/privacy">Terms of Service')
    .replace('href="#">Hawker Centres', 'href="/for-foodies#hawker-centres">Hawker Centres')
    .replace('href="#">Nearby Makan', 'href="/for-foodies#nearby-makan">Nearby Makan')
    .replace('href="#">Merchant Support', 'href="/for-merchants">Merchant Support')
    .replace('href="#">Contact Us', 'href="mailto:hello@hungry.sg">Contact Us');
}

function enhanceForMerchantsPage(html: string): string {
  return html
    .replace(
      /<!-- Hero Section -->[\s\S]*?<\/section>/,
      `<!-- Hero Section -->
<section class="relative w-full h-[calc(100svh-80px)] min-h-[620px] flex items-center justify-center overflow-hidden">
<div class="absolute inset-0 z-0">
<img alt="Singapore food business owner at a hawker stall" class="w-full h-full object-cover object-center" data-alt="A warm, realistic Singapore food business owner serving customers from a hawker stall with menu boards and inviting stall lighting." src="${MERCHANT_HERO_IMAGE}"/>
<div class="absolute inset-0 bg-gradient-to-b from-deep-navy/55 via-deep-navy/65 to-deep-navy/85"></div>
</div>
<div class="relative z-10 flex flex-col items-center justify-center text-center px-screen-edge max-w-4xl mx-auto space-y-xl">
<h1 class="font-display text-display md:text-5xl lg:text-6xl text-surface-white tracking-tight leading-tight drop-shadow-lg">Bring your food business closer to hungry customers.</h1>
<p class="font-body-lg text-body-lg text-surface-container-high max-w-2xl drop-shadow-md">Join the platform built for Singapore's unique culinary landscape. Connect with locals who appreciate your craft.</p>
<div class="pt-lg">
<a class="inline-flex items-center justify-center bg-hungry-orange text-surface-white font-h2 text-h2 h-[56px] px-10 rounded-[18px] shadow-lg hover:bg-surface-tint transition-colors duration-300" href="/join-waitlist?joining_as=hawker">Join Waitlist</a>
</div>
</div>
</section>`,
    )
    .replace(
      /<!-- Small Card: Home Chefs -->[\s\S]*?<p class="font-micro text-micro text-text-muted mt-xs">Specialty Creators<\/p>\s*<\/div>/,
      `<!-- Small Card: Home Chefs -->
<div class="col-span-1 md:col-span-1 row-span-1 relative overflow-hidden rounded-2xl border border-line-border min-h-[260px] group">
<img alt="Home-based specialty food business preparing fresh bakes" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" data-alt="A realistic home-based food business counter with fresh baked goods and warm kitchen light." src="${HOME_BASED_IMAGE}"/>
<div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/10"></div>
<div class="relative z-10 flex h-full min-h-[260px] flex-col justify-end p-lg text-surface-white">
<div class="w-10 h-10 rounded-full bg-surface-white/90 flex items-center justify-center text-hungry-orange mb-sm">
<span class="material-symbols-outlined filled">skillet</span>
</div>
<h3 class="font-h3 text-h3 text-surface-white">Home-Based</h3>
<p class="font-micro text-micro text-surface-container-high mt-xs">Specialty Creators</p>
</div>
</div>`,
    )
    .replace("© 2024 Hungry Singapore.", "© 2026 Hungry Singapore.")
    .replace(
      /<button class="mt-sm bg-hungry-orange text-surface-white font-h3 text-h3 px-8 py-4 rounded-full min-h-\[52px\] hover:bg-primary-container transition-colors shadow-md relative z-10 w-full sm:w-auto">\s*Register Merchant Interest\s*<\/button>/,
      '<a class="mt-sm bg-hungry-orange text-surface-white font-h3 text-h3 px-8 py-4 rounded-full min-h-[52px] hover:bg-primary-container transition-colors shadow-md relative z-10 w-full sm:w-auto inline-flex items-center justify-center" href="/join-waitlist?joining_as=hawker">Register Merchant Interest</a>',
    )
    .replace('href="#">Hawker Centres', 'href="/for-foodies#hawker-centres">Hawker Centres')
    .replace('href="#">Nearby Makan', 'href="/for-foodies#nearby-makan">Nearby Makan')
    .replace('href="#">Merchant Support', 'href="/for-merchants">Merchant Support')
    .replace('href="#">Contact Us', 'href="mailto:hello@hungry.sg">Contact Us')
    .replace('href="#">Terms of Service', 'href="/privacy">Terms of Service')
    .replace('href="#">Privacy Policy', 'href="/privacy">Privacy Policy');
}

export async function stitchResponse(
  fileName: string,
  request: NextRequest,
  options: StitchOptions = {},
) {
  const filePath = path.join(STITCH_HTML_DIR, fileName);
  let html = await readFile(filePath, "utf8");

  if (fileName.startsWith("02-join-waitlist-")) {
    html = enhanceWaitlistPage(html);
  }

  if (fileName.startsWith("01-merchant-login-")) {
    html = enhanceMerchantLoginPage(html);
  }

  if (fileName.startsWith("04-for-merchants-")) {
    html = enhanceForMerchantsPage(html);
  }

  return renderStitchHtml(html, request, options, activeHrefForStitchFile(fileName));
}

export async function stitchForFoodiesWithVisualHeroResponse(request: NextRequest) {
  const [forFoodiesHtml, visualHeroHtml] = await Promise.all([
    readFile(
      path.join(STITCH_HTML_DIR, "05-for-foodies-81f90fcdc4734ad2829458ba7829af64.html"),
      "utf8",
    ),
    readFile(
      path.join(
        STITCH_HTML_DIR,
        "08-foodie-hero-visual-feast-60812b7af2db4eca813b95bf7c0f5709.html",
      ),
      "utf8",
    ),
  ]);

  const replacementHero = visualHeroHtml.match(
    /<!-- Hero Section: The Visual Feast -->[\s\S]*?<\/section>/,
  )?.[0];

  if (!replacementHero) {
    throw new Error("Visual Feast hero section not found in Stitch export.");
  }

  const html = enhanceForFoodiesPage(
    forFoodiesHtml.replace(/<!-- Hero Section -->[\s\S]*?<\/section>/, replacementHero),
  );

  return renderStitchHtml(html, request, {}, "/for-foodies");
}

function renderStitchHtml(
  sourceHtml: string,
  request: NextRequest,
  options: StitchOptions = {},
  activeHref?: string,
) {
  let html = sourceHtml;

  html = rewriteLinks(html);
  html = standardizeNavigation(html, activeHref);
  html = standardizeCommonHtml(html);
  html = standardizeFooter(html);

  if (options.waitlistForm) {
    html = makeWaitlistFormSubmittable(html, request);
  }

  html = injectNavigationScript(html);

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
