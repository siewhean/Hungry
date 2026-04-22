import type { ReactNode } from "react";

interface SectionEyebrowProps {
  children: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}

export function SectionEyebrow({ children, tone = "light", className = "" }: SectionEyebrowProps) {
  const toneClass = tone === "dark" ? "text-white/72" : "text-hungry-orange";

  return (
    <p
      className={`font-mono text-[11px] uppercase tracking-[0.22em] ${toneClass} ${className}`.trim()}
    >
      {children}
    </p>
  );
}
