import { Camera, MapPin, MessageCircle } from "lucide-react";
import { homepage } from "@/content/site";
import { Reveal } from "@/components/motion/Reveal";
import styles from "./CommunityLayer.module.css";

const icons = [MessageCircle, MapPin, Camera];

export default function CommunityLayer() {
  return (
    <section className={styles.section}>
      <div className="container-wide">
        <Reveal className={styles.header}>
          <span className={styles.eyebrow}>Community layer</span>
          <h2>Useful social proof, close to the dish.</h2>
          <p>
            Reviews, rankings, and photos stay attached to the dish so people can decide without
            searching through separate posts and old chats.
          </p>
        </Reveal>

        <div className={styles.grid}>
          {homepage.community.map((item, index) => {
            const Icon = icons[index] ?? MessageCircle;
            return (
              <Reveal as="article" className={styles.card} delay={index * 0.09} key={item.title}>
                <div className={styles.icon}>
                  <Icon aria-hidden size={24} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </Reveal>
            );
          })}
        </div>

      </div>
    </section>
  );
}
