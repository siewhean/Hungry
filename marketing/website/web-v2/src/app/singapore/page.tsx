import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import styles from "@/components/seo/SeoPage.module.css";
import {
  guidePath,
  seoAreas,
  seoDishes,
  seoGuides,
  seoPlaces,
  SEO_LAST_UPDATED,
} from "@/lib/seo/content";
import { breadcrumb, singaporeBreadcrumbs } from "@/lib/seo/breadcrumbs";
import { buildBreadcrumbSchema, buildFAQSchema, buildItemListSchema } from "@/lib/seo/schema";
import { routeMetadata, siteConfig } from "@/app/seo";

export const metadata = routeMetadata("/singapore");
export const revalidate = 86400;

const faq = [
  {
    question: "What does Hungry help people find?",
    answer:
      "Hungry helps people start with a dish, then compare nearby places in Singapore.",
  },
  {
    question: "Does Hungry publish fake ratings or opening hours on SEO pages?",
    answer:
      "No. Ratings, review counts, opening hours, and verification labels are omitted unless the page has visible source-backed data for those facts.",
  },
];

export default function SingaporeFoodHubPage() {
  const pagePath = "/singapore";
  const breadcrumbs = singaporeBreadcrumbs();
  const jsonLd = [
    buildBreadcrumbSchema(siteConfig.url, breadcrumbs),
    buildItemListSchema(
      siteConfig.url,
      "Singapore food discovery areas",
      seoAreas.map((area) => ({
        name: area.name,
        path: `/singapore/${area.slug}/food`,
      })),
    ),
    buildItemListSchema(
      siteConfig.url,
      "Singapore dish discovery pages",
      seoDishes.map((dish) => ({
        name: dish.name,
        path: `/dishes/${dish.slug}`,
      })),
    ),
    buildFAQSchema(faq),
  ].filter(Boolean);

  return (
    <main className={styles.main}>
      <JsonLd data={jsonLd} />
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>Singapore Food</span>
          </nav>
          <div className={styles.heroGrid}>
            <div>
              <span className={styles.eyebrow}>Singapore food</span>
              <h1>Find food by dish, area, or MRT.</h1>
              <p className={styles.lead}>
                Hungry is built around the way people decide what to eat in Singapore. These public
                pages explain the product without inventing ratings, hours, or stall claims.
              </p>
            </div>
            <aside className={styles.answerCard} aria-labelledby="quick-answer-title">
              <h2 id="quick-answer-title">Quick answer</h2>
              <dl className={styles.factList}>
                <div>
                  <dt>Best for</dt>
                  <dd>Singapore dish-first food discovery</dd>
                </div>
                <div>
                  <dt>Launch cluster</dt>
                  <dd>
                    {seoAreas.length} areas, {seoDishes.length} dishes
                  </dd>
                </div>
                <div>
                  <dt>Data trust</dt>
                  <dd>No fake ratings, hours, or review counts</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{SEO_LAST_UPDATED}</dd>
                </div>
              </dl>
            </aside>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="areas-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Area pages</span>
              <h2 id="areas-title">Singapore areas we are starting with.</h2>
            <p>
              Each area page links the MRT station, nearby places, related dishes, and source notes.
            </p>
          </div>
          <div className={`${styles.grid} ${styles.three}`}>
            {seoAreas.map((area) => (
              <article className={styles.card} key={area.slug}>
                <h3>{area.name}</h3>
                <p>{area.summary}</p>
                <Link href={`/singapore/${area.slug}/food`}>Open {area.name} food page</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="dishes-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Dish pages</span>
            <h2 id="dishes-title">Dish pages for Singapore searches.</h2>
          </div>
          <ul className={styles.pillList}>
            {seoDishes.map((dish) => (
              <li key={dish.slug}>
                <Link href={`/dishes/${dish.slug}`}>{dish.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="places-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Places</span>
            <h2 id="places-title">Hawker-centre and mall food pages with visible facts.</h2>
          </div>
          <div className={styles.grid}>
            {seoPlaces.map((place) => (
              <article className={styles.card} key={place.slug}>
                <h3>{place.name}</h3>
                <p>{place.description}</p>
                <p>{place.address}</p>
                <Link
                  href={
                    place.type === "hawker_centre"
                      ? `/hawker-centres/${place.slug}`
                      : `/malls/${place.slug}/food`
                  }
                >
                  View food page
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="guides-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Guides</span>
            <h2 id="guides-title">Singapore food guides.</h2>
          </div>
          <div className={styles.grid}>
            {seoGuides.map((guide) => (
              <article className={styles.card} key={guide.slug}>
                <h3>{guide.title}</h3>
                <p>{guide.description}</p>
                <Link href={guidePath(guide)}>Read guide</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="faq-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>FAQ</span>
            <h2 id="faq-title">How we handle search facts.</h2>
          </div>
          <div className={styles.faqList}>
            {faq.map((item) => (
              <article className={styles.faqItem} key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
          <p className={styles.sourceNote}>
            Source note: {seoAreas[0].sourceNote} Canonical page: {siteConfig.url}
            {pagePath}. Breadcrumb: {breadcrumb("Singapore Food", pagePath).label}.
          </p>
        </div>
      </section>
    </main>
  );
}
