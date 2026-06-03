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
            Join as a foodie for early access, or explore Merchant Mode if your food business
            should be discoverable by dish, menu, hours, and local proof.
          </p>
        </Reveal>

        <Reveal className={styles.actions} delay={0.12}>
          <Link className={styles.primary} href="/for-foodies">
            <Utensils aria-hidden size={20} />
            Join Waitlist
            <ArrowRight aria-hidden size={20} />
          </Link>
          <Link className={styles.secondary} href="/for-merchants">
            <Store aria-hidden size={20} />
            Explore Merchant Mode
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
