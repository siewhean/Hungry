import Link from "next/link";
import { ArrowRight, Store, Utensils } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import styles from "./FinalCTA.module.css";

export default function FinalCTA() {
  return (
    <section className={styles.section}>
      <div className={`container-wide ${styles.card}`}>
        <Reveal className={styles.copy}>
          <span className={styles.eyebrow}>Next step</span>
          <h2>Bring Singapore’s food decisions into one visual map.</h2>
          <p>
            Join as a foodie, or register merchant interest if customers should find your dishes,
            menu, and opening hours faster.
          </p>
        </Reveal>

        <Reveal className={styles.actions} delay={0.12}>
          <Link className={styles.primary} href="/join-waitlist?audience=foodie">
            <Utensils aria-hidden size={20} />
            Join Waitlist
            <ArrowRight aria-hidden size={20} />
          </Link>
          <Link className={styles.secondary} href="/join-waitlist?audience=merchant">
            <Store aria-hidden size={20} />
            Register Interest
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
