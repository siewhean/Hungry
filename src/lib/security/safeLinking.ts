import { Alert, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";

const ALLOWED_HOSTS = new Set([
  "hungry.sg",
  "www.hungry.sg",
  // Live marketing/support site (see src/constants/supportLinks.ts).
  "usehungry.com",
  "www.usehungry.com",
]);
const ALLOWED_SCHEMES = new Set(["https"]);
const ALLOWED_BLOG_HOSTS = new Set(["hungry.sg", "www.hungry.sg"]);
const ALLOWED_MAPS_HOSTS = new Set(["www.google.com", "maps.google.com"]);
const ALLOWED_DELIVERY_SCHEMES: Record<string, Set<string>> = {
  grabfood: new Set(["grab"]),
  foodpanda: new Set(["foodpanda"]),
  deliveroo: new Set(["deliveroo"]),
};
const ALLOWED_DELIVERY_HOSTS: Record<string, Set<string>> = {
  grabfood: new Set(["food.grab.com", "grab.com", "www.grab.com"]),
  foodpanda: new Set(["foodpanda.sg", "www.foodpanda.sg"]),
  deliveroo: new Set(["deliveroo.com.sg", "www.deliveroo.com.sg"]),
};

function parseUrl(url: string): URL {
  return new URL(url);
}

export async function openTrustedExternalUrl(url: string): Promise<void> {
  try {
    const parsed = parseUrl(url);
    if (!ALLOWED_SCHEMES.has(parsed.protocol.replace(":", ""))) {
      throw new Error("Blocked non-HTTPS URL.");
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
      throw new Error("Blocked non-allowlisted host.");
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert("Unable to open link", "Please try again later.");
  }
}

export async function openTrustedBlogUrl(url: string): Promise<void> {
  try {
    const parsed = parseUrl(url);
    if (parsed.protocol !== "https:" || !ALLOWED_BLOG_HOSTS.has(parsed.hostname.toLowerCase())) {
      throw new Error("Blocked non-allowlisted article host.");
    }
    await WebBrowser.openBrowserAsync(url);
  } catch {
    Alert.alert("Unable to open article", "Please try again later.");
  }
}

export async function openTrustedMapsUrl(url: string): Promise<void> {
  try {
    const parsed = parseUrl(url);
    if (parsed.protocol !== "https:" || !ALLOWED_MAPS_HOSTS.has(parsed.hostname.toLowerCase())) {
      throw new Error("Blocked non-allowlisted maps host.");
    }
    if (!parsed.pathname.startsWith("/maps/search")) {
      throw new Error("Blocked non-search maps URL.");
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert("Unable to open maps", "Please try again later.");
  }
}

export async function openTrustedDeliveryUrl(
  platform: string,
  nativeUrl: string,
  webUrl: string,
): Promise<void> {
  const normalizedPlatform = platform.toLowerCase();
  const allowedNativeSchemes = ALLOWED_DELIVERY_SCHEMES[normalizedPlatform] ?? new Set<string>();
  const allowedWebHosts = ALLOWED_DELIVERY_HOSTS[normalizedPlatform] ?? new Set<string>();

  try {
    const parsedNative = parseUrl(nativeUrl);
    if (allowedNativeSchemes.has(parsedNative.protocol.replace(":", "").toLowerCase())) {
      await Linking.openURL(nativeUrl);
      return;
    }
  } catch {
    // Fall back to the allowlisted HTTPS URL below.
  }

  try {
    const parsedWeb = parseUrl(webUrl);
    if (parsedWeb.protocol !== "https:" || !allowedWebHosts.has(parsedWeb.hostname.toLowerCase())) {
      throw new Error("Blocked non-allowlisted delivery URL.");
    }
    await Linking.openURL(webUrl);
  } catch {
    Alert.alert("Unable to open delivery link", "Please try again later.");
  }
}
