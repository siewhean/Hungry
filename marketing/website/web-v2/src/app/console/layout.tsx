import type { Metadata } from "next";
import ConsoleClientLayout from "./ConsoleClientLayout";

/**
 * Server segment layout for /console.
 * Exports `metadata` with robots: noindex so Google does not index admin pages
 * even if a direct backlink bypasses robots.txt disallow rules.
 * The interactive layout shell lives in ConsoleClientLayout (use client).
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  alternates: {
    canonical: undefined,
  },
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleClientLayout>{children}</ConsoleClientLayout>;
}
