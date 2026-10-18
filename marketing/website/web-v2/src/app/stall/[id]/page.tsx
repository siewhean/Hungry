import { notFound } from "next/navigation";

import styles from "@/components/seo/SeoPage.module.css";
import { SharePreview, sharePreviewMetadata } from "@/components/share/SharePreview";
import { formatPrice, getSharedStall, readShareSource } from "@/lib/share/sharedLinks";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ src?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const stall = await getSharedStall(id);
  if (!stall)
    return sharePreviewMetadata(
      "Stall not found",
      "This stall is no longer on Hungry.",
      `/stall/${id}`,
    );
  return sharePreviewMetadata(
    stall.name,
    `What to order at ${stall.name}. See the menu and prices on Hungry.`,
    `/stall/${stall.id}`,
  );
}

export default async function SharedStallPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const shareSource = readShareSource((await searchParams).src);
  const stall = await getSharedStall(id);
  if (!stall) notFound();

  const facts = [
    ...(stall.unitNumber
      ? [{ label: "Unit", value: [stall.unitNumber, stall.floor].filter(Boolean).join(" · ") }]
      : []),
    ...(stall.operatingHours ? [{ label: "Hours", value: stall.operatingHours }] : []),
  ];

  return (
    <SharePreview
      eyebrow="Stall on Hungry"
      title={stall.name}
      facts={facts}
      appPath={`venue/${encodeURIComponent(stall.id)}`}
      shareSource={shareSource}
      mapsUrl={stall.mapsUrl}
    >
      {stall.dishes.length ? (
        <section className={styles.section} aria-labelledby="menu-title">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <span className={styles.eyebrow}>Menu</span>
              <h2 id="menu-title">Popular dishes</h2>
            </div>
            <div className={styles.grid}>
              {stall.dishes.map((dish) => (
                <article className={styles.card} key={dish.id}>
                  <h3>
                    <a href={`/dish/${encodeURIComponent(dish.id)}`}>{dish.name}</a>
                  </h3>
                  <p>{formatPrice(dish.price)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </SharePreview>
  );
}
