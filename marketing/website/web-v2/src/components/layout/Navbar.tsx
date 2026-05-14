import Link from "next/link";
import { siteNav } from "@/content/site";
import styles from "./Navbar.module.css";

export default function Navbar() {
  return (
    <header className={styles.navbarWrapper}>
      <div className={`container-wide ${styles.navbar}`}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoText}>Hungry</span>
        </Link>

        <nav className={styles.navLinks} aria-label="Primary navigation">
          {siteNav.map((item) => (
            <Link href={item.href} className={styles.navLink} key={item.label}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link href="/for-foodies" className={styles.ctaButton}>
            Join Waitlist
          </Link>
        </div>
      </div>
    </header>
  );
}
