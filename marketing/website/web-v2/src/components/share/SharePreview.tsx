import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import styles from "@/components/seo/SeoPage.module.css";
import { siteConfig } from "@/app/seo";
import { OpenInHungry } from "@/components/share/OpenInHungry";
import { appDeepLink } from "@/lib/share/sharedLinks";

type SharePreviewProps = {
  eyebrow: string;
  title: string;
  lead?: string | null;
  facts?: { label: string; value: string }[];
  imageUrl?: string | null;
  appPath: string;
  /** The ?src= tag the link was shared with, passed on so the app can credit the share. */
  shareSource?: string | null;
  mapsUrl?: string | null;
  children?: ReactNode;
};

/** Public landing for a link shared from the app. Works without signing in. */
export function SharePreview({
  eyebrow,
  title,
  lead,
  facts = [],
  imageUrl,
  appPath,
  shareSource,
  mapsUrl,
  children,
}: SharePreviewProps) {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroGrid}>
            <div>
              <span className={styles.eyebrow}>{eyebrow}</span>
              <h1>{title}</h1>
              {lead ? <p className={styles.lead}>{lead}</p> : null}
              {siteConfig.appStoreUrl ? (
                <a className={styles.ctaLink} href={siteConfig.appStoreUrl}>
                  Download on the App Store
                </a>
              ) : (
                <Link className={styles.ctaLink} href="/join-waitlist">
                  Get early access
                </Link>
              )}
              <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 16 }}>
                <OpenInHungry href={appDeepLink(appPath, shareSource)} />
                {mapsUrl ? (
                  <a
                    className={styles.inlineLink}
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-block" }}
                  >
                    Get directions
                  </a>
                ) : null}
              </div>
            </div>
            <aside className={styles.answerCard}>
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={title}
                  style={{
                    width: "100%",
                    borderRadius: 16,
                    objectFit: "cover",
                    aspectRatio: "4 / 3",
                  }}
                />
              ) : null}
              {facts.length ? (
                <dl className={styles.factList}>
                  {facts.map((fact) => (
                    <div key={fact.label}>
                      <dt>{fact.label}</dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </aside>
          </div>
        </div>
      </section>
      {children}
    </main>
  );
}

export function sharePreviewMetadata(
  title: string,
  description: string,
  path: string,
  imageUrl?: string | null,
): Metadata {
  const url = `${siteConfig.url}${path}`;
  return {
    title: `${title} | Hungry`,
    description,
    alternates: { canonical: url },
    // Shared links are for people, not search: SEO guides live under /dishes and /stalls.
    robots: { index: false, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "website",
      // The dish's own photo makes the WhatsApp and Telegram preview card.
      images: [imageUrl ?? siteConfig.openGraphImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl ?? siteConfig.openGraphImage],
    },
  };
}
