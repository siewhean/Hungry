import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { routeMetadata } from "@/app/seo";
import styles from "@/components/seo/SeoPage.module.css";

export const metadata = routeMetadata("/about");
export const revalidate = 3600;

const about = {
  eyebrow: "About Hungry",
  title: "Built for the way Singapore decides what to eat.",
  description:
    "Hungry is a dish-first food discovery guide for nearby meals, stall details, menus, photos, and merchant updates.",
  mission:
    "Make local food decisions clearer for diners while giving food businesses a simple way to keep their dishes discoverable.",
  targetForFoodies:
    "Help diners choose faster by showing dish photos, menus, open status, and stall context before they travel.",
  targetForMerchants:
    "Help food businesses keep dish, menu, opening-hour, and profile details visible when nearby diners are deciding.",
  painPoints: [
    {
      pain: "Food searches often start with a venue, even when the diner is craving a dish.",
      solution: "Hungry starts with dishes and then gives the stall context needed to decide.",
    },
    {
      pain: "Menus, photos, and opening details are scattered across different places.",
      solution: "Hungry brings the practical decision details into one local guide.",
    },
    {
      pain: "Small food businesses do not always have a simple way to keep dish information current.",
      solution: "Merchant tools are designed to make profile and menu updates easier to maintain.",
    },
  ],
} as const;

const goals = [
  {
    title: "For foodies",
    text: about.targetForFoodies,
  },
  {
    title: "For merchants",
    text: about.targetForMerchants,
  },
] as const;

const painPoints = about.painPoints;

export default function AboutPage() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroGrid}>
            <div>
              <span className={styles.eyebrow}>{about.eyebrow}</span>
              <h1>{about.title}</h1>
              <p className={styles.lead}>{about.description}</p>
            </div>
            <aside className={styles.answerCard} aria-labelledby="about-mission-title">
              <h2 id="about-mission-title">Mission</h2>
              <p>{about.mission}</p>
            </aside>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="about-goals-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Who we are serving</span>
            <h2 id="about-goals-title">Our goals and targets</h2>
            <p>Hungry is focused on two user groups that face the same daily pain: uncertain food decisions.</p>
          </div>
          <div className={styles.grid}>
            {goals.map((goal) => (
              <article className={styles.card} key={goal.title}>
                <h3>{goal.title}</h3>
                <p>{goal.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="about-pain-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Pain points we solve</span>
            <h2 id="about-pain-title">What hurts and how Hungry fixes it</h2>
            <p>
              We design around practical outcomes: less time comparing, fewer surprises, and better
              food outcomes.
            </p>
          </div>
          <div className={styles.grid}>
            {painPoints.map((entry, i) => (
              <article className={styles.card} key={entry.pain}>
                <h3 className="sr-only">Pain point {i + 1}</h3>
                <p style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{entry.pain}</p>
                <div style={{ height: "var(--space-4)" }} />
                <p style={{ fontStyle: "italic" }}>→ {entry.solution}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.ctaBand}`}>
        <div className={`container-wide ${styles.heroInner}`}>
          <div>
            <span className={styles.eyebrow}>Next step</span>
            <h2>Join the waitlist to try Hungry’s first release.</h2>
            <p>
              We keep onboarding focused by audience, so foodies and merchants get the right setup
              experience first.
            </p>
            <Link href="/join-waitlist" className={styles.ctaLink}>
              Join Waitlist
              <ArrowRight aria-hidden size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
