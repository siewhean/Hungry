import { homepage } from "@/content/site";
import { StickyScreenStory } from "@/components/home/StickyScreenStory";
import styles from "./StickyShowcase.module.css";

export default function StickyShowcase() {
  return (
    <section className={styles.section} id="product-story">
      <div className="container-wide">
        <div className={styles.header}>
          <span className={styles.eyebrow}>Inside the app</span>
          <h2>See how a choice comes together.</h2>
          <p>
            Real Hungry screens. Start nearby, open the stall, check the menu, then read what
            people ordered.
          </p>
        </div>
        <StickyScreenStory screens={homepage.productStory} />
      </div>
    </section>
  );
}
