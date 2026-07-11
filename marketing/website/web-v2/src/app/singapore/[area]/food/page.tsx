import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import styles from "@/components/seo/SeoPage.module.css";
import {
  getArea,
  getRelatedAreas,
  getRelatedDishes,
  seoAreas,
  SEO_LAST_UPDATED,
} from "@/lib/seo/content";
import { singaporeBreadcrumbs } from "@/lib/seo/breadcrumbs";
import { backedDishAreaPath, backedPlacePath } from "@/lib/seo/placeRoutes";
import { buildBreadcrumbSchema, buildFAQSchema, buildItemListSchema } from "@/lib/seo/schema";
import { routeMetadata, siteConfig } from "@/app/seo";

type PageProps = {
  params: Promise<{ area: string }>;
};

export function generateStaticParams() {
  return seoAreas.map((area) => ({ area: area.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { area: areaSlug } = await params;
  return routeMetadata(`/singapore/${areaSlug}/food`);
}

export default async function AreaFoodPage({ params }: PageProps) {
  const { area: areaSlug } = await params;
  const area = getArea(areaSlug);

  if (!area) {
    notFound();
  }

  const dishLinks = getRelatedDishes(area.dishSlugs);
  const backedDishLinks = dishLinks
    .map((dish) => ({
      dish,
      path: backedDishAreaPath(area.slug, dish.slug),
    }))
    .filter((item): item is { dish: (typeof dishLinks)[number]; path: string } =>
      Boolean(item.path),
    );
  const relatedAreas = getRelatedAreas(area);
  const backedVenueLinks = area.venues
    .map((venue) => ({
      name: venue.name,
      path: backedPlacePath(venue),
    }))
    .filter((venue): venue is { name: string; path: string } => Boolean(venue.path));
  const breadcrumbs = singaporeBreadcrumbs(`${area.name} Food`, `/singapore/${area.slug}/food`);
  const jsonLd = [
    buildBreadcrumbSchema(siteConfig.url, breadcrumbs),
    buildItemListSchema(
      siteConfig.url,
      `${area.name} dish discovery`,
      backedDishLinks.map(({ dish, path }) => ({
        name: dish.name,
        path,
      })),
    ),
    buildItemListSchema(
      siteConfig.url,
      `${area.name} food places`,
      backedVenueLinks,
    ),
    buildFAQSchema(area.faq),
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
              <span className={styles.eyebrow}>Area food guide</span>
              <h1>Food in {area.name}</h1>
              <p className={styles.lead}>{area.description}</p>
            </div>
            <aside className={styles.answerCard} aria-labelledby="quick-answer-title">
              <h2 id="quick-answer-title">Quick answer</h2>
              <dl className={styles.factList}>
                <div>
                  <dt>Best for</dt>
                  <dd>{area.goodFor.join(", ")}</dd>
                </div>
                <div>
                  <dt>Nearest MRT</dt>
                  <dd>{area.mrtStation}</dd>
                </div>
                <div>
                  <dt>Known dishes</dt>
                  <dd>{dishLinks.map((dish) => dish.name).join(", ")}</dd>
                </div>
                <div>
                  <dt>Opening hours</dt>
                  <dd>Verify before going</dd>
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

      <section className={styles.section} aria-labelledby="dishes-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Popular dishes</span>
            <h2 id="dishes-title">Start with a dish, then choose the place.</h2>
            <p>{area.summary}</p>
          </div>
          <div className={styles.grid}>
            {backedDishLinks.map(({ dish, path }) => (
              <article className={styles.card} key={dish.slug}>
                <h3>{dish.name}</h3>
                <p>{dish.summary}</p>
                <Link href={path}>View {dish.name} near {area.name}</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="places-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Places</span>
            <h2 id="places-title">Food places connected to {area.name}.</h2>
            <p>{area.transportNote}</p>
          </div>
          <div className={styles.grid}>
            {area.venues.map((venue) => (
              (() => {
                const placePath = backedPlacePath(venue);

                return (
                  <article className={styles.card} key={venue.slug}>
                    <h3>{venue.name}</h3>
                    <p>{venue.address}</p>
                    {placePath ? (
                      <Link href={placePath}>Open place page</Link>
                    ) : (
                      <p>Detailed place page will be added when source-backed.</p>
                    )}
                  </article>
                );
              })()
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="related-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Internal links</span>
            <h2 id="related-title">Related Singapore food areas.</h2>
          </div>
          <ul className={styles.pillList}>
            {relatedAreas.map((relatedArea) => (
              <li key={relatedArea.slug}>
                <Link href={`/singapore/${relatedArea.slug}/food`}>{relatedArea.name}</Link>
              </li>
            ))}
            <li>
              <Link href={`/singapore/mrt/${area.slug}/food`}>Food near {area.mrtStation} MRT</Link>
            </li>
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="faq-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>FAQ</span>
            <h2 id="faq-title">{area.name} food search questions.</h2>
          </div>
          <div className={styles.faqList}>
            {area.faq.map((item) => (
              <article className={styles.faqItem} key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
          <p className={styles.sourceNote}>Source note: {area.sourceNote}</p>
        </div>
      </section>
    </main>
  );
}
