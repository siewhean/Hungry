"use client";

import React, { useState } from "react";
import styles from "./EmailForm.module.css";
import { Button } from "./Button";

export interface EmailFormProps {
  buttonText?: string;
  placeholder?: string;
  onSubmit?: (email: string) => void;
}

export function EmailForm({
  buttonText = "Join Waitlist",
  placeholder = "Enter your email",
  onSubmit,
}: EmailFormProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      if (onSubmit) {
        onSubmit(email);
      }
      setSubmitted(true);
      setEmail("");
    }
  };

  if (submitted) {
    return (
      <div style={{ color: "var(--color-success)", fontWeight: 600 }}>
        Thanks! We&apos;ll be in touch soon.
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input
        type="email"
        className={styles.input}
        placeholder={placeholder}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Button type="submit">{buttonText}</Button>
    </form>
  );
}
