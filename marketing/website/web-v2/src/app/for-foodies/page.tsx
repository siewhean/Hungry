import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { DiscoveryPhoneMockup } from "@/components/home/DiscoveryPhoneMockup";
import { routeMetadata } from "@/app/seo";
import styles from "./page.module.css";

export const metadata = routeMetadata("/for-foodies");
export const revalidate = 3600;

const proofPoints = [
  "See dish photos before you queue.",
  "Check menus, reviews, and open status together.",
  "Find food by craving, not only by venue.",
] as const;

const featureCards = [
  {
    title: "Search by dish",
    description:
      "Find laksa, chicken rice, or late-night food without opening every venue page first.",
    image: "/images/screens/foodies-screen.png",
    alt: "Hungry discovery screen showing dish-first search results",
  },
  {
    title: "Compare before leaving",
    description:
      "Check photos, menus, ratings, and open status together before making the trip.",
    image: "/images/screens/app-showcase.png",
    alt: "Hungry app screenshots showing discovery and dish detail features",
  },
  {
    title: "Choose from a local view",
    description:
      "See nearby dishes, stalls, and saved options in one flow built around the meal.",
    image: "/images/screens/foodies-screen.png",
    alt: "Hungry mobile interface for nearby dish discovery",
  },
] as const;

export default function ForFoodies() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className="container-wide">
          <div className={styles.heroGrid}>
            <Reveal className={styles.heroCopy}>
              <span className={styles.eyebrow}>For Singapore foodies</span>
              <h1>Decide what to eat with less guessing.</h1>
              <p>
                Hungry brings nearby dishes, real photos, menus, reviews, and open status into one
                local guide before hunger turns into extra searching.
              </p>
              <div className={styles.proofList}>
                {proofPoints.map((point) => (
                  <span key={point}>
                    <CheckCircle2 aria-hidden size={18} />
                    {point}
                  </span>
                ))}
              </div>
              <div className={styles.ctas}>
                <Link
                  href="/join-waitlist?audience=foodie"
                  className={styles.primaryCta}
                  prefetch
                >
                  Join Waitlist
                  <ArrowRight aria-hidden size={19} />
                </Link>
                <Link
                  href="/join-waitlist?audience=merchant"
                  className={styles.secondaryCta}
                  prefetch
                >
                  For Merchants
                </Link>
              </div>
            </Reveal>

            <Reveal className={styles.phonePanel} delay={0.1}>
              <div className={styles.phoneFrame}>
                <DiscoveryPhoneMockup />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className={styles.features} aria-labelledby="foodie-features-title">
        <div className="container-wide">
          <Reveal className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Foodie features</span>
            <h2 id="foodie-features-title">One clearer flow for the way Singapore eats.</h2>
            <p>
              From hawker stalls to late-night restaurants, Hungry helps foodies compare the dish,
              the menu, and the trip before deciding.
            </p>
          </Reveal>

          <div className={styles.featureGrid}>
            {featureCards.map((card, index) => (
              <Reveal as="article" className={styles.featureCard} delay={index * 0.08} key={card.title}>
                <div className={styles.featureImageWrap}>
                  <Image
                    src={card.image}
                    alt={card.alt}
                    fill
                    loading="lazy"
                    sizes="(max-width: 760px) 100vw, 33vw"
                  />
                </div>
                <div className={styles.featureCopy}>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}
