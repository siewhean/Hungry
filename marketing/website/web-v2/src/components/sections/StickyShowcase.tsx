import { homepage } from "@/content/site";
import { Reveal } from "@/components/motion/Reveal";
import { StickyScreenStory } from "@/components/home/StickyScreenStory";
import styles from "./StickyShowcase.module.css";

export default function StickyShowcase() {
  return (
    <section className={styles.section} id="product-story">
      <div className="container-wide">
        <Reveal className={styles.header}>
          <span className={styles.eyebrow}>App screens</span>
          <h2>The app shows the answer before the trip.</h2>
          <p>
            Each screen maps to a real food-decision pain point: what looks good, what is open,
            what to order, and what merchants can keep current.
          </p>
        </Reveal>
        <StickyScreenStory screens={homepage.productStory} />
      </div>
    </section>
  );
}
