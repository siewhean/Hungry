import Image from "next/image";
import { homepage } from "@/content/site";
import { Reveal } from "@/components/motion/Reveal";
import styles from "./LocalGuide.module.css";

export default function LocalGuide() {
  return (
    <section className={styles.section} aria-labelledby="local-guide-title">
      <div className={`container-wide ${styles.shell}`}>
        <Reveal className={styles.header}>
          <h2 id="local-guide-title">{homepage.localGuide.title}</h2>
          {homepage.localGuide.description ? <p>{homepage.localGuide.description}</p> : null}
        </Reveal>

        <div className={styles.grid}>
          {homepage.localGuide.cards.map((card, index) => {
            return (
              <Reveal
                as="article"
                className={`${styles.card} ${styles[card.variant]}`}
                delay={index * 0.08}
                key={card.title}
              >
                {card.image ? (
                  <Image
                    src={card.image.src}
                    alt={card.image.alt}
                    fill
                    sizes={
                      card.variant === "map" || card.variant === "open"
                        ? "(max-width: 768px) 100vw, 66vw"
                        : "(max-width: 768px) 100vw, 33vw"
                    }
                    className={styles.cardImage}
                  />
                ) : null}

                <div className={styles.overlay} aria-hidden />

                <div className={styles.content}>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
