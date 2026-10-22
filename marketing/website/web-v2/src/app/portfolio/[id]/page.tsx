import { notFound } from "next/navigation";

import styles from "@/components/seo/SeoPage.module.css";
import { SharePreview, sharePreviewMetadata } from "@/components/share/SharePreview";
import {
  formatPrice,
  formatUpdated,
  getSharedPortfolio,
  readShareSource,
} from "@/lib/share/sharedLinks";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ src?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const portfolio = await getSharedPortfolio(id);
  if (!portfolio) {
    return sharePreviewMetadata(
      "List not found",
      "This list is private or no longer on Hungry.",
      `/portfolio/${id}`,
    );
  }
  const by = portfolio.ownerDisplayName ? ` by ${portfolio.ownerDisplayName}` : "";
  return sharePreviewMetadata(
    portfolio.name,
    `${portfolio.items.length} picks${by} on Hungry.`,
    `/portfolio/${portfolio.id}`,
    portfolio.items.find((item) => item.imageUrl)?.imageUrl,
  );
}

export default async function SharedPortfolioPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const shareSource = readShareSource((await searchParams).src);
  const portfolio = await getSharedPortfolio(id);
  if (!portfolio) notFound();

  const updated = formatUpdated(portfolio.updatedAt);
  const isRanking = portfolio.type === "ranking";
  const facts = [
    { label: "Picks", value: String(portfolio.items.length) },
    ...(portfolio.ownerDisplayName ? [{ label: "By", value: portfolio.ownerDisplayName }] : []),
    ...(updated ? [{ label: "Last updated", value: updated }] : []),
  ];

  return (
    <SharePreview
      eyebrow="List on Hungry"
      title={portfolio.name}
      lead={portfolio.description}
      facts={facts}
      appPath={`portfolio/${portfolio.id}`}
      shareSource={shareSource}
    >
      {portfolio.items.length ? (
        <section className={styles.section} aria-labelledby="picks-title">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <span className={styles.eyebrow}>Picks</span>
              <h2 id="picks-title">What&apos;s on the list</h2>
            </div>
            <div className={styles.grid}>
              {portfolio.items.map((item, index) => {
                const href =
                  item.itemType === "dish" && item.dishId
                    ? `/dish/${encodeURIComponent(item.dishId)}`
                    : item.stallId
                      ? `/stall/${encodeURIComponent(item.stallId)}`
                      : null;
                return (
                  <article className={styles.card} key={`${item.dishId ?? item.stallId}-${index}`}>
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.name ?? "Dish photo"}
                        loading="lazy"
                        style={{
                          width: "100%",
                          borderRadius: 12,
                          objectFit: "cover",
                          aspectRatio: "4 / 3",
                        }}
                      />
                    ) : null}
                    <h3>
                      {isRanking ? `#${index + 1} ` : null}
                      {href ? <a href={href}>{item.name ?? "Untitled"}</a> : item.name}
                    </h3>
                    {item.itemType === "dish" ? (
                      <p>
                        {[item.stallName, item.price !== null ? formatPrice(item.price) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                    {isRanking && item.score !== null ? <p>Score: {item.score}/10</p> : null}
                    {item.publicNotes ? <p>{item.publicNotes}</p> : null}
                    {item.mapsUrl ? (
                      <a
                        className={styles.inlineLink}
                        href={item.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Get directions
                      </a>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </SharePreview>
  );
}
