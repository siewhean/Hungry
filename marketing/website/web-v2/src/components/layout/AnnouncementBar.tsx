import Link from "next/link";
import styles from "./AnnouncementBar.module.css";

export default function AnnouncementBar() {
  return (
    <div className={styles.announcementBar}>
      <div className={styles.announcementText}>
        <span>Hungry is coming soon in Singapore.</span>
        <Link href="/for-foodies" className={styles.highlight}>
          Join the waitlist
        </Link>
      </div>
    </div>
  );
}
