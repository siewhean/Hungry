import type { ReactNode } from "react";

interface PhonePreviewProps {
  title: string;
  eyebrow?: string;
  meta?: string;
  inverted?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function PhonePreview({
  title,
  eyebrow,
  meta,
  inverted = false,
  className = "",
  bodyClassName = "",
  children,
}: PhonePreviewProps) {
  const shellClass = inverted
    ? "border-white/10 bg-hungry-navy text-white"
    : "border-hungry-border bg-white text-hungry-text";
  const dividerClass = inverted ? "border-white/10" : "border-hungry-border";
  const eyebrowClass = inverted ? "text-white/64" : "text-hungry-text-muted";
  const metaClass = inverted ? "text-white/54" : "text-hungry-text-muted";

  return (
    <article
      className={`overflow-hidden rounded-[30px] border shadow-[0_30px_80px_-56px_rgba(26,46,68,0.42)] ${shellClass} ${className}`.trim()}
    >
      <div className={`border-b px-4 py-3 ${dividerClass}`}>
        <div className="mb-2 flex items-center justify-between gap-4">
          <span className={`font-mono text-[10px] uppercase tracking-[0.18em] ${eyebrowClass}`}>
            {eyebrow ?? "Hungry"}
          </span>
          {meta ? <span className={`font-mono text-[10px] ${metaClass}`}>{meta}</span> : null}
        </div>
        <h3 className="text-sm font-semibold tracking-[-0.015em]">{title}</h3>
      </div>
      <div className={`p-4 ${bodyClassName}`.trim()}>{children}</div>
    </article>
  );
}
