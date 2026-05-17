"use client";

import Image from "next/image";
import {
  BookOpen,
  Compass,
  Flame,
  Home,
  Plus,
  Search,
  Settings,
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

export function DiscoveryPhoneMockup() {
  return (
    <div className={styles.device} aria-label="Hungry discovery page on iPhone">
      <span className={styles.sideButtonTop} aria-hidden="true" />
      <span className={styles.sideButtonMid} aria-hidden="true" />
      <span className={styles.sideButtonLow} aria-hidden="true" />

      <div className={styles.screen}>
        <div className={styles.statusBar} aria-hidden="true">
          <span className={styles.time}>12:02</span>
          <span className={styles.island} />
          <span className={styles.statusIcons}>
            <span className={styles.signalDots}>••••</span>
            <span className={styles.wifi} />
            <span className={styles.battery} />
          </span>
        </div>

        <div className={styles.content} tabIndex={0} aria-label="Scrollable iPhone discovery feed preview">
          <section className={styles.locationBlock}>
            <div>
              <p className={styles.locationEyebrow}>You are at</p>
              <h2>Chinatown</h2>
              <p>969 places in this area</p>
            </div>
            <button className={styles.settingsButton} aria-label="Discovery settings">
              <Settings size={28} strokeWidth={3} />
            </button>
          </section>

          <div className={styles.searchBox}>
            <span>Dishes, stalls, or hawker centres...</span>
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
            <button className={styles.decideButton}>
              <span className={styles.actionIcon}>
                <Zap size={21} fill="currentColor" />
              </span>
              Decide for Me
            </button>
            <button className={styles.wheelButton}>
              <span className={styles.actionIcon}>
                <Compass size={22} />
              </span>
              Hungry Wheel
            </button>
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
              <a href="/for-foodies">See all</a>
            </div>
            <div className={styles.quickGrid}>
              <Image src="/images/food/yong-tau-foo-topdown.png" alt="" width={150} height={96} />
              <Image src="/images/food/satay-topdown.png" alt="" width={150} height={96} />
            </div>
          </section>
        </div>

        <nav className={styles.bottomNav} aria-label="App preview navigation">
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
        </nav>
      </div>
    </div>
  );
}
