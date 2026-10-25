"use client";

import { useRef } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ImageAsset } from "@/content/site";
import styles from "./HawkerCultureCarousel.module.css";

type CultureCard = {
  title: string;
  description: string;
  image: ImageAsset;
};

type HawkerCultureCarouselProps = {
  cards: readonly CultureCard[];
};

export function HawkerCultureCarousel({ cards }: HawkerCultureCarouselProps) {
  const railRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "previous" | "next") => {
    const rail = railRef.current;
    if (!rail) return;
    const delta = rail.clientWidth * 0.74 * (direction === "next" ? 1 : -1);
    rail.scrollBy({
      left: delta,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };

  return (
    <div className={styles.carouselShell}>
      <div className={styles.controls}>
        <button
          type="button"
          onClick={() => scroll("previous")}
          aria-label="Previous food culture card"
        >
          <ArrowLeft size={18} />
        </button>
        <button type="button" onClick={() => scroll("next")} aria-label="Next food culture card">
          <ArrowRight size={18} />
        </button>
      </div>
      <div
        className={styles.rail}
        ref={railRef}
        role="region"
        aria-label="Singapore food culture cards"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            scroll(event.key === "ArrowLeft" ? "previous" : "next");
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            event.currentTarget.scrollTo({
              left: event.key === "Home" ? 0 : event.currentTarget.scrollWidth,
              behavior: "instant",
            });
          }
        }}
      >
        {cards.map((card, index) => (
          <article className={styles.card} key={card.title}>
            <Image
              src={card.image.src}
              alt={card.image.alt}
              className={styles.image}
              fill
              sizes="(max-width: 760px) 82vw, 32vw"
            />
            <div className={styles.cardOverlay}>
              <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
