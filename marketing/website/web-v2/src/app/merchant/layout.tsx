import type { Metadata } from "next";
import MerchantClientLayout from "./MerchantClientLayout";

/**
 * Server segment layout for /merchant.
 * Exports `metadata` with robots: noindex so Google does not index merchant portal pages
 * even if a direct backlink bypasses robots.txt disallow rules.
 * The interactive layout shell lives in MerchantClientLayout (use client).
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

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return <MerchantClientLayout>{children}</MerchantClientLayout>;
}
