import { Share } from "react-native";

import { webShareUrl } from "@/constants/links";
import { withShareSource, type ShareSource } from "./shareAttribution";

/** usehungry.com/user/:id; opens UserProfile in the app (linking.ts) or the web profile page. */
export function profileShareUrl(userId: string, source: ShareSource): string {
  return withShareSource(webShareUrl("user", userId), source);
}

/** Opens the system share sheet with a link to this profile. */
export async function shareProfileLink(userId: string, displayName: string): Promise<void> {
  const url = profileShareUrl(userId, "system_share");
  await Share.share({ message: `${displayName} on Hungry: ${url}` });
}
