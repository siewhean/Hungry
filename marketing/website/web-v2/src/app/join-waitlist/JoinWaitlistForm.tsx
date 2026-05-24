"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, ChefHat, Store } from "lucide-react";
import styles from "./page.module.css";

type Audience = "foodie" | "merchant";

const audienceOptions = [
  {
    id: "foodie",
    label: "I am a foodie",
    icon: ChefHat,
  },
  {
    id: "merchant",
    label: "I am a merchant",
    icon: Store,
  },
] as const;

const audienceCopy: Record<Audience, { title: string; description: string; button: string; success: string }> =
  {
    foodie: {
      title: "Get early access",
      description:
        "Join the foodie waitlist and we will notify you when Hungry launches in Singapore.",
      button: "Join Waitlist",
      success: "You are on the foodie waitlist. We will be in touch soon.",
    },
    merchant: {
      title: "Register merchant interest",
      description:
        "Register interest and we will contact you when merchant onboarding opens in Singapore.",
      button: "Register Interest",
      success: "Your merchant interest has been recorded. We will contact you soon.",
    },
  };

type JoinWaitlistFormProps = {
  initialAudience: Audience;
};

export default function JoinWaitlistForm({ initialAudience }: JoinWaitlistFormProps) {
  const [audience, setAudience] = useState<Audience>(initialAudience);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "success">("idle");

  const selectedCopy = useMemo(() => audienceCopy[audience], [audience]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!email.trim()) {
      return;
    }

    setStatus("success");
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
                  setEmail("");
                  setName("");
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
            <span className={styles.eyebrow}>Hungry launch access</span>
            <h1>Choose how you want to join.</h1>
            <p>
              We are in early access mode. Tell us whether you want foodie access or merchant
              onboarding updates and we will reach out when we are ready.
            </p>

            <div className={styles.toggleRow} role="group" aria-label="Join as role">
              {audienceOptions.map((option) => {
                const Icon = option.icon;
                const isActive = audience === option.id;

                return (
                  <button
                    type="button"
                    key={option.id}
                    className={`${styles.toggleButton} ${isActive ? styles.toggleButtonActive : ""}`}
                    onClick={() => setAudience(option.id)}
                    aria-pressed={isActive}
                  >
                    <Icon size={17} aria-hidden />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.waitlistCard}>
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

              <div className={styles.fieldMeta}>
                By submitting, you are signing up for {audience === "merchant" ? "merchant" : "foodie"} updates.
              </div>

              <button className={styles.primaryCta} type="submit">
                {selectedCopy.button}
                <ArrowRight aria-hidden size={18} />
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
