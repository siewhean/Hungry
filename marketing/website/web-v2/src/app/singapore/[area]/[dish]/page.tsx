import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import styles from "@/components/seo/SeoPage.module.css";
import {
  dishAreaPages,
  getArea,
  getDish,
  getDishAreaPage,
  SEO_LAST_UPDATED,
} from "@/lib/seo/content";
import { singaporeBreadcrumbs } from "@/lib/seo/breadcrumbs";
import { backedPlacePath } from "@/lib/seo/placeRoutes";
import { buildBreadcrumbSchema, buildFAQSchema, buildItemListSchema } from "@/lib/seo/schema";
import { routeMetadata, siteConfig } from "@/app/seo";

type PageProps = {
  params: Promise<{ area: string; dish: string }>;
};

export function generateStaticParams() {
  return dishAreaPages.map((page) => ({
    area: page.areaSlug,
    dish: page.dishSlug,
  }));
}

export async function generateMetadata({ params }: PageProps) {
  const { area, dish } = await params;
  return routeMetadata(`/singapore/${area}/${dish}`);
}

export default async function DishAreaPage({ params }: PageProps) {
  const { area: areaSlug, dish: dishSlug } = await params;
  const area = getArea(areaSlug);
  const dish = getDish(dishSlug);
  const page = getDishAreaPage(areaSlug, dishSlug);

  if (!area || !dish || !page) {
    notFound();
  }

  const path = `/singapore/${area.slug}/${dish.slug}`;
  const backedVenueLinks = page.visibleVenues
    .map((venue) => ({
      name: venue.name,
      path: backedPlacePath(venue),
    }))
    .filter((venue): venue is { name: string; path: string } => Boolean(venue.path));
  const breadcrumbs = singaporeBreadcrumbs(`${dish.name} near ${area.name}`, path);
  const jsonLd = [
    buildBreadcrumbSchema(siteConfig.url, breadcrumbs),
    buildItemListSchema(
      siteConfig.url,
      `${dish.name} near ${area.name} place links`,
      backedVenueLinks,
    ),
    buildFAQSchema(page.faq),
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
            <Link href={`/singapore/${area.slug}/food`}>{area.name}</Link>
            <span>/</span>
            <span>{dish.name}</span>
          </nav>
          <div className={styles.heroGrid}>
            <div>
              <span className={styles.eyebrow}>Dish and area</span>
              <h1>
                {dish.name} near {area.name}
              </h1>
              <p className={styles.lead}>{page.summary}</p>
            </div>
            <aside className={styles.answerCard}>
              <h2>Quick answer</h2>
              <dl className={styles.factList}>
                <div>
                  <dt>Dish</dt>
                  <dd>{dish.name}</dd>
                </div>
                <div>
                  <dt>Area</dt>
                  <dd>{area.name}</dd>
                </div>
                <div>
                  <dt>Nearby MRT</dt>
                  <dd>{area.mrtStation}</dd>
                </div>
                <div>
                  <dt>Current hours</dt>
                  <dd>Not available on this SEO page</dd>
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
            <span className={styles.eyebrow}>Places</span>
            <h2>Visible places connected to this query.</h2>
            <p>
              These are not ranked results. They are crawlable links that connect {dish.name} and{" "}
              {area.name} to useful Singapore food pages.
            </p>
          </div>
          <div className={styles.grid}>
            {page.visibleVenues.map((venue) => (
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

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>More routes</span>
            <h2>Continue the Singapore food path.</h2>
          </div>
          <ul className={styles.pillList}>
            <li>
              <Link href={`/dishes/${dish.slug}`}>All {dish.name} in Singapore</Link>
            </li>
            <li>
              <Link href={`/singapore/${area.slug}/food`}>All {area.name} food</Link>
            </li>
            <li>
              <Link href={`/singapore/mrt/${area.slug}/food`}>Food near {area.mrtStation} MRT</Link>
            </li>
          </ul>
          <p className={styles.sourceNote}>Source note: {page.sourceNote}</p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.faqList}>
            {page.faq.map((item) => (
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
