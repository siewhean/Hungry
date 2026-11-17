import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import styles from "@/components/seo/SeoPage.module.css";
import {
  getArea,
  getDish,
  getRelatedDishes,
  type AreaSeoContent,
  seoDishes,
  SEO_LAST_UPDATED,
} from "@/lib/seo/content";
import { breadcrumb } from "@/lib/seo/breadcrumbs";
import { buildBreadcrumbSchema, buildFAQSchema, buildItemListSchema } from "@/lib/seo/schema";
import { routeMetadata, siteConfig } from "@/app/seo";

type PageProps = {
  params: Promise<{ dishSlug: string }>;
};

export function generateStaticParams() {
  return seoDishes.map((dish) => ({ dishSlug: dish.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { dishSlug } = await params;
  return routeMetadata(`/dishes/${dishSlug}`);
}

export default async function DishPage({ params }: PageProps) {
  const { dishSlug } = await params;
  const dish = getDish(dishSlug);

  if (!dish) {
    notFound();
  }

  const areas = dish.areaSlugs
    .map((slug) => getArea(slug))
    .filter((area): area is AreaSeoContent => Boolean(area));
  const relatedDishes = getRelatedDishes(dish.relatedDishSlugs);
  const breadcrumbs = [
    breadcrumb("Home", "/"),
    breadcrumb("Singapore Food", "/singapore"),
    breadcrumb(dish.name, `/dishes/${dish.slug}`),
  ];
  const jsonLd = [
    buildBreadcrumbSchema(siteConfig.url, breadcrumbs),
    buildItemListSchema(
      siteConfig.url,
      `${dish.name} area links`,
      areas.map((area) => ({
        name: area.name,
        path: `/singapore/${area.slug}/${dish.slug}`,
      })),
    ),
    buildFAQSchema(dish.faq),
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
            <span>{dish.name}</span>
          </nav>
          <div className={styles.heroGrid}>
            <div>
              <span className={styles.eyebrow}>Dish guide</span>
              <h1>{dish.name} in Singapore</h1>
              <p className={styles.lead}>{dish.description}</p>
            </div>
            <aside className={styles.answerCard}>
              <h2>Quick answer</h2>
              <dl className={styles.factList}>
                <div>
                  <dt>Dish</dt>
                  <dd>{dish.summary}</dd>
                </div>
                <div>
                  <dt>Where to search</dt>
                  <dd>{areas.map((area) => area.name).join(", ")}</dd>
                </div>
                <div>
                  <dt>Ratings</dt>
                  <dd>Not emitted until real review data is visible</dd>
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
            <span className={styles.eyebrow}>Area links</span>
            <h2 id="areas-title">Where Hungry connects {dish.name} searches.</h2>
            <p>
              These links are area-and-dish pages. They are not ranked lists and do not claim live
              opening status.
            </p>
          </div>
          <div className={styles.grid}>
            {areas.map((area) => (
              <article className={styles.card} key={area.slug}>
                <h3>{area.name}</h3>
                <p>{area.summary}</p>
                <Link href={`/singapore/${area.slug}/${dish.slug}`}>
                  {dish.name} near {area.name}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="dietary-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Dietary notes</span>
            <h2 id="dietary-title">Use source-backed dietary data.</h2>
          </div>
          <ul className={styles.pillList}>
            {dish.dietaryNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="related-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Similar dishes</span>
            <h2 id="related-title">Related Singapore dishes.</h2>
          </div>
          <ul className={styles.pillList}>
            {relatedDishes.map((relatedDish) => (
              <li key={relatedDish.slug}>
                <Link href={`/dishes/${relatedDish.slug}`}>{relatedDish.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="faq-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>FAQ</span>
            <h2 id="faq-title">{dish.name} discovery questions.</h2>
          </div>
          <div className={styles.faqList}>
            {dish.faq.map((item) => (
              <article className={styles.faqItem} key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
          <p className={styles.sourceNote}>Source note: {dish.sourceNote}</p>
        </div>
      </section>
    </main>
  );
}
