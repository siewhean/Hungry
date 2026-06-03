"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AnnouncementBar.module.css";

export default function AnnouncementBar() {
  const pathname = usePathname();
  if (pathname?.startsWith("/console")) {
    return null;
  }

  return (
    <div className={styles.announcementBar}>
      <div className={styles.announcementText}>
        <span>Hungry is coming soon in Singapore.</span>
        <Link href="/join-waitlist" className={styles.highlight}>
          Join the waitlist
        </Link>
      </div>
    </div>
  );
}
