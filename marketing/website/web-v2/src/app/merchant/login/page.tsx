"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Star, TrendingUp } from "lucide-react";
import { parseMerchantPortalJson } from "@/lib/merchantPortal/fetch";
import styles from "../../console/console.module.css";

export default function MerchantLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/merchant/login", {
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await parseMerchantPortalJson<{ error?: string }>(response)) ?? {};
      if (!response.ok) throw new Error(payload?.error ?? "Unable to sign in.");
      router.push("/merchant");
      router.refresh();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Unable to sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.loginShell} id="main-content" tabIndex={-1}>
      {/* LEFT: Login card */}
      <div className={styles.loginLeft}>
        <div className={styles.loginCard}>
          <div className={styles.loginLogo}>Hungry</div>
          <div className={styles.loginBadge}>Merchant Mode</div>

          <h1 className={styles.loginTitle}>Welcome back</h1>
          <p className={styles.loginSubtitle}>Sign in to manage your stall, menu, and reviews.</p>

          <form onSubmit={handleSignIn}>
            <div className={styles.formRow}>
              <label className={styles.formLabel} htmlFor="merchant-email">
                Email address
              </label>
              <input
                id="merchant-email"
                type="email"
                className={styles.formInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formLabelRow}>
                <label className={styles.formLabel} htmlFor="merchant-password">
                  Password
                </label>
                <Link className={styles.authTextLink} href="/merchant/forgot-password">
                  Forgot password?
                </Link>
              </div>
              <input
                id="merchant-password"
                type="password"
                className={styles.formInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error ? (
              <p className={styles.formHelpText} role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className={styles.loginSubmitBtn} disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className={styles.authFooterText}>
            New to Hungry Merchant?{" "}
            <Link className={styles.authTextLink} href="/merchant/signup">
              Create merchant access
            </Link>
          </p>
        </div>
      </div>

      {/* RIGHT: Brand panel */}
      <div className={styles.loginRight}>
        <div>
          <h2 className={styles.loginHeroTitle}>
            Get discovered by people deciding what to eat nearby.
          </h2>
          <p className={styles.loginHeroSub}>
            Merchant Mode gives you full control over how your stall appears to hungry
            customers in Singapore.
          </p>

          <div className={styles.loginHeroFeature}>
            <div className={styles.loginHeroIcon}>
              <MapPin size={18} color="white" />
            </div>
            <span className={styles.loginHeroFeatureText}>
              Appear in nearby searches and discovery feeds
            </span>
          </div>

          <div className={styles.loginHeroFeature}>
            <div className={styles.loginHeroIcon}>
              <Star size={18} color="white" />
            </div>
            <span className={styles.loginHeroFeatureText}>
              Respond to reviews and build your reputation
            </span>
          </div>

          <div className={styles.loginHeroFeature}>
            <div className={styles.loginHeroIcon}>
              <TrendingUp size={18} color="white" />
            </div>
            <span className={styles.loginHeroFeatureText}>
              Track views, menu clicks, and promotion performance
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
