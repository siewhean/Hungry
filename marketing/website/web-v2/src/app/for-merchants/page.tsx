import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart2,
  CalendarClock,
  Eye,
  Home,
  Inbox,
  MenuSquare,
  Store,
  Utensils,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import styles from "./page.module.css";
import { merchantPage } from "@/content/site";
import { routeMetadata } from "@/app/seo";

const benefitIcons = {
  visibility: Eye,
  menu: MenuSquare,
  hours: CalendarClock,
  analytics: BarChart2,
  replies: Inbox,
  promotions: Zap,
} as const;

const typeIcons = {
  "Home-based": Home,
  "Restaurants": Utensils,
  "Cafes and bakeries": Store,
  "Hawker stalls": Store,
} as const;

type StaticRevealProps = {
  as?: "div" | "article";
  children: ReactNode;
  className?: string;
  delay?: number;
};

function Reveal({ as: Component = "div", children, className }: StaticRevealProps) {
  return <Component className={className}>{children}</Component>;
}

export const metadata = routeMetadata("/for-merchants");
export const revalidate = 3600;

export default function ForMerchants() {
  return (
    <main className={styles.main}>
      {/* 1. Hero Section */}
      <section className={styles.hero}>
        <Image
          src={merchantPage.hero.image.src}
          alt={merchantPage.hero.image.alt}
          fill
          priority
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={styles.heroOverlay} aria-hidden />
        <Reveal className={styles.heroContent}>
          <span className={styles.eyebrow}>For Singapore food businesses</span>
          <h1>{merchantPage.hero.title}</h1>
          <p>{merchantPage.hero.description}</p>
          <div className={styles.heroActions}>
            <Link href={merchantPage.hero.cta.href} className={styles.primaryCta} prefetch>
              {merchantPage.hero.cta.label}
              <ArrowRight aria-hidden size={20} />
            </Link>
            <Link
              href={merchantPage.hero.secondaryCta.href}
              className={styles.secondaryCtaLink}
              prefetch
            >
              {merchantPage.hero.secondaryCta.label}
            </Link>
          </div>
        </Reveal>
      </section>

      {/* 2. Spacing / Benefits Section */}
      <section className={styles.benefits} id="merchant-tools">
        <div className="container-wide">
          <Reveal className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Merchant advantage</span>
            <h2>{merchantPage.benefits.title}</h2>
            <p>{merchantPage.benefits.description}</p>
          </Reveal>

          <div className={styles.benefitGrid}>
            {merchantPage.benefits.items.map((item, index) => {
              const Icon = benefitIcons[item.icon as keyof typeof benefitIcons] ?? Eye;

              return (
                <Reveal as="article" className={styles.benefitCard} delay={index * 0.08} key={item.title}>
                  <span className={styles.benefitIcon}>
                    <Icon aria-hidden size={24} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Supported Business Types */}
      <section className={styles.creatorTypes}>
        <div className="container-wide">
          <Reveal className={styles.creatorHeader}>
            <div>
              <span className={styles.eyebrow}>Supported food businesses</span>
              <h2>{merchantPage.creatorTypes.title}</h2>
            </div>
            <p>{merchantPage.creatorTypes.description}</p>
          </Reveal>

          <div className={styles.creatorGrid}>
            {merchantPage.creatorTypes.items.map((item, index) => {
              const Icon = typeIcons[item.title as keyof typeof typeIcons] ?? Store;

              return (
                <Reveal
                  as="article"
                  className={`${styles.creatorCard} ${styles[item.size]}`}
                  delay={index * 0.08}
                  key={item.title}
                >
                  <Image
                    src={item.image.src}
                    alt={item.image.alt}
                    fill
                    sizes={
                      item.size === "large"
                        ? "(max-width: 768px) 100vw, 50vw"
                        : "(max-width: 768px) 100vw, 25vw"
                    }
                    className={styles.creatorImage}
                  />
                  <div className={styles.creatorOverlay} aria-hidden />
                  <div className={styles.creatorContent}>
                    <span className={styles.creatorIcon}>
                      <Icon aria-hidden size={22} />
                    </span>
                    <h3>{item.title}</h3>
                    {item.description ? <p>{item.description}</p> : null}
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className={styles.finalSection} id="register-interest">
        <Reveal className={styles.finalCard}>
          <div className={styles.finalCopy}>
            <span className={styles.eyebrow}>Next step</span>
            <h2>{merchantPage.finalCta.title}</h2>
            <p>{merchantPage.finalCta.description}</p>
            <Link
              href="/join-waitlist?audience=merchant"
              className={styles.primaryCta}
              prefetch
            >
              {merchantPage.finalCta.cta.label}
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
