"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { merchantPage } from "@/content/site";
import { trackWebsiteEvent } from "@/lib/analytics/websiteEvents";
import { Reveal } from "../../components/motion/Reveal";
import { AppScreenshotFrame } from "../../components/home/AppScreenshotFrame";
import styles from "./MerchantStory.module.css";

interface WorkflowStep {
  title: string;
  description: string;
  image: string;
}

export default function MerchantStory() {
  const [activeStep, setActiveStep] = useState(0);
  const steps = merchantPage.workflow.steps;
  const active = steps[activeStep] ?? steps[0];

  if (!active) {
    return null;
  }

  return (
    <section className={styles.section} id="merchant-flow">
      <div className={`container-wide ${styles.grid}`}>
        <Reveal className={styles.copy}>
          <span className={styles.eyebrow}>Merchant Mode preview</span>
          <h2>From stall claim to daily updates.</h2>
          <p>
            Claim an existing stall or apply for a new one, verify your business, then keep menus, profile details, and opening hours current.
          </p>

          <div className={styles.steps} role="tablist" aria-label="Merchant workflow">
            {steps.map((step: WorkflowStep, index: number) => (
              <button
                aria-controls="merchant-proof-panel"
                aria-selected={activeStep === index}
                className={`${styles.stepButton} ${activeStep === index ? styles.active : ""}`}
                key={step.title}
                onClick={() => setActiveStep(index)}
                role="tab"
                type="button"
              >
                <span>0{index + 1}</span>
                <strong>{step.title}</strong>
              </button>
            ))}
          </div>

          <Link
            className={styles.cta}
            href="/join-waitlist?audience=merchant"
            onClick={() =>
              trackWebsiteEvent("website_cta_clicked", {
                cta_label: "Join merchant waitlist",
                cta_destination: "/join-waitlist?audience=merchant",
                cta_section: "merchant-story",
              })
            }
          >
            Join merchant waitlist
            <ArrowRight aria-hidden size={20} />
          </Link>
        </Reveal>

        <Reveal className={styles.visual} delay={0.12}>
          <div className={styles.screenWrap} id="merchant-proof-panel" key={active.title} role="tabpanel">
              <AppScreenshotFrame
                alt={`${active.title} screen`}
                label={active.title}
                orientation="landscape"
                src={active.image}
              />
              <div className={styles.caption}>
                <BadgeCheck aria-hidden size={20} />
                <p>{active.description}</p>
              </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
