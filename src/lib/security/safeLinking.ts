import { Alert, Linking } from "react-native";

const ALLOWED_HOSTS = new Set(["hungry.sg", "www.hungry.sg"]);
const ALLOWED_SCHEMES = new Set(["https"]);

export async function openTrustedExternalUrl(url: string): Promise<void> {
  try {
    const parsed = new URL(url);
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
