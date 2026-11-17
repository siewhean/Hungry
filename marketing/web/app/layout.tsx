import type { Metadata } from "next";
import type { CSSProperties } from "react";
import localFont from "next/font/local";
import "./globals.css";

const nunito = localFont({
  src: [
    {
      path: "./fonts/Nunito_400Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/Nunito_500Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/Nunito_600SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/Nunito_700Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/Nunito_800ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-body",
  display: "swap",
});

const dmMono = localFont({
  src: [
    {
      path: "./fonts/DMMono_400Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/DMMono_500Medium.ttf",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-mono",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hungry.sg";
const ogImagePath = "/og-image.svg";
const siteTitle = "Hungry — Find the dish. Not just the restaurant.";
const siteDescription =
  "A dish-first food discovery app for Singapore. Search by craving, compare nearby dishes, and find the right hawker stall faster. Join the waitlist.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | Hungry",
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_SG",
    url: "/",
    siteName: "Hungry",
    title: siteTitle,
    description: "Singapore food discovery that starts with the dish you want to eat.",
    images: [
      {
        url: ogImagePath,
        width: 1200,
        height: 630,
        alt: "Hungry — Dish-first food discovery for Singapore",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: "Singapore food discovery that starts with the dish you want to eat.",
    images: [ogImagePath],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-SG"
      className={`${nunito.variable} ${dmMono.variable}`}
      style={{ "--font-display": "var(--font-body)" } as CSSProperties}
    >
      <body className="font-body bg-hungry-bg text-hungry-text antialiased">{children}</body>
    </html>
  );
}
