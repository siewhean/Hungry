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
            Singapore has the depth. Hungry makes the decision layer clearer: what is worth eating,
            what is open, and what the food actually looks like.
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
                <span className={styles.cardIndex}>0{index + 1}</span>
                <Icon aria-hidden size={26} />
                <p>{problem}</p>
              </Reveal>
            );
          })}

          <Reveal as="article" className={styles.solutionCard} delay={0.16}>
            <div className={styles.solutionIcon}>
              <Utensils aria-hidden size={24} />
            </div>
            <h3>Hungry connects craving, proof, and merchant updates.</h3>
            <p>
              The result is a product story that feels local, useful, and alive instead of another
              static restaurant directory.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
