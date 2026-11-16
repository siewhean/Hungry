"use client";

import { useRef, useState, useSyncExternalStore } from "react";

import styles from "@/components/seo/SeoPage.module.css";
import { APP_OPEN_WAIT_MS, isPhoneUserAgent } from "@/lib/share/openInApp";

const subscribeNothing = () => () => {};
const readIsPhone = () => isPhoneUserAgent(navigator.userAgent);
const serverIsPhone = () => false;

/**
 * "Open in Hungry", shown only on a phone. If the page is still on screen shortly after the tap,
 * the app did not take over, so the page says so instead of leaving a button that does nothing.
 */
export function OpenInHungry({ href }: { href: string }) {
  const isPhone = useSyncExternalStore(subscribeNothing, readIsPhone, serverIsPhone);
  const [missed, setMissed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!isPhone) return null;

  function onOpen() {
    setMissed(false);
    if (timer.current) clearTimeout(timer.current);
    const stop = () => {
      if (document.visibilityState === "hidden" && timer.current) clearTimeout(timer.current);
    };
    document.addEventListener("visibilitychange", stop, { once: true });
    timer.current = setTimeout(() => {
      document.removeEventListener("visibilitychange", stop);
      if (document.visibilityState === "visible") setMissed(true);
    }, APP_OPEN_WAIT_MS);
  }

  return (
    <>
      <a className={styles.inlineLink} href={href} onClick={onOpen} style={{ display: "inline-block" }}>
        Open in Hungry
      </a>
      <p
        role="status"
        className={styles.sourceNote}
        hidden={!missed}
        style={{ flexBasis: "100%", margin: 0, order: 2 }}
      >
        {missed
          ? "Hungry didn't open. It may not be on this phone yet, so tap Get early access above."
          : null}
      </p>
    </>
  );
}
