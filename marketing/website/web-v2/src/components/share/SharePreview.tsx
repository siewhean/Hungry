import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import styles from "@/components/seo/SeoPage.module.css";
import { siteConfig } from "@/app/seo";

type SharePreviewProps = {
  eyebrow: string;
  title: string;
  lead?: string | null;
  facts?: { label: string; value: string }[];
  imageUrl?: string | null;
  appPath: string;
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
              <a className={styles.ctaLink} href={`hungry://${appPath}`}>
                Open in Hungry
              </a>
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
      <section className={`${styles.section} ${styles.ctaBand}`}>
        <div className={styles.sectionInner}>
          <h2>Find your next favourite dish</h2>
          <p>Hungry shows what to order at Singapore hawker stalls, with prices kept up to date.</p>
          <Link href="/join-waitlist" className={styles.ctaLink}>
            Get Hungry
          </Link>
        </div>
      </section>
    </main>
  );
}

export function sharePreviewMetadata(title: string, description: string, path: string): Metadata {
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
      images: [siteConfig.openGraphImage],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
