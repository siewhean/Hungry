import { Clock3, Images, MapPinned, Store, Utensils } from "lucide-react";
import { homepage } from "@/content/site";
import { Reveal } from "@/components/motion/Reveal";
import styles from "./ProblemStack.module.css";

const icons = [Images, Clock3, MapPinned, Store];

export default function ProblemStack() {
  return (
    <section className={styles.section}>
      <div className={`container-wide ${styles.container}`}>
        <Reveal className={styles.copy}>
          <span className={styles.eyebrow}>The gap</span>
          <h2>Food discovery still feels too much like guesswork.</h2>
          <p>
            Singapore has the food. Hungry makes the hard part simpler: what looks good, what is
            open, and whether the trip is worth it.
          </p>
        </Reveal>

        <div className={styles.stack} aria-label="Current food discovery problems">
          {homepage.problems.map((problem, index) => {
            const Icon = icons[index] ?? Utensils;
            return (
              <Reveal
                as="article"
                className={styles.problemCard}
                delay={index * 0.08}
                distance={42}
                key={problem}
              >
                <div className={styles.problemLine}>
                  <span className={styles.cardIndex}>0{index + 1}</span>
                  <span className={styles.iconWrap}>
                    <Icon aria-hidden size={18} />
                  </span>
                  <p className={styles.problemText}>{problem}</p>
                </div>
              </Reveal>
            );
          })}

          <Reveal as="article" className={styles.solutionCard} delay={0.16}>
            <div className={styles.solutionIcon}>
              <Utensils aria-hidden size={24} />
            </div>
            <h3>Hungry connects cravings, photos, and merchant updates.</h3>
            <p>
              It should feel local and useful, not like another static restaurant directory.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
