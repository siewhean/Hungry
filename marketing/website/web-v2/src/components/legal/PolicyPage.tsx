import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./PolicyPage.module.css";

type PolicySection = { title: string; body: ReactNode };

export function PolicyPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro?: ReactNode;
  sections: readonly PolicySection[];
}) {
  return (
    <main className={`container ${styles.main}`}>
      <article className={styles.article}>
        <h1>{title}</h1>
        <p>
          <time dateTime="2026-10-25">Last updated: 25 October 2026</time>
        </p>
        {intro && <p>{intro}</p>}
        {sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <nav aria-label="Related policies" className={styles.related}>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refund">Refunds</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/business">Business details</Link>
          <Link href="/account/delete">Data deletion</Link>
          <Link href="/contact">Contact</Link>
          <a href="mailto:usehungrysingapore@gmail.com?subject=Unsubscribe">
            Request unsubscribe by email
          </a>
        </nav>
      </article>
    </main>
  );
}
