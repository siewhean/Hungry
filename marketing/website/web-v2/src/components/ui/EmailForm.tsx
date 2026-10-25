import Link from "next/link";

export interface EmailFormProps {
  buttonText?: string;
}

// Keep every signup on the canonical form with purpose, age and server checks.
export function EmailForm({ buttonText = "Join Waitlist" }: EmailFormProps) {
  return <Link href="/join-waitlist">{buttonText}</Link>;
}
