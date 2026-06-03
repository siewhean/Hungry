"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Compass,
  Dices,
  Flame,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Star,
  User,
  Utensils,
  Zap,
} from "lucide-react";
import styles from "./DiscoveryPhoneMockup.module.css";

export type DiscoveryPhoneMockupScreen = "discover" | "stall-detail" | "stall-menu" | "review-feed";

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

const stallDishes = [
  {
    name: "Signature Chicken Rice",
    price: "$4.80",
    detail: "Silky poached chicken, fragrant rice",
    image: "/images/food/chicken-rice-topdown.png",
    available: true,
  },
  {
    name: "Char Kway Teow",
    price: "$5.50",
    detail: "Wok hei noodles, cockles, lup cheong",
    image: "/images/food/char-kway-teow-topdown.png",
    available: true,
  },
  {
    name: "Laksa Bowl",
    price: "$5.20",
    detail: "Coconut gravy, prawn, fishcake",
    image: "/images/food/laksa-topdown.png",
    available: true,
  },
] as const;

const reviewCards = [
  {
    author: "Mei Lin",
    dish: "Signature Chicken Rice",
    venue: "Tan Kee Chicken Rice",
    rating: 5,
    text: "Rice was fragrant, chicken was tender, and the chilli had the right kick.",
    image: "/images/food/chicken-rice-topdown.png",
  },
  {
    author: "Arjun",
    dish: "Char Kway Teow",
    venue: "Chinatown Complex",
    rating: 4,
    text: "Good wok hei and clear opening status before I made the trip down.",
    image: "/images/food/char-kway-teow-topdown.png",
  },
] as const;

const screenLabels = {
  discover: "Hungry discovery page on iPhone",
  "stall-detail": "Hungry stall details page on iPhone",
  "stall-menu": "Hungry stall menu section on iPhone",
  "review-feed": "Hungry review feed with mock contents on iPhone",
} satisfies Record<DiscoveryPhoneMockupScreen, string>;

function StarRating({ rating }: { rating: number }) {
  return (
    <span className={styles.starRating} aria-label={`${rating} star rating`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} size={13} fill={value <= rating ? "currentColor" : "transparent"} />
      ))}
    </span>
  );
}

function DiscoverContent() {
  return (
    <>
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
    </>
  );
}

