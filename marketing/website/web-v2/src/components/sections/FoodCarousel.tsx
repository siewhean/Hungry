import { homepage } from "@/content/site";
import { Reveal } from "@/components/motion/Reveal";
import { HawkerCultureCarousel } from "@/components/home/HawkerCultureCarousel";
import styles from "./FoodCarousel.module.css";

export default function FoodCarousel() {
  return (
    <section className={styles.section} id="hawker-culture">
      <div className="container-wide">
        <Reveal className={styles.header}>
          <span className={styles.eyebrow}>Singapore eating culture</span>
          <h2>Built for the way Singapore eats.</h2>
          <p>
            Hawker stalls, kopitiam staples, cafes, restaurants, and small food makers can all sit
            in one dish-led discovery flow.
          </p>
        </Reveal>
      </div>
      <HawkerCultureCarousel cards={homepage.cultureCards} />
    </section>
  );
}
