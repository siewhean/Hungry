"use client";

import Link from "next/link";
import { ArrowRight, Store, Utensils } from "lucide-react";
import { trackWebsiteEvent } from "@/lib/analytics/websiteEvents";
import { Reveal } from "@/components/motion/Reveal";
import styles from "./FinalCTA.module.css";

export default function FinalCTA() {
  return (
    <section className={styles.section}>
      <div className={`container-wide ${styles.card}`}>
        <Reveal className={styles.copy}>
          <span className={styles.eyebrow}>Next step</span>
          <h2>Make the next meal easier to choose.</h2>
          <p>
            Join as a foodie for early access, or explore Merchant Mode if your food business
            should be easier to find by dish, menu, hours, and photos.
          </p>
        </Reveal>

        <Reveal className={styles.actions} delay={0.12}>
          <Link
            className={styles.primary}
            href="/join-waitlist"
            onClick={() =>
              trackWebsiteEvent("website_cta_clicked", {
                cta_label: "Join Waitlist",
                cta_destination: "/join-waitlist",
                cta_section: "final-cta",
              })
            }
          >
            <Utensils aria-hidden size={20} />
            Join Waitlist
            <ArrowRight aria-hidden size={20} />
          </Link>
          <Link
            className={styles.secondary}
            href="/for-foodies"
            onClick={() =>
              trackWebsiteEvent("website_cta_clicked", {
                cta_label: "For Foodies",
                cta_destination: "/for-foodies",
                cta_section: "final-cta",
              })
            }
          >
            <Utensils aria-hidden size={20} />
            For Foodies
            <ArrowRight aria-hidden size={20} />
          </Link>
          <Link
            className={styles.secondary}
            href="/for-merchants"
            onClick={() =>
              trackWebsiteEvent("website_cta_clicked", {
                cta_label: "For Merchants",
                cta_destination: "/for-merchants",
                cta_section: "final-cta",
              })
            }
          >
            <Store aria-hidden size={20} />
            For Merchants
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
