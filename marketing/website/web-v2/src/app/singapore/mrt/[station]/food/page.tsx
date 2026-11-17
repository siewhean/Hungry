import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import styles from "@/components/seo/SeoPage.module.css";
import {
  getAreaByMrtStation,
  getRelatedDishes,
  seoAreas,
  SEO_LAST_UPDATED,
} from "@/lib/seo/content";
import { singaporeBreadcrumbs } from "@/lib/seo/breadcrumbs";
import { backedDishAreaPath, backedPlacePath } from "@/lib/seo/placeRoutes";
import { buildBreadcrumbSchema, buildFAQSchema, buildItemListSchema } from "@/lib/seo/schema";
import { routeMetadata, siteConfig } from "@/app/seo";

type PageProps = {
  params: Promise<{ station: string }>;
};

export function generateStaticParams() {
  return seoAreas.map((area) => ({ station: area.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { station } = await params;
  return routeMetadata(`/singapore/mrt/${station}/food`);
}

export default async function MrtFoodPage({ params }: PageProps) {
  const { station } = await params;
  const area = getAreaByMrtStation(station);

  if (!area) {
    notFound();
  }

  const dishes = getRelatedDishes(area.dishSlugs);
  const backedDishLinks = dishes
    .map((dish) => ({
      dish,
      path: backedDishAreaPath(area.slug, dish.slug),
    }))
    .filter((item): item is { dish: (typeof dishes)[number]; path: string } =>
      Boolean(item.path),
    );
  const backedVenueLinks = area.venues
    .map((venue) => ({
      name: venue.name,
      path: backedPlacePath(venue),
    }))
    .filter((venue): venue is { name: string; path: string } => Boolean(venue.path));
  const breadcrumbs = singaporeBreadcrumbs(
    `Food near ${area.mrtStation} MRT`,
    `/singapore/mrt/${area.slug}/food`,
  );
  const faq = [
    {
      question: `What food does Hungry show near ${area.mrtStation} MRT?`,
      answer: `Hungry links ${area.mrtStation} MRT searches to the ${area.name} area page, nearby food places, and dish pages.`,
    },
    {
      question: "Does this MRT page show live distance or opening hours?",
      answer:
        "No. Live distance, queue, and open-now claims are omitted unless real app data supports them.",
    },
  ];
  const jsonLd = [
    buildBreadcrumbSchema(siteConfig.url, breadcrumbs),
    buildItemListSchema(
      siteConfig.url,
      `Food near ${area.mrtStation} MRT`,
      backedVenueLinks,
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
            <Link href="/singapore">Singapore Food</Link>
            <span>/</span>
            <span>{area.mrtStation} MRT</span>
          </nav>
          <div className={styles.heroGrid}>
            <div>
              <span className={styles.eyebrow}>MRT food guide</span>
              <h1>Food near {area.mrtStation} MRT</h1>
              <p className={styles.lead}>
                Start from {area.mrtStation}, compare nearby dishes, then choose a place with
                current app data when it is available.
              </p>
            </div>
            <aside className={styles.answerCard}>
              <h2>Quick answer</h2>
              <dl className={styles.factList}>
                <div>
                  <dt>Area</dt>
                  <dd>{area.name}</dd>
                </div>
                <div>
                  <dt>Dishes</dt>
                  <dd>{dishes.map((dish) => dish.name).join(", ")}</dd>
                </div>
                <div>
                  <dt>Data status</dt>
                  <dd>Open-now and prices omitted until source-backed</dd>
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
            <span className={styles.eyebrow}>Nearby places</span>
            <h2>Use the {area.name} area cluster.</h2>
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
                      <Link href={placePath}>View food page</Link>
                    ) : (
                      <p>Detailed place page will be added when source-backed.</p>
                    )}
                  </article>
                );
              })()
            ))}
          </div>
          <p className={styles.sourceNote}>Source note: {area.sourceNote}</p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Dish links</span>
            <h2>Search by dish near {area.mrtStation}.</h2>
          </div>
          <ul className={styles.pillList}>
            {backedDishLinks.map(({ dish, path }) => (
              <li key={dish.slug}>
                <Link href={path}>{dish.name}</Link>
              </li>
            ))}
            <li>
              <Link href={`/singapore/${area.slug}/food`}>All {area.name} food</Link>
            </li>
          </ul>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.faqList}>
            {faq.map((item) => (
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
