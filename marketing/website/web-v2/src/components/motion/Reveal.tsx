"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

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
  const shouldReduceMotion = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      initial={{
        opacity: 0,
        y: shouldReduceMotion ? 0 : distance,
        scale: shouldReduceMotion ? 1 : 0.985,
        filter: shouldReduceMotion ? "none" : "blur(8px)",
      }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={{ once, margin: "-12% 0px -12% 0px", amount: 0.22 }}
      transition={{
        duration: shouldReduceMotion ? 0.15 : 0.72,
        delay: shouldReduceMotion ? 0 : delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </Component>
  );
}
