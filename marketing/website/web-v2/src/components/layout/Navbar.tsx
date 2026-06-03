import Link from "next/link";
import { HungryWordmark } from "@/components/brand/HungryWordmark";
import styles from "./Navbar.module.css";

const navItems = [
  { label: "For Foodies", href: "/for-foodies" },
  { label: "For Merchants", href: "/for-merchants" },
  { label: "About", href: "/#hawker-culture" },
] as const;

export default function Navbar() {
  return (
    <header className={styles.navbarWrapper}>
      <div className={`container-wide ${styles.navbar}`}>
        <Link
          href="/"
          className={styles.logo}
        >
          <HungryWordmark />
        </Link>

        <nav className={styles.navLinks} aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link
              href={item.href}
              className={styles.navLink}
              key={item.label}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link href="/join-waitlist" className={styles.ctaButton}>
            Join Waitlist
          </Link>
        </div>
      </div>
    </header>
  );
}
