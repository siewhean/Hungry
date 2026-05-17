import { homepage } from "@/content/site";
import { Reveal } from "@/components/motion/Reveal";
import { StickyScreenStory } from "@/components/home/StickyScreenStory";
import styles from "./StickyShowcase.module.css";

export default function StickyShowcase() {
  return (
    <section className={styles.section} id="product-story">
      <div className="container-wide">
        <Reveal className={styles.header}>
          <span className={styles.eyebrow}>Product proof</span>
          <h2>Scroll through the decision flow.</h2>
          <p>
            The site uses real Hungry prototype screens as the centrepiece, then lets the
            surrounding story move around the product instead of hiding it in a static mockup.
          </p>
        </Reveal>
        <StickyScreenStory screens={homepage.productStory} />
      </div>
    </section>
  );
}
