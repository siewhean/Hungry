"use client";

import { useId, useState } from "react";

interface WaitlistFormProps {
  mode?: "consumer" | "hawker";
  surface?: "light" | "dark";
  variant?: "hero" | "footer" | "inline";
  id?: string;
  className?: string;
}

const JOINING_AS_OPTIONS = [
  { value: "diner", label: "Diner" },
  { value: "hawker", label: "Hawker" },
  { value: "both", label: "Both" },
] as const;

export function WaitlistForm({
  mode = "consumer",
  surface,
  variant = "inline",
  id,
  className = "",
}: WaitlistFormProps) {
  const formTone = surface ?? (variant === "footer" ? "dark" : "light");
  const defaultJoiningAs = mode === "hawker" ? "hawker" : "diner";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [joiningAs, setJoiningAs] = useState<"diner" | "hawker" | "both">(defaultJoiningAs);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const emailId = useId();
  const nameId = useId();
  const radioName = useId();

  const isDark = formTone === "dark";
  const title = mode === "hawker" ? "Register hawker interest" : "Get early access";
  const helperText =
    mode === "hawker"
      ? "Register once. We will only contact you when merchant visibility updates are ready."
      : "One email. No spam. Just launch updates and early-access news.";
  const submitLabel = mode === "hawker" ? "Register hawker interest" : "Join the waitlist";
  const successTitle = mode === "hawker" ? "Interest registered." : "You are on the list.";
  const successBody =
    mode === "hawker"
      ? "Thanks for registering your interest. We will reach out when merchant visibility tools are ready to preview."
      : "Thanks for joining the Hungry waitlist. We will reach out when early access opens and when there is something genuinely worth seeing.";
  const successFollowUp =
    mode === "hawker"
      ? "The current focus stays consumer-first. We will keep you updated as the stall-side flow matures."
      : "If someone always decides lunch for the group, send them here too.";

  const shellClass = isDark
    ? "border-white/10 bg-white/6 text-white"
    : "border-hungry-border bg-white text-hungry-text";
  const labelClass = isDark ? "text-white/72" : "text-hungry-text-secondary";
  const inputClass = isDark
    ? "border-white/14 bg-white/6 text-white placeholder:text-white/42 focus:border-white/24 focus:ring-white/16"
    : "border-hungry-border bg-white text-hungry-text placeholder:text-hungry-text-muted focus:border-hungry-orange/40 focus:ring-hungry-orange/18";
  const toggleBaseClass = isDark
    ? "border-white/12 bg-transparent text-white/80"
    : "border-hungry-border bg-white text-hungry-text-secondary";
  const toggleActiveClass = isDark
    ? "border-white/22 bg-white text-hungry-navy shadow-[0_20px_40px_-32px_rgba(255,255,255,0.8)]"
    : "border-hungry-orange bg-hungry-orange text-white shadow-[0_24px_48px_-30px_rgba(232,83,30,0.55)]";
  const submitClass = isDark
    ? "bg-white text-hungry-navy hover:bg-hungry-bg-soft"
    : "bg-hungry-orange text-white hover:bg-hungry-orange-dark";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, joining_as: joiningAs }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Something went wrong");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div
        className={`rounded-[28px] border px-5 py-6 animate-fade-up ${shellClass} ${className}`.trim()}
        aria-live="polite"
      >
        <p className={`font-mono text-[11px] uppercase tracking-[0.22em] ${labelClass}`}>
          Waitlist
        </p>
        <h3
          className={`mt-3 text-xl font-extrabold tracking-[-0.03em] ${isDark ? "text-white" : "text-hungry-navy"}`}
        >
          {successTitle}
        </h3>
        <p className={`mt-3 text-sm leading-relaxed ${labelClass}`}>{successBody}</p>
        <p className={`mt-4 text-xs ${labelClass}`}>{successFollowUp}</p>
        <button
          type="button"
          className={`mt-6 inline-flex rounded-pill px-4 py-2.5 text-sm font-semibold transition-[background-color,transform] duration-200 active:scale-[0.98] ${submitClass}`}
          onClick={() => {
            setStatus("idle");
            setEmail("");
            setName("");
            setJoiningAs(defaultJoiningAs);
          }}
        >
          Add another email
        </button>
      </div>
    );
  }

  return (
    <form
      id={id}
      onSubmit={handleSubmit}
      className={`rounded-[28px] border px-5 py-5 ${shellClass} ${className}`.trim()}
    >
      <p className={`font-mono text-[11px] uppercase tracking-[0.22em] ${labelClass}`}>{title}</p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor={nameId} className={`mb-2 block text-xs font-semibold ${labelClass}`}>
            First name{" "}
            <span className={isDark ? "text-white/46" : "text-hungry-text-muted"}>(optional)</span>
          </label>
          <input
            id={nameId}
            type="text"
            placeholder="How should we address you?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-2xl border px-4 py-3 text-sm transition-[border-color,box-shadow] duration-200 focus:outline-none focus:ring-4 ${inputClass}`}
          />
        </div>

        <div>
          <label htmlFor={emailId} className={`mb-2 block text-xs font-semibold ${labelClass}`}>
            Email address
          </label>
          <input
            id={emailId}
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full rounded-2xl border px-4 py-3 text-sm transition-[border-color,box-shadow] duration-200 focus:outline-none focus:ring-4 ${inputClass}`}
          />
        </div>

        <fieldset>
          <legend className={`mb-2 text-xs font-semibold ${labelClass}`}>Joining as</legend>
          <div className="grid grid-cols-3 gap-2">
            {JOINING_AS_OPTIONS.map((option) => {
              const isSelected = joiningAs === option.value;
              return (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-pill border px-3 py-2.5 text-center text-xs font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 ${
                    isSelected ? toggleActiveClass : toggleBaseClass
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name={radioName}
                    value={option.value}
                    checked={isSelected}
                    onChange={() => setJoiningAs(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {errorMsg ? (
          <p role="alert" className={`text-xs ${isDark ? "text-red-200" : "text-red-600"}`}>
            {errorMsg}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={status === "loading"}
          className={`inline-flex w-full items-center justify-center rounded-pill px-5 py-3.5 text-sm font-bold transition-[background-color,transform] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-65 ${submitClass}`}
        >
          {status === "loading" ? "Submitting..." : submitLabel}
        </button>

        <p className={`text-xs leading-relaxed ${labelClass}`}>{helperText}</p>
      </div>
    </form>
  );
}
