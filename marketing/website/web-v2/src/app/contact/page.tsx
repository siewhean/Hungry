import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Mail } from "lucide-react";
import { routeMetadata, siteConfig } from "@/app/seo";
import styles from "./page.module.css";

export const metadata: Metadata = routeMetadata("/contact");

const supportLinks = [
  {
    href: "/join-waitlist?audience=foodie",
    label: "Join the foodie waitlist",
    description: "Get early access updates for Hungry in Singapore.",
  },
  {
    href: "/join-waitlist?audience=merchant",
    label: "Register merchant interest",
    description: "Tell us about your food business and merchant onboarding needs.",
  },
  {
    href: "/account/delete",
    label: "Request account deletion",
    description: "Start a deletion request for a Hungry account or related data.",
  },
];

export default function ContactPage() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <p className={styles.eyebrow}>Contact Hungry</p>
          <h1>Need help with Hungry?</h1>
          <p>
            For support, privacy, merchant, waitlist, or account deletion questions, email the
            Hungry team. We use this route as the public support fallback until a protected support
            form is launched.
          </p>
          <a className={styles.emailLink} href={`mailto:${siteConfig.contactEmail}`}>
            <Mail aria-hidden size={18} />
            {siteConfig.contactEmail}
          </a>
        </div>
      </section>

      <section className={styles.linkSection} aria-labelledby="contact-options">
        <div className={styles.container}>
          <h2 id="contact-options">Common requests</h2>
          <div className={styles.linkGrid}>
            {supportLinks.map((item) => (
              <Link className={styles.linkCard} href={item.href} key={item.href}>
                <span>{item.label}</span>
                <p>{item.description}</p>
                <ArrowRight aria-hidden size={18} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
