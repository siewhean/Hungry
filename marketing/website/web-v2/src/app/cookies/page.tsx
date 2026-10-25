import { routeMetadata } from "@/app/seo";
import { PolicyPage } from "@/components/legal/PolicyPage";

export const revalidate = 3600;
export const metadata = routeMetadata("/cookies");

const sections = [
  {
    title: "Essential Merchant Cookies",
    body: "hungry_merchant_access_token authenticates the merchant session and follows the session expiry (normally about one hour). hungry_merchant_refresh_token lasts up to 30 days. hungry_merchant_csrf_token protects merchant mutations and lasts up to 12 hours. These are used for requested sign-in and security features, not optional advertising. Logging out clears merchant session cookies. Browser controls can also delete cookies, but signed-in features may stop working.",
  },
  {
    title: "Your Choice",
    body: "hungry.website-consent.v1 in localStorage records the consent version, your analytics choice, and an expiry for 180 days. Essential-only is the starting state. Accept analytics or Reject analytics use equally available controls; there is no advertising consent bundled with use of the site. Cookie preferences lets you change your choice later. If preference storage is unavailable, optional analytics stays off until you explicitly choose. An explicit choice then applies only to the current tab and cannot be remembered for future visits; the consent control displays a notice.",
  },
  {
    title: "Optional Analytics",
    body: "Vercel Analytics is loaded for public website routes only after affirmative analytics consent. It can process page views and technical visit information. Refusing or withdrawing consent prevents future optional collection by this integration. Global Privacy Control or Do Not Track forces optional analytics off. This choice does not delete information already received by a provider; contact support for privacy requests. No advertising SDK is intentionally enabled by this consent control.",
  },
  {
    title: "Other Browser Storage",
    body: "Development or explicitly enabled Console prototypes can use localStorage for prototype state; production prototype storage is disabled by default. The native app uses its own account storage and device permissions; browser cookie consent does not grant app permissions. Our Privacy Policy describes configured app providers.",
  },
  {
    title: "Manage Or Ask About Storage",
    body: "Use the persistent Cookie preferences control to review or withdraw optional analytics consent. You can remove browser cookies and localStorage in your browser settings; the next visit starts with essential-only and asks again. For questions or data requests, email usehungrysingapore@gmail.com.",
  },
];

export default function Page() {
  return (
    <PolicyPage
      title="Cookie Policy"
      intro="Cookies and similar browser storage support signed-in features, remember cookie choices, and, only with your permission, help measure public website use."
      sections={sections}
    />
  );
}
