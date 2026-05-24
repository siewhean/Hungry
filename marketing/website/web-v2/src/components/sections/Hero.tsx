"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { homepage } from "../../content/site";
import { DiscoveryPhoneMockup } from "../home/DiscoveryPhoneMockup";
import styles from "./Hero.module.css";

export default function Hero() {
  const shouldReduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (shouldReduceMotion) return undefined;

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

    return () => ctx.revert();
  }, [shouldReduceMotion]);

  return (
    <section className={styles.heroSection} ref={heroRef}>
      <div className={styles.atmosphere} aria-hidden="true">
        <Image
          src={homepage.hero.atmosphere.src}
          alt=""
          className={`${styles.atmosphereImage} ${styles.parallaxSlow}`}
          fill
          priority
          sizes="100vw"
        />
        <div className={styles.atmosphereVeil} />
      </div>

      <div className={`container-wide ${styles.heroContainer}`}>
        <div className={styles.textContent}>
          <p className={styles.eyebrow}>{homepage.hero.eyebrow}</p>
          <h1 className={styles.headline}>
            {homepage.hero.lines.map((line) => (
              <span className={styles.lineMask} key={line}>
                <span className={styles.headlineLine}>{line}</span>
              </span>
            ))}
          </h1>
          <p className={`${styles.proofLine} ${styles.copyReveal}`}>{homepage.hero.proof}</p>
          <p className={`${styles.description} ${styles.copyReveal}`}>{homepage.hero.body}</p>

          <div className={`${styles.ctas} ${styles.copyReveal}`}>
            <Link href={homepage.hero.primaryCta.href} className={styles.primaryCta}>
              {homepage.hero.primaryCta.label}
            </Link>
            <Link href={homepage.hero.secondaryCta.href} className={styles.secondaryCta}>
              {homepage.hero.secondaryCta.label}
            </Link>
          </div>
        </div>

        <div className={styles.visualContent} aria-label="Hungry app and food preview">
          <div className={`${styles.previewStage} ${styles.visualLayer}`}>
            <div className={styles.phoneWrapper}>
              <motion.div className={styles.phoneMockup}>
                <DiscoveryPhoneMockup />
              </motion.div>
            </div>

            <div className={styles.foodOrbit}>
              {homepage.hero.foodCards.map((card, index) => (
                <motion.div
                  className={`${styles.foodCard} ${styles[`foodCard${index + 1}`]}`}
                  key={card.src}
                  whileHover={{ scale: 1.06, rotate: index % 2 === 0 ? -2 : 2 }}
                  transition={{ duration: 0.26 }}
                >
                  <Image
                    src={card.src}
                    alt={card.alt}
                    className={styles.foodCardImage}
                    fill
                    sizes="(max-width: 760px) 30vw, 14vw"
                    draggable={false}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          <div className={styles.chipLayer}>
            {homepage.hero.cards.map((card, index) => (
              <motion.span
                key={card.label}
                className={`${styles.floatChip} ${styles[`chip${index + 1}`]} ${styles[card.tone]}`}
                whileHover={{ y: -4, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {card.label}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
