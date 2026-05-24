"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { StoryScreen } from "@/content/site";
import { AppScreenshotFrame } from "./AppScreenshotFrame";
import { DiscoveryPhoneMockup } from "./DiscoveryPhoneMockup";
import styles from "./StickyScreenStory.module.css";

type StickyScreenStoryProps = {
  screens: readonly StoryScreen[];
};

export function StickyScreenStory({ screens }: StickyScreenStoryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return undefined;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      stepRefs.current.forEach((step, index) => {
        if (!step) return;

        ScrollTrigger.create({
          trigger: step,
          start: "top 75%",
          end: "bottom 25%",
          onToggle: ({ isActive }) => {
            if (isActive) {
              setActiveIndex(index);
            }
          },
        });

        gsap.fromTo(
          step,
          { autoAlpha: 0.35, y: 28 },
          {
            autoAlpha: 1,
            y: 0,
            ease: "power3.out",
            scrollTrigger: {
              trigger: step,
              start: "top 82%",
              end: "bottom 18%",
              scrub: 0.45,
            },
          },
        );
      });
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
              {index < 2 ? (
                <figure className={styles.phonePreviewFrame} aria-label={screen.alt}>
                  <DiscoveryPhoneMockup />
                  <figcaption>{screen.stat}</figcaption>
                </figure>
              ) : (
                <AppScreenshotFrame
                  src={screen.src}
                  alt={screen.alt}
                  label={screen.stat}
                  orientation="landscape"
                />
              )}
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
