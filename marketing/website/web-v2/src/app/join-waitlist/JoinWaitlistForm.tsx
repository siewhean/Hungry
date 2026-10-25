"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChefHat, Store } from "lucide-react";
import { trackWebsiteEvent } from "@/lib/analytics/websiteEvents";
import styles from "./page.module.css";

type Audience = "foodie" | "merchant";
type BusinessType = "restaurant" | "cafe" | "home_based" | "hawker" | "food_court" | "other";
type FieldErrors = Partial<
  Record<
    "businessName" | "businessType" | "email" | "otherBusinessType" | "age" | "updates",
    string
  >
>;

const audienceOptions = [
  {
    id: "foodie",
    label: "I'm a foodie",
    icon: ChefHat,
  },
  {
    id: "merchant",
    label: "I'm a merchant",
    icon: Store,
  },
] as const;

const businessTypeOptions: readonly { label: string; value: BusinessType }[] = [
  { label: "Restaurant", value: "restaurant" },
  { label: "Cafe", value: "cafe" },
  { label: "Home-based business", value: "home_based" },
  { label: "Hawker", value: "hawker" },
  { label: "Food court", value: "food_court" },
  { label: "Others", value: "other" },
];

const audienceCopy: Record<
  Audience,
  { title: string; description: string; button: string; success: string }