function StallDetailContent() {
  return (
    <div className={styles.detailPreview}>
      <div className={styles.appTopBar}>
        <span>
          <ArrowLeft size={18} />
        </span>
        <span>
          <Heart size={18} />
        </span>
      </div>

      <div className={styles.stallHeroImage}>
        <Image src="/images/food/chicken-rice-topdown.png" alt="" fill sizes="260px" />
      </div>

      <section className={styles.stallIntro}>
        <p className={styles.locationEyebrow}>Chinatown Complex</p>
        <h2>Tan Kee Chicken Rice</h2>
        <p>#02-32 · Hainanese · 12 min walk</p>
        <div className={styles.infoPillRow}>
          <span>Open now</span>
          <span>4.7 ★</span>
          <span>$4-$7</span>
        </div>
      </section>

      <div className={styles.infoCard}>
        <MapPin size={18} />
        <div>
          <strong>Stall details</strong>
          <p>Chinatown Food Street, near the red line exit. Queue usually clears in 8 min.</p>
        </div>
      </div>

      <section className={styles.signatureStrip}>
        <div className={styles.sectionHeaderCompact}>
          <h3>Signature dishes</h3>
          <span>See all</span>
        </div>
        <div className={styles.signatureGrid}>
          {stallDishes.slice(0, 2).map((dish) => (
            <article className={styles.signatureCard} key={dish.name}>
              <Image src={dish.image} alt="" fill sizes="120px" />
              <span>{dish.name}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function StallMenuContent() {
  return (
    <div className={styles.menuPreview}>
      <div className={styles.appTopBar}>
        <span>
          <ArrowLeft size={18} />
        </span>
        <span className={styles.openStatus}>Open</span>
      </div>

      <section className={styles.menuHeader}>
        <p className={styles.locationEyebrow}>Tan Kee Chicken Rice</p>
        <h2>Menu</h2>
        <p>Current dishes, prices, photos, and availability.</p>
      </section>

      <div className={styles.menuTabs}>
        <span className={styles.tabActive}>Signature</span>
        <span>Noodles</span>
        <span>Drinks</span>
      </div>

      <div className={styles.menuList}>
        {stallDishes.map((dish) => (
          <article className={styles.menuDishCard} key={dish.name}>
            <div className={styles.menuDishImage}>
              <Image src={dish.image} alt="" fill sizes="90px" />
            </div>
            <div>
              <strong>{dish.name}</strong>
              <p>{dish.detail}</p>
              <span>{dish.price}</span>
            </div>
            <small>{dish.available ? "Available" : "Sold out"}</small>
          </article>
        ))}
      </div>
    </div>
  );
}

function ReviewFeedContent() {
  return (
    <div className={styles.reviewPreview}>
      <section className={styles.reviewHeader}>
        <p className={styles.locationEyebrow}>Review</p>
        <h2>Dish proof from foodies</h2>
        <p>Mock community content attached to real dishes and stalls.</p>
      </section>

      <div className={styles.reviewFilterRow}>
        <span className={styles.tabActive}>Recent</span>
        <span>Top rated</span>
        <span>By dish</span>
      </div>

      <div className={styles.reviewList}>
        {reviewCards.map((review) => (
          <article className={styles.reviewCard} key={`${review.author}-${review.dish}`}>
            <div className={styles.reviewPhoto}>
              <Image src={review.image} alt="" fill sizes="160px" />
            </div>
            <div className={styles.reviewBody}>
              <div className={styles.reviewMeta}>
                <span>{review.author.charAt(0)}</span>
                <div>
                  <strong>{review.author}</strong>
                  <p>{review.venue}</p>
                </div>
                <StarRating rating={review.rating} />
              </div>
              <div className={styles.reviewDishTag}>{review.dish}</div>
              <p>{review.text}</p>
              <div className={styles.reviewActions}>
                <span>
                  <Heart size={13} /> 24
                </span>
                <span>
                  <MessageCircle size={13} /> 6
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function getContent(screen: DiscoveryPhoneMockupScreen) {
  switch (screen) {
    case "stall-detail":
      return <StallDetailContent />;
    case "stall-menu":
      return <StallMenuContent />;
    case "review-feed":
      return <ReviewFeedContent />;
    case "discover":
    default:
      return <DiscoverContent />;
  }
}

type DiscoveryPhoneMockupProps = {
  screen?: DiscoveryPhoneMockupScreen;
  isActive?: boolean;
  animateContent?: boolean;
};

export function DiscoveryPhoneMockup({
  screen = "discover",
  isActive = false,
  animateContent = false,
}: DiscoveryPhoneMockupProps) {
  const activeTab = screen === "review-feed" ? "Review" : "Discover";
  const isDiscover = screen === "discover";
  const contentClassName = `${styles.content} ${isDiscover ? styles.discoveryContent : styles.productContent}`;

  return (
    <div className={styles.device} aria-label={screenLabels[screen]}>
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

        <AnimatePresence initial={false} mode="wait">
          {(!animateContent || isActive) ? (
            <motion.div
              key={`content-${screen}-${isActive ? "active" : "hidden"}`}
              className={contentClassName}
              aria-label={screenLabels[screen]}
              initial={animateContent ? { opacity: 0 } : undefined}
              animate={animateContent ? { opacity: 1 } : undefined}
              exit={animateContent ? { opacity: 0 } : undefined}
              transition={animateContent ? { duration: 0.4, ease: "easeInOut" } : undefined}
            >
              {getContent(screen)}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className={styles.bottomNav} aria-hidden="true">
          <span>
            <Home size={24} />
            Home
          </span>
          <span className={activeTab === "Discover" ? styles.activeNav : undefined}>
            <Compass size={25} />
            Discover
          </span>
          <span className={styles.addButton}>
            <Plus size={34} />
          </span>
          <span className={activeTab === "Review" ? styles.activeNav : undefined}>
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
