import type { ShareChannel } from "./messagingShare";
export async function performShareHandoff(
  channel: ShareChannel,
  message: string,
  url: string,
  deps: {
    openMessaging: (url: string) => Promise<boolean>;
    shareSystem: (content: { message: string; url: string }) => Promise<{ action: string }>;
    sharedAction: string;
  },
): Promise<boolean> {
  if (channel === "whatsapp")
    return deps.openMessaging(`https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`);
  if (channel === "telegram")
    return deps.openMessaging(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`,
    );
  const result = await deps.shareSystem({ message: `${message}\n${url}`, url });
  return result.action === deps.sharedAction;
}