> = {
  foodie: {
    title: "Join as a foodie",
    description: "Get an email when Hungry opens for early food discovery in Singapore.",
    button: "Join foodie waitlist",
    success: "You are on the foodie waitlist. We will email you when early access opens.",
  },
  merchant: {
    title: "Join as a merchant",
    description: "Get an email when Merchant Mode opens for Singapore food businesses.",
    button: "Join merchant waitlist",
    success: "You are on the merchant waitlist. We will email you when Merchant Mode opens.",
  },
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type JoinWaitlistFormProps = {
  initialAudience: Audience;
};

export default function JoinWaitlistForm({ initialAudience }: JoinWaitlistFormProps) {
  const [audience, setAudience] = useState<Audience>(initialAudience);
  const [email, setEmail] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [updatesRequested, setUpdatesRequested] = useState(false);
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType | "">("");
  const [otherBusinessType, setOtherBusinessType] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const selectedCopy = useMemo(() => audienceCopy[audience], [audience]);
  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    const event =
      audience === "merchant" ? "website_merchant_interest_started" : "website_waitlist_started";

    trackWebsiteEvent(event, {
      audience,
      source: "join_waitlist",
      route: "/join-waitlist",
    });
  }, [audience]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const nextErrors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      nextErrors.email = "Enter your email address.";
    } else if (!emailPattern.test(trimmedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!ageConfirmed) nextErrors.age = "Confirm you are 18 or older to join.";
    if (!updatesRequested)
      nextErrors.updates = "Confirm you want early-access emails for the selected list.";

    if (audience === "merchant" && businessType === "other" && !otherBusinessType.trim()) {
      nextErrors.otherBusinessType = "Specify your food business type.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setStatus("error");
      setErrorMessage("Check the highlighted fields and try again.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");
    setFieldErrors({});

    try {
      const establishmentType =
        audience === "merchant"
          ? businessType === "other"
            ? otherBusinessType.trim()
            : businessType
          : undefined;
      const response = await fetch("/api/waitlist", {
        body: JSON.stringify({
          audience,
          ageConfirmed,
          updatesRequested,
          businessName: audience === "merchant" ? businessName.trim() : undefined,
          email: trimmedEmail,
          establishmentType,
          name: name.trim(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to join waitlist.");
      }

      trackWebsiteEvent(
        audience === "merchant"
          ? "website_merchant_interest_submitted"
          : "website_waitlist_submitted",
        {
          audience,
          source: "join_waitlist",
          route: "/join-waitlist",
        },
      );
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to join waitlist.");
    }
  };

  if (status === "success") {
    return (
      <main className={styles.main}>
        <section className={styles.waitlist}>
          <div className={`${styles.containerWide} ${styles.successContainer}`}>
            <div className={`${styles.waitlistCard} ${styles.successCard}`}>
              <div className={styles.iconWrap}>
                <span aria-hidden>✓</span>
              </div>
              <h1 className={styles.successHeading}>You are on the list</h1>
              <p className={styles.successMessage} role="status">
                {selectedCopy.success}
              </p>
              <Link href="/" className={styles.secondaryCta}>
                Go back to home page
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.containerWide}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Hungry early access</span>
            <h1>Tell us how you want to use Hungry.</h1>
            <p>
              Join as a foodie if you want early access. Join as a merchant if you want to list a
              food business.
            </p>
          </div>

          <div className={styles.waitlistCard}>
            <div className={styles.tabList} role="tablist" aria-label="Join Hungry as">
              {audienceOptions.map((option) => {
                const Icon = option.icon;
                const isActive = audience === option.id;

                return (
                  <button
                    type="button"
                    key={option.id}
                    className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ""}`}
                    onClick={() => {
                      if (option.id === audience) {
                        return;
                      }
                      setAudience(option.id);
                      setStatus("idle");
                      setErrorMessage("");
                      setFieldErrors({});
                      if (option.id === "foodie") {
                        setBusinessName("");
                        setBusinessType("");
                        setOtherBusinessType("");
                      }
                    }}
                    id={`audience-tab-${option.id}`}
                    role="tab"
                    aria-controls="waitlist-panel"
                    tabIndex={isActive ? 0 : -1}
                    onKeyDown={(event) => {
                      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                      event.preventDefault();
                      const next =
                        event.key === "Home"
                          ? "foodie"
                          : event.key === "End"
                            ? "merchant"
                            : audience === "foodie"
                              ? "merchant"
                              : "foodie";
                      document.getElementById(`audience-tab-${next}`)?.click();
                      document.getElementById(`audience-tab-${next}`)?.focus();
                    }}
                    aria-selected={isActive}
                  >
                    <Icon size={17} aria-hidden />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
            <div
              className={styles.cardContent}
              id="waitlist-panel"
              aria-labelledby={`audience-tab-${audience}`}
              role="tabpanel"
            >
              <h2>{selectedCopy.title}</h2>
              <p>{selectedCopy.description}</p>
              <form className={styles.form} onSubmit={handleSubmit}>
                <label className={styles.label} htmlFor="waitlist-name">
                  First name <span>(optional)</span>
                </label>
                <input
                  id="waitlist-name"
                  className={styles.input}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  type="text"
                  placeholder="What should we call you?"
                  autoComplete="given-name"
                  maxLength={120}
                />

                <label className={styles.label} htmlFor="waitlist-email">
                  Email address
                </label>
                <input
                  id="waitlist-email"
                  className={styles.input}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (fieldErrors.email) {
                      clearFieldError("email");
                    }
                  }}
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  placeholder="you@example.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "waitlist-email-error" : undefined}
                />
                {fieldErrors.email ? (
                  <div className={styles.fieldError} id="waitlist-email-error" role="alert">
                    {fieldErrors.email}
                  </div>
                ) : null}

                {audience === "merchant" ? (
                  <div key="merchant-extra" className={styles.merchantTransition}>
                    <label className={styles.label} htmlFor="waitlist-business-name">
                      Business name (optional)
                    </label>
                    <input
                      id="waitlist-business-name"
                      className={styles.input}
                      value={businessName}
                      onChange={(event) => {
                        setBusinessName(event.target.value);
                        if (fieldErrors.businessName) {
                          clearFieldError("businessName");
                        }
                      }}
                      type="text"
                      maxLength={160}
                      placeholder="Your business name"
                      aria-invalid={Boolean(fieldErrors.businessName)}
                      aria-describedby={
                        fieldErrors.businessName ? "waitlist-business-name-error" : undefined
                      }
                    />
                    {fieldErrors.businessName ? (
                      <div
                        className={styles.fieldError}
                        id="waitlist-business-name-error"
                        role="alert"
                      >
                        {fieldErrors.businessName}
                      </div>
                    ) : null}

                    <label className={styles.label} htmlFor="waitlist-business-type">
                      Food business type (optional)
                    </label>
                    <select
                      id="waitlist-business-type"
                      className={styles.input}
                      value={businessType}
                      onChange={(event) => {
                        const value = event.target.value as BusinessType | "";
                        setBusinessType(value);
                        if (fieldErrors.businessType) {
                          clearFieldError("businessType");
                        }
                        if (value !== "other") {
                          setOtherBusinessType("");
                          clearFieldError("otherBusinessType");
                        }
                      }}
                      aria-invalid={Boolean(fieldErrors.businessType)}
                      aria-describedby={
                        fieldErrors.businessType ? "waitlist-business-type-error" : undefined
                      }
                    >
                      <option value="">Select business type</option>
                      {businessTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.businessType ? (
                      <div
                        className={styles.fieldError}
                        id="waitlist-business-type-error"
                        role="alert"
                      >
                        {fieldErrors.businessType}
                      </div>
                    ) : null}

                    {businessType === "other" ? (
                      <>
                        <label className={styles.label} htmlFor="waitlist-business-type-other">
                          Tell us the business type
                        </label>
                        <input
                          id="waitlist-business-type-other"
                          className={styles.input}
                          value={otherBusinessType}
                          onChange={(event) => {
                            setOtherBusinessType(event.target.value);
                            if (fieldErrors.otherBusinessType) {
                              clearFieldError("otherBusinessType");
                            }
                          }}
                          type="text"
                          required
                          maxLength={80}
                          placeholder="For example, supper pop-up or catering"
                          aria-invalid={Boolean(fieldErrors.otherBusinessType)}
                          aria-describedby={
                            fieldErrors.otherBusinessType
                              ? "waitlist-business-type-other-error"
                              : undefined
                          }
                        />
                        {fieldErrors.otherBusinessType ? (
                          <div
                            className={styles.fieldError}
                            id="waitlist-business-type-other-error"
                            role="alert"
                          >
                            {fieldErrors.otherBusinessType}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}

                <label className={styles.consentLabel}>
                  <input
                    type="checkbox"
                    checked={ageConfirmed}
                    required
                    onChange={(event) => {
                      setAgeConfirmed(event.target.checked);
                      clearFieldError("age");
                    }}
                  />
                  <span>I am 18 or older. Hungry is currently for adults.</span>
                </label>
                <label className={styles.consentLabel}>
                  <input
                    type="checkbox"
                    checked={updatesRequested}
                    required
                    onChange={(event) => {
                      setUpdatesRequested(event.target.checked);
                      clearFieldError("updates");
                    }}
                  />
                  <span>
                    Email me about early access for the {audience} list I selected. I can withdraw
                    by emailing usehungrysingapore@gmail.com. This does not sign me up for other
                    marketing.
                  </span>
                </label>
                <div className={styles.fieldMeta}>
                  We use these details to manage your selected waitlist.{" "}
                  <Link href="/privacy" className={styles.privacyLink}>
                    Privacy Policy
                  </Link>
                  .
                </div>

                {status === "error" ? (
                  <div className={styles.fieldMeta} role="alert">
                    {errorMessage}
                  </div>
                ) : null}

                <button className={styles.primaryCta} type="submit" disabled={status === "loading"}>
                  {status === "loading" ? "Submitting..." : selectedCopy.button}
                  <ArrowRight aria-hidden size={18} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
