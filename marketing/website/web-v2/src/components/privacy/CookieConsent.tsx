"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import {
  analyticsAllowed,
  filterAnalyticsEvent,
  consentSnapshot,
  privacySignalEnabled,
  saveConsent,
  subscribeConsent,
} from "@/lib/privacy/consent";
import styles from "./CookieConsent.module.css";

export default function CookieConsent() {
  const choice = useSyncExternalStore(subscribeConsent, consentSnapshot, () => "unset" as const);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  const preferences = useRef<HTMLButtonElement>(null);
  const reject = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (preferencesOpen) reject.current?.focus();
  }, [preferencesOpen]);
  const visible = choice === "unset" || preferencesOpen;

  function choose(analytics: boolean) {
    const remembered = saveConsent(analytics);
    setStorageNotice(
      remembered
        ? ""
        : "Your choice applies to this tab. Your browser could not save it for future visits.",
    );
    setPreferencesOpen(false);
    preferences.current?.focus({ preventScroll: true });
  }

  return (
    <>
      {choice === "accepted" && analyticsAllowed() ? (
        <Analytics beforeSend={filterAnalyticsEvent} />
      ) : null}
      {visible ? (
        <section className={styles.banner} aria-labelledby="cookie-consent-title">
          <h2 id="cookie-consent-title">Your privacy choices</h2>
          <p>
            Essential storage supports security and your choices. Optional analytics helps us
            understand visits. It stays off until you accept.{" "}
            <Link href="/cookies">Cookie policy</Link>.
          </p>
          {privacySignalEnabled() ? <p>Your browser privacy signal keeps analytics off.</p> : null}
          <div className={styles.actions}>
            <button
              ref={reject}
              type="button"
              className={styles.choice}
              onClick={() => choose(false)}
            >
              Reject analytics
            </button>
            <button
              type="button"
              className={styles.choice}
              onClick={() => choose(true)}
              disabled={privacySignalEnabled()}
            >
              Accept analytics
            </button>
            {choice !== "unset" ? (
              <button
                type="button"
                className={styles.choice}
                onClick={() => {
                  setPreferencesOpen(false);
                  preferences.current?.focus({ preventScroll: true });
                }}
              >
                Close preferences
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
      <div className={styles.preferences}>
        <button
          ref={preferences}
          type="button"
          className={styles.choice}
          aria-expanded={visible}
          onClick={() => setPreferencesOpen(true)}
        >
          Cookie preferences
        </button>
        {storageNotice ? <p role="status">{storageNotice}</p> : null}
      </div>
    </>
  );
}
