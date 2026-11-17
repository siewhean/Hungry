import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import styles from "@/components/seo/SeoPage.module.css";
import {
  getArea,
  getRelatedDishes,
  getRelatedPlaces,
  type PlaceSeoContent,
  SEO_LAST_UPDATED,
} from "@/lib/seo/content";
import { breadcrumb } from "@/lib/seo/breadcrumbs";
import {
  buildBreadcrumbSchema,
  buildFAQSchema,
  buildFoodEstablishmentSchema,
  buildItemListSchema,
} from "@/lib/seo/schema";
import { siteConfig } from "@/app/seo";

type PlaceContentProps = {
  path: string;
  place: PlaceSeoContent;
};

export function PlaceContent({ path, place }: PlaceContentProps) {
  const area = getArea(place.areaSlug);
  const dishes = getRelatedDishes(place.dishSlugs);
  const relatedPlaces = getRelatedPlaces(place);
  const breadcrumbs = [
    breadcrumb("Home", "/"),
    breadcrumb("Singapore Food", "/singapore"),
    ...(area ? [breadcrumb(area.name, `/singapore/${area.slug}/food`)] : []),
    breadcrumb(place.name, path),
  ];
  const jsonLd = [
    buildBreadcrumbSchema(siteConfig.url, breadcrumbs),
    buildFoodEstablishmentSchema({ path, place, siteUrl: siteConfig.url }),
    buildItemListSchema(
      siteConfig.url,
      `${place.name} related dishes`,
      dishes.map((dish) => ({
        name: dish.name,
        path: `/dishes/${dish.slug}`,
      })),
    ),
    buildFAQSchema(place.faq),
  ].filter(Boolean);

  return (
    <main className={styles.main}>
      <JsonLd data={jsonLd} />
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            {breadcrumbs.map((item, index) => (
              <span key={item.path}>
                {index > 0 ? " / " : ""}
                {index === breadcrumbs.length - 1 ? (
                  item.label
                ) : (
                  <Link href={item.path}>{item.label}</Link>
                )}
              </span>
            ))}
          </nav>
          <div className={styles.heroGrid}>
            <div>
              <span className={styles.eyebrow}>
                {place.type === "hawker_centre" ? "Hawker centre" : "Mall food court"}
              </span>
              <h1>{place.name}</h1>
              <p className={styles.lead}>{place.description}</p>
            </div>
            <aside className={styles.answerCard}>
              <h2>Quick answer</h2>
              <dl className={styles.factList}>
                <div>
                  <dt>Address</dt>
                  <dd>{place.address}</dd>
                </div>
                <div>
                  <dt>Transport</dt>
                  <dd>{place.nearbyTransport}</dd>
                </div>
                <div>
                  <dt>Related dishes</dt>
                  <dd>{dishes.map((dish) => dish.name).join(", ")}</dd>
                </div>
                <div>
                  <dt>Hours and ratings</dt>
                  <dd>Not emitted until source-backed</dd>
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

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Dishes</span>
            <h2>Search this place by dish.</h2>
          </div>
          <div className={styles.grid}>
            {dishes.map((dish) => (
              <article className={styles.card} key={dish.slug}>
                <h3>{dish.name}</h3>
                <p>{dish.summary}</p>
                <Link href={`/dishes/${dish.slug}`}>Open {dish.name} page</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Related links</span>
            <h2>Explore nearby pages.</h2>
          </div>
          <ul className={styles.pillList}>
            {area ? (
              <li>
                <Link href={`/singapore/${area.slug}/food`}>{area.name} food</Link>
              </li>
            ) : null}
            {relatedPlaces.map((relatedPlace) => (
              <li key={relatedPlace.slug}>
                <Link
                  href={
                    relatedPlace.type === "hawker_centre"
                      ? `/hawker-centres/${relatedPlace.slug}`
                      : `/malls/${relatedPlace.slug}/food`
                  }
                >
                  {relatedPlace.name}
                </Link>
              </li>
            ))}
          </ul>
          <p className={styles.sourceNote}>Source note: {place.sourceNote}</p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.faqList}>
            {place.faq.map((item) => (
              <article className={styles.faqItem} key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
