import { useCallback, useEffect, useState } from "react";

// Server limit is auth.email.max_frequency = 60s (supabase/config.toml); a few
// seconds of margin keeps the first "Resend now" from hitting the rate limit.
export const RESEND_COOLDOWN_SECONDS = 65;

function secondsUntil(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

export function formatCooldown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Countdown until another auth email may be requested. It runs from an end time, so a
 * backgrounded app or a slow timer cannot finish before the server allows another email.
 * `startRunning` is true when an email was just sent (the screen opened after one).
 */
export function useResendCooldown(startRunning: boolean) {
  const [endsAt, setEndsAt] = useState(() =>
    startRunning ? Date.now() + RESEND_COOLDOWN_SECONDS * 1000 : 0,
  );
  const [seconds, setSeconds] = useState(() => secondsUntil(endsAt));

  useEffect(() => {
    setSeconds(secondsUntil(endsAt));
    const timer = setInterval(() => {
      const remaining = secondsUntil(endsAt);
      setSeconds(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  /** Starts the wait again, after an email was sent or the server said "too many". */
  const restart = useCallback(() => setEndsAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000), []);

  return { seconds, restart };
}
