"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { StoryScreen } from "@/content/site";
import { DiscoveryPhoneMockup, type DiscoveryPhoneMockupScreen } from "./DiscoveryPhoneMockup";
import styles from "./StickyScreenStory.module.css";

type StickyScreenStoryProps = {
  screens: readonly StoryScreen[];
  animateContent?: boolean;
};

const storyScreens: readonly DiscoveryPhoneMockupScreen[] = [
  "discover",
  "stall-detail",
  "stall-menu",
  "review-feed",
];

export function StickyScreenStory({
  screens,
  animateContent = false,
}: StickyScreenStoryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const updateActiveStep = () => {
        const viewportAnchor = window.innerHeight * 0.52;
        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;

        stepRefs.current.forEach((step, index) => {
          if (!step) return;

          const rect = step.getBoundingClientRect();
          const stepAnchor = rect.top + rect.height * 0.42;
          const distance = Math.abs(stepAnchor - viewportAnchor);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        });

        setActiveIndex((current) => (current === closestIndex ? current : closestIndex));
      };

      ScrollTrigger.create({
        trigger: rootRef.current,
        start: "top bottom",
        end: "bottom top",
        onEnter: updateActiveStep,
        onEnterBack: updateActiveStep,
        onUpdate: updateActiveStep,
        onRefresh: updateActiveStep,
      });

      updateActiveStep();
    }, rootRef);

    return () => ctx.revert();
  }, [screens.length]);

  return (
    <div ref={rootRef} className={styles.story}>
      <div className={styles.visualRail} aria-live="polite">
        <div className={styles.deviceDeck}>
          {screens.map((screen, index) => (
            <div
              className={`${styles.screenLayer} ${index === activeIndex ? styles.active : ""}`}
              key={screen.title}
            >
              <figure className={styles.phonePreviewFrame} aria-label={screen.alt}>
                <DiscoveryPhoneMockup
                  screen={storyScreens[index] ?? "discover"}
                  isActive={index === activeIndex}
                  animateContent={animateContent}
                />
                <figcaption>{screen.stat}</figcaption>
              </figure>
            </div>
          ))}
        </div>
        <div className={styles.progressDots} aria-label="Product story progress">
          {screens.map((screen, index) => (
            <button
              type="button"
              key={screen.eyebrow}
              className={`${styles.progressDot} ${index === activeIndex ? styles.progressDotActive : ""}`}
              onClick={() => {
                stepRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              aria-label={`Show ${screen.title}`}
              aria-current={index === activeIndex ? "step" : undefined}
            />
          ))}
        </div>
      </div>

      <div className={styles.copyRail}>
        {screens.map((screen, index) => (
          <div
            key={screen.title}
            ref={(node) => {
              stepRefs.current[index] = node;
            }}
            className={`${styles.step} ${index === activeIndex ? styles.stepActive : ""}`}
          >
            <span className={styles.eyebrow}>{screen.eyebrow}</span>
            <h3>{screen.title}</h3>
            <p>{screen.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
