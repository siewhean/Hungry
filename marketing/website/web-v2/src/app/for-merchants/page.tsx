import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarClock, Eye, Home, MenuSquare, Store, Utensils } from "lucide-react";
import { merchantPage } from "@/content/site";
import { Reveal } from "@/components/motion/Reveal";
import MerchantStory from "@/components/sections/MerchantStory";
import { routeMetadata } from "@/app/seo";
import styles from "./page.module.css";

const benefitIcons = {
  visibility: Eye,
  menu: MenuSquare,
  hours: CalendarClock,
} as const;

const typeIcons = {
  "Home-based": Home,
  "Restaurants": Utensils,
  "Cafes and bakeries": Store,
  "Hawker stalls": Store,
} as const;

export const metadata = routeMetadata("/for-merchants");

export default function ForMerchants() {
  return (
    <main className={styles.main}>
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
          <Link href={merchantPage.hero.cta.href} className={styles.primaryCta}>
            {merchantPage.hero.cta.label}
            <ArrowRight aria-hidden size={20} />
          </Link>
        </Reveal>
      </section>

      <section className={styles.benefits}>
        <div className="container-wide">
          <Reveal className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Merchant advantage</span>
            <h2>{merchantPage.benefits.title}</h2>
            <p>{merchantPage.benefits.description}</p>
          </Reveal>

          <div className={styles.benefitGrid}>
            {merchantPage.benefits.items.map((item, index) => {
              const Icon = benefitIcons[item.icon];

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

      <MerchantStory />

      <section className={styles.creatorTypes} id="merchant-tools">
        <div className="container-wide">
          <Reveal className={styles.proofHeader}>
            <span className={styles.eyebrow}>Merchant tools</span>
            <h2>{merchantPage.featureProof.title}</h2>
            <p>{merchantPage.featureProof.description}</p>
          </Reveal>

          <div className={styles.proofGrid}>
            {merchantPage.featureProof.items.map((item, index) => (
              <Reveal as="article" className={styles.proofCard} delay={index * 0.08} key={item.title}>
                <div className={styles.proofImageWrap}>
                  <Image
                    src={item.image.src}
                    alt={item.image.alt}
                    fill
                    sizes="(max-width: 900px) 100vw, 33vw"
                    className={styles.proofImage}
                  />
                </div>
                <div className={styles.proofContent}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className={styles.creatorHeader}>
            <div>
              <span className={styles.eyebrow}>Food creator coverage</span>
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

      <section className={styles.finalSection} id="register-interest">
        <Reveal className={styles.finalCard}>
          <div className={styles.finalCopy}>
            <span className={styles.eyebrow}>Next step</span>
            <h2>{merchantPage.finalCta.title}</h2>
            <p>{merchantPage.finalCta.description}</p>
            <Link href="/join-waitlist?audience=merchant" className={styles.primaryCta}>
              {merchantPage.finalCta.cta.label}
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
