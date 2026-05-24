import { homepage } from "@/content/site";
import { Reveal } from "@/components/motion/Reveal";
import { HawkerCultureCarousel } from "@/components/home/HawkerCultureCarousel";
import styles from "./FoodCarousel.module.css";

export default function FoodCarousel() {
  return (
    <section className={styles.section} id="hawker-culture">
      <div className="container-wide">
        <Reveal className={styles.header}>
          <span className={styles.eyebrow}>Singapore food coverage</span>
          <h2>One flow for everyday food decisions.</h2>
          <p>
            Hawker stalls, kopitiam staples, cafes, restaurants, and small food makers are easier to
            compare when the dish is the starting point.
          </p>
        </Reveal>
      </div>
      <HawkerCultureCarousel cards={homepage.cultureCards} />
    </section>
  );
}
