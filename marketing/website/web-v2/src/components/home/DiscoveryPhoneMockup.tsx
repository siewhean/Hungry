"use client";

import Image from "next/image";
import {
  BookOpen,
  Compass,
  Dices,
  Flame,
  Home,
  Plus,
  Search,
  User,
  Utensils,
  Zap,
} from "lucide-react";
import styles from "./DiscoveryPhoneMockup.module.css";

const popularDishes = [
  { name: "Laksa", image: "/images/food/laksa-topdown.png", active: true },
  { name: "Chicken Rice", image: "/images/food/chicken-rice-topdown.png", active: false },
  { name: "Char Kway Teow", image: "/images/food/char-kway-teow-topdown.png", active: true },
  { name: "Bak Chor Mee", image: "/images/food/bak-chor-mee-topdown.png", active: false },
] as const;

const filters = [
  { label: "Late night", icon: Compass },
  { label: "Dietary Needs", icon: Utensils },
  { label: "Spicy", icon: Flame },
] as const;

const quickBites = [
  { image: "/images/food/yong-tau-foo-topdown.png", alt: "Yong tau foo quick bite" },
  { image: "/images/food/satay-topdown.png", alt: "Satay quick bite" },
] as const;

export function DiscoveryPhoneMockup() {
  return (
    <div className={styles.device} aria-label="Hungry discovery page on iPhone">
      <span className={styles.sideButtonTop} aria-hidden="true" />
      <span className={styles.sideButtonMid} aria-hidden="true" />
      <span className={styles.sideButtonLow} aria-hidden="true" />

      <div className={styles.screen}>
        <div className={styles.statusBar} aria-hidden="true">
          <span className={styles.time}>1:42</span>
          <span className={styles.island} />
          <span className={styles.statusIcons}>
            <span className={styles.signalDots}>••••</span>
            <span className={styles.wifi} />
            <span className={styles.battery} />
          </span>
        </div>

        <div className={styles.content} aria-label="iPhone discovery feed preview">
          <section className={styles.locationBlock}>
            <div>
              <p className={styles.locationEyebrow}>You are at</p>
              <h2>Chinatown</h2>
              <p>13 places in this area</p>
            </div>
          </section>

          <div className={styles.searchBox}>
            <span aria-hidden="true" />
            <Search size={23} strokeWidth={2.5} />
          </div>

          <div className={styles.filterRow} aria-label="Discovery filters">
            {filters.map(({ label, icon: Icon }) => (
              <span className={styles.filterChip} key={label}>
                <Icon size={17} strokeWidth={2.4} />
                {label}
              </span>
            ))}
          </div>

          <section className={styles.popularSection}>
            <h3>Popular right now</h3>
            <div className={styles.popularGrid}>
              {popularDishes.map((dish) => (
                <div className={styles.dishItem} key={dish.name}>
                  <span className={`${styles.dishImage} ${dish.active ? styles.activeDish : ""}`}>
                    <Image src={dish.image} alt="" fill sizes="78px" />
                  </span>
                  <span>{dish.name}</span>
                </div>
              ))}
            </div>
          </section>

          <div className={styles.actionGrid}>
            <div className={styles.decideButton}>
              <span className={styles.actionIcon}>
                <Dices size={21} />
              </span>
              Decide for Me
            </div>
            <div className={styles.wheelButton}>
              <span className={styles.actionIcon}>
                <Compass size={22} />
              </span>
              Hungry Wheel
            </div>
          </div>

          <div className={styles.tileGrid}>
            <article className={styles.categoryTile}>
              <Image src="/images/food/stalls-restaurants-wide.png" alt="" fill sizes="160px" />
              <span>Stalls & Restaurants</span>
            </article>
            <article className={styles.categoryTile}>
              <Image src="/images/food/dishes-wide.png" alt="" fill sizes="160px" />
              <span>Dishes</span>
            </article>
          </div>

          <section className={styles.quickBites}>
            <div className={styles.sectionHeader}>
              <h3>Quick Bites</h3>
              <span>
                <Zap size={15} fill="currentColor" /> &lt; 15 min
              </span>
              <span className={styles.seeAll}>See all</span>
            </div>
            <div className={styles.quickGrid} aria-hidden="true">
              {quickBites.map((item) => (
                <div className={styles.quickCard} key={item.image}>
                  <Image src={item.image} alt={item.alt} fill sizes="140px" />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.bottomNav} aria-hidden="true">
          <span>
            <Home size={24} />
            Home
          </span>
          <span className={styles.activeNav}>
            <Compass size={25} />
            Discover
          </span>
          <span className={styles.addButton}>
            <Plus size={34} />
          </span>
          <span>
            <BookOpen size={24} />
            Review
          </span>
          <span>
            <User size={24} />
            Profile
          </span>
        </div>
      </div>
    </div>
  );
}
