"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type RevealProps = {
  as?: "div" | "section" | "article" | "li";
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  once?: boolean;
};

export function Reveal({
  as = "div",
  children,
  className,
  delay = 0,
  distance = 28,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const setNodeRef = (node: HTMLElement | null) => {
    ref.current = node;
  };

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (shouldReduceMotion) {
      const frame = window.requestAnimationFrame(() => setIsVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.disconnect();
          }
          return;
        }

        if (!once) {
          setIsVisible(false);
        }
      },
      { rootMargin: "-12% 0px -12% 0px", threshold: 0.22 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once]);

  const style: CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "translateY(0) scale(1)" : `translateY(${distance}px) scale(0.985)`,
    filter: isVisible ? "blur(0)" : "blur(8px)",
    transition: `opacity 720ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 720ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, filter 720ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
    willChange: isVisible ? "auto" : "opacity, transform, filter",
  };

  if (as === "section") {
    return (
      <section className={className} ref={setNodeRef} style={style}>
        {children}
      </section>
    );
  }

  if (as === "article") {
    return (
      <article className={className} ref={setNodeRef} style={style}>
        {children}
      </article>
    );
  }

  if (as === "li") {
    return (
      <li className={className} ref={setNodeRef} style={style}>
        {children}
      </li>
    );
  }

  return (
    <div className={className} ref={setNodeRef} style={style}>
      {children}
    </div>
  );
}
