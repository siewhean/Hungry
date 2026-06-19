"use client";

import React, { useState } from "react";
import Link from "next/link";
import { KeyRound, LockKeyhole, MailCheck } from "lucide-react";

import styles from "../../console/console.module.css";
import { parseMerchantPortalJson } from "@/lib/merchantPortal/fetch";

type ForgotPasswordResponse = {
  error?: string;
  message?: string;
};

export default function MerchantForgotPasswordPage() {
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/merchant/forgot-password", {
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await parseMerchantPortalJson<ForgotPasswordResponse>(response)) ?? {};
      if (!response.ok) throw new Error(payload.error ?? "Unable to send reset instructions.");
      setSuccess(
        payload.message ??
          "If this email has portal access, reset instructions will arrive shortly.",
      );
    } catch (resetError) {
      setError(
        resetError instanceof Error ? resetError.message : "Unable to send reset instructions.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.loginShell} id="main-content" tabIndex={-1}>
      <div className={styles.loginLeft}>
        <div className={styles.loginCard}>
          <div className={styles.loginLogo}>Hungry</div>
          <div className={styles.loginBadge}>Merchant Mode</div>

          <h1 className={styles.loginTitle}>Reset your password</h1>
          <p className={styles.loginSubtitle}>
            Enter the email linked to your merchant account and we will send reset instructions.
          </p>

          <form onSubmit={handleReset}>
            <div className={styles.formRow}>
              <label className={styles.formLabel} htmlFor="merchant-reset-email">
                Email address
              </label>
              <input
                id="merchant-reset-email"
                type="email"
                className={styles.formInput}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {error ? (
              <p className={styles.formHelpText} role="alert">
                {error}
              </p>
            ) : null}

            {success ? (
              <p className={styles.formSuccessText} role="status">
                {success}
              </p>
            ) : null}

            <button type="submit" className={styles.loginSubmitBtn} disabled={isLoading}>
              {isLoading ? "Sending..." : "Send reset instructions"}
            </button>
          </form>

          <p className={styles.authFooterText}>
            Remember your password?{" "}
            <Link className={styles.authTextLink} href="/merchant/login">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>

      <div className={styles.loginRight}>
        <div>
          <h2 className={styles.loginHeroTitle}>Secure account recovery.</h2>
          <p className={styles.loginHeroSub}>
            Password reset links are sent through Supabase Auth and return you to the Merchant
            Portal sign-in flow.
          </p>

          <div className={styles.loginHeroFeature}>
            <div className={styles.loginHeroIcon}>
              <KeyRound size={18} color="white" />
            </div>
            <span className={styles.loginHeroFeatureText}>Request a time-limited reset email</span>
          </div>

          <div className={styles.loginHeroFeature}>
            <div className={styles.loginHeroIcon}>
              <MailCheck size={18} color="white" />
            </div>
            <span className={styles.loginHeroFeatureText}>
              Check the inbox used for your merchant account
            </span>
          </div>

          <div className={styles.loginHeroFeature}>
            <div className={styles.loginHeroIcon}>
              <LockKeyhole size={18} color="white" />
            </div>
            <span className={styles.loginHeroFeatureText}>
              Sign back in after the password is updated
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
