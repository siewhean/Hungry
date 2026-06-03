"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { footerLinks } from "@/content/site";
import { HungryWordmark } from "@/components/brand/HungryWordmark";
import styles from "./Footer.module.css";

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/console")) {
    return null;
  }

  return (
    <footer className={styles.footerWrapper}>
      <div className={`container-wide ${styles.footer}`}>
        <div className={styles.brandInfo}>
          <Link href="/" className={styles.logo} prefetch>
            <HungryWordmark />
          </Link>
          <p className={styles.tagline}>
            Built for the way Singapore eats. Discover the dish, not just the venue.
          </p>
        </div>

        <div className={styles.links}>
          <div className={styles.linkGroup}>
            <h4 className={styles.linkGroupTitle}>Legal</h4>
            {footerLinks.legal.map((link) => (
              <Link href={link.href} className={styles.link} key={link.label} prefetch>
                {link.label}
              </Link>
            ))}
          </div>
          <div className={styles.linkGroup}>
            <h4 className={styles.linkGroupTitle}>Discover</h4>
            {footerLinks.discover.map((link) => (
              <Link href={link.href} className={styles.link} key={link.label} prefetch>
                {link.label}
              </Link>
            ))}
          </div>
          <div className={styles.linkGroup}>
            <h4 className={styles.linkGroupTitle}>Connect</h4>
            {footerLinks.connect.map((link) => (
              <Link href={link.href} className={styles.link} key={link.label} prefetch>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="container-wide">
        <div className={styles.bottomBar}>
          <p>&copy; 2026 Hungry Singapore. Your trusted guide to the local makan scene.</p>
        </div>
      </div>
    </footer>
  );
}
