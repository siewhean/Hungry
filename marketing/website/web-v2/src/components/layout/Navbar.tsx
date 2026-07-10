import { HungryWordmark } from "@/components/brand/HungryWordmark";
import { siteNav } from "@/content/site";
import { SamePageLink } from "./SamePageLink";
import styles from "./Navbar.module.css";

export default function Navbar() {
  return (
    <header className={styles.navbarWrapper}>
      <div className={`container-wide ${styles.navbar}`}>
        <SamePageLink
          href="/"
          className={styles.logo}
        >
          <HungryWordmark />
        </SamePageLink>

        <nav className={styles.navLinks} aria-label="Primary navigation">
          {siteNav.map((item) => (
            <SamePageLink
              href={item.href}
              className={styles.navLink}
              key={item.label}
            >
              {item.label}
            </SamePageLink>
          ))}
        </nav>

        <div className={styles.actions}>
          <SamePageLink
            href="/join-waitlist"
            className={styles.ctaButton}
          >
            Join Waitlist
          </SamePageLink>
        </div>
      </div>
    </header>
  );
}
