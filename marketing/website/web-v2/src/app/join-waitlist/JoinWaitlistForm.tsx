"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, ChefHat, Store } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./page.module.css";

type Audience = "foodie" | "merchant";
type BusinessType = "restaurant" | "cafe" | "home_based" | "hawker" | "food_court" | "other";

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

const audienceCopy: Record<Audience, { title: string; description: string; button: string; success: string }> =
  {
    foodie: {
      title: "Join the foodie waitlist",
      description:
        "Get early access when Hungry opens for food discovery across Singapore.",
      button: "Join foodie waitlist",
      success: "You're on the foodie waitlist. We'll email you when early access opens.",
    },
    merchant: {
      title: "Join the merchant waitlist",
      description:
        "Get updates when Merchant Mode opens for Singapore food businesses.",
      button: "Join merchant waitlist",
      success: "You're on the merchant waitlist. We'll email you when Merchant Mode opens.",
    },
  };

type JoinWaitlistFormProps = {
  initialAudience: Audience;
};

const merchantTransitionVariants = {
  enter: (direction: 1 | -1) => ({
    opacity: 0,
    y: direction === 1 ? -18 : 18,
    height: 0,
  }),
  visible: {
    opacity: 1,
    y: 0,
    height: "auto",
  },
  exit: (direction: 1 | -1) => ({
    opacity: 0,
    y: direction === 1 ? 18 : -18,
    height: 0,
  }),
};

export default function JoinWaitlistForm({ initialAudience }: JoinWaitlistFormProps) {
  const [audience, setAudience] = useState<Audience>(initialAudience);
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType | "">("");
  const [otherBusinessType, setOtherBusinessType] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedCopy = useMemo(() => audienceCopy[audience], [audience]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!email.trim()) {
      return;
    }

    if (audience === "merchant") {
      if (!businessType) {
        setStatus("error");
        setErrorMessage("Select the type of food business you are applying for.");
        return;
      }

      if (businessType === "other" && !otherBusinessType.trim()) {
        setStatus("error");
        setErrorMessage("Specify your food business type.");
        return;
      }
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const establishmentType =
        audience === "merchant"
          ? businessType === "other"
            ? otherBusinessType.trim()
            : businessType
          : undefined;
      const response = await fetch("/api/waitlist", {
        body: JSON.stringify({ audience, email, establishmentType, name }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to join waitlist.");
      }
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
          <div className={styles.containerWide}>
            <div className={styles.waitlistCard}>
              <div className={styles.iconWrap}>
                <span>Success</span>
              </div>
              <p className={styles.successMessage}>{selectedCopy.success}</p>
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setErrorMessage("");
                  setEmail("");
                  setName("");
                  setBusinessType("");
                  setOtherBusinessType("");
                }}
                className={styles.secondaryCta}
              >
                Add another submission
              </button>
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
            <h1>Choose your Hungry updates.</h1>
            <p>
              Hungry is launching in stages. Join as a foodie for early access, or as a merchant for Merchant Mode updates.
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
                      setTransitionDirection(option.id === "merchant" ? 1 : -1);
                      setAudience(option.id);
                      setStatus("idle");
                      setErrorMessage("");
                    }}
                    role="tab"
                    aria-selected={isActive}
                  >
                    <Icon size={17} aria-hidden />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
            <motion.div
              className={styles.cardContent}
              role="tabpanel"
              layout="position"
              transition={{ layout: { duration: 0.28, ease: "easeInOut" } }}
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
                  placeholder="How should we address you?"
                />

                <label className={styles.label} htmlFor="waitlist-email">
                  Email address
                </label>
                <input
                  id="waitlist-email"
                  className={styles.input}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  required
                  placeholder="you@example.com"
                />

                <AnimatePresence
                  mode="wait"
                  initial={false}
                  custom={transitionDirection}
                >
                  {audience === "merchant" ? (
                    <motion.div
                      key="merchant-extra"
                      className={styles.merchantTransition}
                      layout="position"
                      variants={merchantTransitionVariants}
                      custom={transitionDirection}
                      initial="enter"
                      animate="visible"
                      exit="exit"
                      transition={{ duration: 0.28, ease: "easeInOut" }}
                    >
                      <label className={styles.label} htmlFor="waitlist-business-type">
                        Food business type
                      </label>
                      <select
                        id="waitlist-business-type"
                        className={styles.input}
                        value={businessType}
                        onChange={(event) => {
                          const value = event.target.value as BusinessType | "";
                          setBusinessType(value);
                          if (value !== "other") {
                            setOtherBusinessType("");
                          }
                        }}
                        required
                      >
                        <option value="">Select business type</option>
                        {businessTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      {businessType === "other" ? (
                        <>
                          <label className={styles.label} htmlFor="waitlist-business-type-other">
                            Specify business type
                          </label>
                          <input
                            id="waitlist-business-type-other"
                            className={styles.input}
                            value={otherBusinessType}
                            onChange={(event) => setOtherBusinessType(event.target.value)}
                            type="text"
                            required
                            placeholder="Tell us what type of food business you run"
                          />
                        </>
                      ) : null}
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className={styles.fieldMeta}>
                  We&apos;ll only email you about the updates you selected.
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
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  );
}
