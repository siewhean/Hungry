"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { merchantPage } from "@/content/site";
import { Reveal } from "../../components/motion/Reveal";
import { AppScreenshotFrame } from "../../components/home/AppScreenshotFrame";
import styles from "./MerchantStory.module.css";

export default function MerchantStory() {
  const [activeStep, setActiveStep] = useState(0);
  const steps = merchantPage.workflow.steps;
  const active = steps[activeStep];

  return (
    <section className={styles.section} id="merchant-flow">
      <div className={`container-wide ${styles.grid}`}>
        <Reveal className={styles.copy}>
          <span className={styles.eyebrow}>Merchant discovery story</span>
          <h2>Make every dish easier to find before a diner arrives.</h2>
          <p>
            The merchant surface is framed as operational proof: menus, hours, and profile details
            can move with the business instead of going stale.
          </p>

          <div className={styles.steps} role="tablist" aria-label="Merchant workflow">
            {steps.map((step, index) => (
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

          <Link className={styles.cta} href="/for-merchants">
            Register merchant interest
            <ArrowRight aria-hidden size={20} />
          </Link>
        </Reveal>

        <Reveal className={styles.visual} delay={0.12}>
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={styles.screenWrap}
              exit={{ opacity: 0, scale: 0.98, y: 16 }}
              id="merchant-proof-panel"
              initial={{ opacity: 0, scale: 1.02, y: 18 }}
              key={active.title}
              role="tabpanel"
              transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            >
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
            </motion.div>
          </AnimatePresence>
        </Reveal>
      </div>
    </section>
  );
}
