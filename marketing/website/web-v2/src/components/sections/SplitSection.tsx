import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { homepage } from "@/content/site";
import { Reveal } from "@/components/motion/Reveal";
import styles from "./SplitSection.module.css";

export default function SplitSection() {
  return (
    <section className={styles.section} id="audiences">
      <div className="container-wide">
        <Reveal className={styles.header}>
          <h2>Built for foodies and merchants.</h2>
        </Reveal>

        <div className={styles.grid}>
          {homepage.audiences.map((audience, index) => (
            <Reveal className={styles.card} delay={index * 0.08} key={audience.title}>
              <div className={styles.imageWrap}>
                <Image
                  src={audience.image.src}
                  alt={audience.image.alt}
                  fill
                  sizes="(max-width: 639px) 100vw, 50vw"
                />
              </div>
              <div className={styles.cardContent}>
                <span className={styles.cardEyebrow}>{audience.eyebrow}</span>
                <h3>{audience.title}</h3>
                <p>{audience.description}</p>
                <Link href={audience.cta.href} className={styles.cardCta}>
                  {audience.cta.label}
                  <ArrowUpRight size={18} />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
