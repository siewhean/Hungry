"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { DiscoveryPhoneMockup } from "../home/DiscoveryPhoneMockup";
import { homepage } from "@/content/site";
import { trackWebsiteEvent } from "@/lib/analytics/websiteEvents";
import styles from "./Hero.module.css";

export default function Hero() {
  const hero = homepage.hero;
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (shouldReduceMotion) return undefined;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapModule, scrollTriggerModule]) => {
        if (cancelled) return;

        const gsap = gsapModule.default;
        const ScrollTrigger = scrollTriggerModule.ScrollTrigger;
        gsap.registerPlugin(ScrollTrigger);

        const ctx = gsap.context(() => {
          const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

          timeline
            .fromTo(
              `.${styles.eyebrow}`,
              { autoAlpha: 0, y: 14 },
              { autoAlpha: 1, y: 0, duration: 0.5 },
            )
            .fromTo(
              `.${styles.headlineLine}`,
              { yPercent: 110 },
              { yPercent: 0, duration: 0.88, stagger: 0.12 },
              "-=0.1",
            )
            .fromTo(
              `.${styles.copyReveal}`,
              { autoAlpha: 0, y: 22 },
              { autoAlpha: 1, y: 0, duration: 0.68, stagger: 0.08 },
              "-=0.35",
            )
            .fromTo(
              `.${styles.visualLayer}`,
              { autoAlpha: 0, y: 46, scale: 0.96 },
              { autoAlpha: 1, y: 0, scale: 1, duration: 0.82, stagger: 0.08 },
              "-=0.62",
            )
            .fromTo(
              `.${styles.floatChip}`,
              { autoAlpha: 0, y: 18, scale: 0.94 },
              { autoAlpha: 1, y: 0, scale: 1, duration: 0.52, stagger: 0.06 },
              "-=0.34",
            );

          gsap.to(`.${styles.parallaxSlow}`, {
            yPercent: -14,
            ease: "none",
            scrollTrigger: {
              trigger: heroRef.current,
              start: "top top",
              end: "bottom top",
              scrub: 0.7,
            },
          });

          gsap.to(`.${styles.parallaxFast}`, {
            yPercent: -28,
            ease: "none",
            scrollTrigger: {
              trigger: heroRef.current,
              start: "top top",
              end: "bottom top",
              scrub: 0.7,
            },
          });
        }, heroRef);

        cleanup = () => ctx.revert();
      },
    );

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <section className={styles.heroSection} ref={heroRef}>
      <div className={styles.atmosphere} aria-hidden="true">
        <Image
          src={hero.atmosphere.src}
          alt=""
          aria-hidden="true"
          className={`${styles.atmosphereImage} ${styles.parallaxSlow}`}
          fill
          priority
          sizes="100vw"
        />
        <div className={styles.atmosphereVeil} />
      </div>

      <div className={`container-wide ${styles.heroContainer}`}>
        <div className={styles.textContent}>
          <p className={styles.eyebrow}>{hero.eyebrow}</p>
          <h1 className={styles.headline}>
            {hero.lines.map((line) => (
              <span className={styles.lineMask} key={line}>
                <span className={styles.headlineLine}>
                  {line}
                </span>
              </span>
            ))}
          </h1>
          <p className={`${styles.proofLine} ${styles.copyReveal}`}>{hero.proof}</p>
          <p className={`${styles.description} ${styles.copyReveal}`}>{hero.body}</p>

          <div className={`${styles.ctas} ${styles.copyReveal}`}>
            <Link
              href={hero.primaryCta.href}
              className={styles.primaryCta}
              onClick={() =>
                trackWebsiteEvent("website_cta_clicked", {
                  cta_label: hero.primaryCta.label,
                  cta_destination: hero.primaryCta.href,
                  cta_section: "hero",
                })
              }
            >
              <span className={styles.ctaText}>{hero.primaryCta.label}</span>
              <ArrowRight size={20} strokeWidth={2.5} className={styles.ctaIcon} />
            </Link>
            <Link
              href={hero.secondaryCta.href}
              className={styles.secondaryCta}
              onClick={() =>
                trackWebsiteEvent("website_cta_clicked", {
                  cta_label: hero.secondaryCta.label,
                  cta_destination: hero.secondaryCta.href,
                  cta_section: "hero",
                })
              }
            >
              {hero.secondaryCta.label}
            </Link>
          </div>
        </div>

        <div className={styles.visualContent} aria-label="Hungry app and food preview">
          <div className={`${styles.previewStage} ${styles.visualLayer} ${styles.parallaxFast}`}>
            <div className={styles.phoneWrapper}>
              <div className={styles.phoneMockup}>
                <DiscoveryPhoneMockup />
              </div>
            </div>

            <div className={styles.foodOrbit}>
              {hero.foodCards.map((card, index) => (
                <div
                  className={`${styles.foodCard} ${styles[`foodCard${index + 1}`]}`}
                  key={card.src}
                >
                  <Image
                    src={card.src}
                    alt={card.alt}
                    className={styles.foodCardImage}
                    fill
                    sizes="(max-width: 760px) 30vw, 14vw"
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={styles.chipLayer}>
            {hero.cards.map((card, index) => (
              <span
                key={card.label}
                className={`${styles.floatChip} ${styles[`chip${index + 1}`]} ${styles[card.tone]}`}
              >
                {card.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
