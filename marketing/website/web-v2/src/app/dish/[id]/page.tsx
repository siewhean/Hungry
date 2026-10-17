import { notFound } from "next/navigation";

import styles from "@/components/seo/SeoPage.module.css";
import { SharePreview, sharePreviewMetadata } from "@/components/share/SharePreview";
import { formatPrice, formatUpdated, getSharedDish } from "@/lib/share/sharedLinks";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const dish = await getSharedDish(id);
  if (!dish)
    return sharePreviewMetadata(
      "Dish not found",
      "This dish is no longer on Hungry.",
      `/dish/${id}`,
    );
  const where = dish.stall ? ` at ${dish.stall.name}` : "";
  return sharePreviewMetadata(
    `${dish.name}${where}`,
    `${dish.name}${where}, ${formatPrice(dish.price)}. See it on Hungry.`,
    `/dish/${dish.id}`,
  );
}

export default async function SharedDishPage({ params }: PageProps) {
  const { id } = await params;
  const dish = await getSharedDish(id);
  if (!dish) notFound();

  const updated = formatUpdated(dish.updatedAt);
  const facts = [
    { label: "Price", value: formatPrice(dish.price) },
    ...(dish.stall ? [{ label: "Stall", value: dish.stall.name }] : []),
    ...(dish.stall?.unitNumber
      ? [
          {
            label: "Unit",
            value: [dish.stall.unitNumber, dish.stall.floor].filter(Boolean).join(" · "),
          },
        ]
      : []),
    ...(updated ? [{ label: "Last updated", value: updated }] : []),
  ];

  return (
    <SharePreview
      eyebrow="Dish on Hungry"
      title={dish.name}
      lead={dish.description}
      facts={facts}
      imageUrl={dish.imageUrl}
      appPath={`dish/${encodeURIComponent(dish.id)}`}
    >
      {dish.stall ? (
        <section className={styles.section}>
          <div className={styles.sectionInner}>
            <a className={styles.inlineLink} href={`/stall/${encodeURIComponent(dish.stall.id)}`}>
              More from {dish.stall.name}
            </a>
          </div>
        </section>
      ) : null}
    </SharePreview>
  );
}
