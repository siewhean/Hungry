import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import AttributionCapture from "@/components/analytics/AttributionCapture";
import AppLayoutWrapper from "@/components/layout/AppLayoutWrapper";
import AnnouncementBar from "@/components/layout/AnnouncementBar";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { JsonLd } from "@/components/seo/JsonLd";
import { hungryJsonLd, siteConfig } from "./seo";
import "./globals.css";

const nunito = localFont({
  variable: "--font-nunito",
  src: [
    { path: "./fonts/Nunito_400Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Nunito_500Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Nunito_600SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Nunito_700Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/Nunito_800ExtraBold.woff2", weight: "800", style: "normal" },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [...siteConfig.keywords],
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: "/",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.openGraphImage,
        alt: "Hungry Singapore food discovery app preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: [siteConfig.openGraphImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [{ url: "/hungry_logo_icon_192.png", type: "image/png", sizes: "192x192" }],
    shortcut: "/hungry_logo_icon_192.png",
    apple: [{ url: "/hungry_apple_touch_icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={siteConfig.language} className={nunito.variable} data-scroll-behavior="smooth">
      <body>
        <JsonLd data={hungryJsonLd} />
        <Analytics />
        <AttributionCapture />
        <AppLayoutWrapper
          publicHeader={
            <>
              <AnnouncementBar />
              <Navbar />
            </>
          }
          publicFooter={<Footer />}
        >
          {children}
        </AppLayoutWrapper>
      </body>
    </html>
  );
}
