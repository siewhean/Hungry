import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.main}>
      <section className={styles.fallback} aria-labelledby="fallback-title">
        <div className={styles.card}>
          <span className={styles.eyebrow}>Page unavailable</span>
          <h1 id="fallback-title">We could not open this page.</h1>
          <p>
            The page may have moved, or you may not have access to it from the public website.
          </p>
          <div className={styles.actions}>
            <Link href="/" className={styles.primaryCta}>
              Back to Hungry
            </Link>
            <Link href="/join-waitlist" className={styles.secondaryCta}>
              Join Waitlist
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
