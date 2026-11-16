// "Open in Hungry" uses the hungry:// link, which only does something on a phone. Other browsers
// have no app to open, so the button is not offered there.
const PHONE_PATTERN = /iPhone|iPod|Android.+Mobile|Android.+Mobi/i;

export function isPhoneUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent) && PHONE_PATTERN.test(userAgent as string);
}

/** How long to wait for the app to take over before telling the person it did not open. */
export const APP_OPEN_WAIT_MS = 1500;
