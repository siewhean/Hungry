import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
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
    { path: "./fonts/Nunito_400Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Nunito_500Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Nunito_600SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Nunito_700Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/Nunito_800ExtraBold.ttf", weight: "800", style: "normal" },
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
    icon: "/hungry_logo_icon_transparent.png",
    shortcut: "/hungry_logo_icon_transparent.png",
    apple: "/hungry_logo_icon_transparent.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={siteConfig.language} className={nunito.variable} data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href="/hungry_logo_icon_transparent.png" type="image/png" sizes="32x32" />
        <link rel="shortcut icon" href="/hungry_logo_icon_transparent.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/hungry_logo_icon_transparent.png" />
        <link rel="preconnect" href="https://images.unsplash.com" />
      </head>
      <body>
        <JsonLd data={hungryJsonLd} />
        <Analytics />
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
