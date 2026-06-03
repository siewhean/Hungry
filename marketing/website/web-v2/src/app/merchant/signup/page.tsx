"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, ShieldCheck, UtensilsCrossed } from "lucide-react";

import styles from "../../console/console.module.css";
import { parseMerchantPortalJson } from "@/lib/merchantPortal/fetch";

type MerchantSignupResponse = {
  error?: string;
  message?: string;
};

export default function MerchantSignupPage() {
  const [name, setName] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/merchant/signup", {
        body: JSON.stringify({ businessName, email, name, password }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await parseMerchantPortalJson<MerchantSignupResponse>(response)) ?? {};
      if (!response.ok) throw new Error(payload.error ?? "Unable to create merchant access.");
      setSuccess(
        payload.message ?? "Merchant account request received. Check your email for next steps.",
      );
      setPassword("");
    } catch (signUpError) {
      setError(
        signUpError instanceof Error ? signUpError.message : "Unable to create merchant access.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginShell}>
      <div className={styles.loginLeft}>
        <div className={styles.loginCard}>
          <div className={styles.loginLogo}>Hungry</div>
          <div className={styles.loginBadge}>Merchant Mode</div>

          <h1 className={styles.loginTitle}>Create merchant access</h1>
          <p className={styles.loginSubtitle}>
            Request access for your food business. Hungry will link your approved profile before
            portal access goes live.
          </p>

          <form onSubmit={handleSignUp}>
            <div className={styles.formRow}>
              <label className={styles.formLabel} htmlFor="merchant-signup-name">
                Your name
              </label>
              <input
                id="merchant-signup-name"
                type="text"
                className={styles.formInput}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel} htmlFor="merchant-business-name">
                Business name
              </label>
              <input
                id="merchant-business-name"
                type="text"
                className={styles.formInput}
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                autoComplete="organization"
                required
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel} htmlFor="merchant-signup-email">
                Email address
              </label>
              <input
                id="merchant-signup-email"
                type="email"
                className={styles.formInput}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel} htmlFor="merchant-signup-password">
                Password
              </label>
              <input
                id="merchant-signup-password"
                type="password"
                className={styles.formInput}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
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
              {isLoading ? "Creating access..." : "Create access"}
            </button>
          </form>

          <p className={styles.authFooterText}>
            Already have access?{" "}
            <Link className={styles.authTextLink} href="/merchant/login">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className={styles.loginRight}>
        <div>
          <h2 className={styles.loginHeroTitle}>Set up your food business profile.</h2>
          <p className={styles.loginHeroSub}>
            Merchant access starts with a verified business profile so diners can trust what they
            see.
          </p>

          <div className={styles.loginHeroFeature}>
            <div className={styles.loginHeroIcon}>
              <UtensilsCrossed size={18} color="white" />
            </div>
            <span className={styles.loginHeroFeatureText}>
              Add your stall, menu, photos, and operating details
            </span>
          </div>

          <div className={styles.loginHeroFeature}>
            <div className={styles.loginHeroIcon}>
              <ClipboardCheck size={18} color="white" />
            </div>
            <span className={styles.loginHeroFeatureText}>
              Submit business information for Hungry review
            </span>
          </div>

          <div className={styles.loginHeroFeature}>
            <div className={styles.loginHeroIcon}>
              <ShieldCheck size={18} color="white" />
            </div>
            <span className={styles.loginHeroFeatureText}>
              Get linked to the same Merchant Mode used in the app
            </span>
          </div>

          <div className={styles.loginHeroFeature}>
            <div className={styles.loginHeroIcon}>
              <CheckCircle2 size={18} color="white" />
            </div>
            <span className={styles.loginHeroFeatureText}>
              Receive next steps after email confirmation and review
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
