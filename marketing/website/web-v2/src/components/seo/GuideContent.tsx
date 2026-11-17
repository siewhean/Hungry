import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import styles from "@/components/seo/SeoPage.module.css";
import {
  getArea,
  getDish,
  type AreaSeoContent,
  type DishSeoContent,
  type GuideSeoContent,
  SEO_LAST_UPDATED,
} from "@/lib/seo/content";
import { breadcrumb } from "@/lib/seo/breadcrumbs";
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
  buildFAQSchema,
  buildItemListSchema,
} from "@/lib/seo/schema";
import { siteConfig } from "@/app/seo";

type GuideContentProps = {
  guide: GuideSeoContent;
  path: string;
};

export function GuideContent({ guide, path }: GuideContentProps) {
  const areas = guide.relatedAreaSlugs
    .map((slug) => getArea(slug))
    .filter((area): area is AreaSeoContent => Boolean(area));
  const dishes = guide.relatedDishSlugs
    .map((slug) => getDish(slug))
    .filter((dish): dish is DishSeoContent => Boolean(dish));
  const breadcrumbs = [
    breadcrumb("Home", "/"),
    breadcrumb("Singapore Food", "/singapore"),
    breadcrumb(guide.title, path),
  ];
  const jsonLd = [
    buildBreadcrumbSchema(siteConfig.url, breadcrumbs),
    buildArticleSchema({
      dateModified: SEO_LAST_UPDATED,
      description: guide.description,
      path,
      siteName: siteConfig.name,
      siteUrl: siteConfig.url,
      title: guide.title,
    }),
    buildItemListSchema(siteConfig.url, `${guide.title} related links`, [
      ...areas.map((area) => ({
        name: area.name,
        path: `/singapore/${area.slug}/food`,
      })),
      ...dishes.map((dish) => ({
        name: dish.name,
        path: `/dishes/${dish.slug}`,
      })),
    ]),
    buildFAQSchema(guide.faq),
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
            <span>{guide.title}</span>
          </nav>
          <div className={styles.heroGrid}>
            <div>
              <span className={styles.eyebrow}>Singapore food guide</span>
              <h1>{guide.title}</h1>
              <p className={styles.lead}>{guide.description}</p>
            </div>
            <aside className={styles.answerCard}>
              <h2>Quick answer</h2>
              <dl className={styles.factList}>
                <div>
                  <dt>Best for</dt>
                  <dd>{guide.guideType.replace(/_/g, " ")} searches</dd>
                </div>
                <div>
                  <dt>Related areas</dt>
                  <dd>{areas.map((area) => area.name).join(", ")}</dd>
                </div>
                <div>
                  <dt>Related dishes</dt>
                  <dd>{dishes.map((dish) => dish.name).join(", ")}</dd>
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
          <div className={styles.grid}>
            {guide.sections.map((section) => (
              <article className={styles.card} key={section.heading}>
                <h3>{section.heading}</h3>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Related pages</span>
            <h2>Explore related areas and dishes.</h2>
          </div>
          <ul className={styles.pillList}>
            {areas.map((area) => (
              <li key={area.slug}>
                <Link href={`/singapore/${area.slug}/food`}>{area.name}</Link>
              </li>
            ))}
            {dishes.map((dish) => (
              <li key={dish.slug}>
                <Link href={`/dishes/${dish.slug}`}>{dish.name}</Link>
              </li>
            ))}
          </ul>
          <p className={styles.sourceNote}>Source note: {guide.sourceNote}</p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.faqList}>
            {guide.faq.map((item) => (
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
