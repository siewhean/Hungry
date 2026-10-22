import { notFound } from "next/navigation";

import { SharePreview, sharePreviewMetadata } from "@/components/share/SharePreview";
import { formatUpdated, getSharedReview, readShareSource } from "@/lib/share/sharedLinks";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ src?: string | string[] }>;
};

const LEAD_MAX_LENGTH = 280;

function summarise(text: string) {
  return text.length > LEAD_MAX_LENGTH ? `${text.slice(0, LEAD_MAX_LENGTH - 1).trimEnd()}…` : text;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const review = await getSharedReview(id);
  if (!review)
    return sharePreviewMetadata(
      "Review not found",
      "This review is no longer on Hungry.",
      `/review/${id}`,
    );
  const dishName = review.dish?.name ?? "a dish";
  const where = review.stall ? ` at ${review.stall.name}` : "";
  return sharePreviewMetadata(
    `${review.authorName} reviewed ${dishName}${where}`,
    review.text
      ? summarise(review.text)
      : `${review.rating} out of 5 stars for ${dishName}${where}. Read it on Hungry.`,
    `/review/${review.id}`,
    review.dish?.imageUrl,
  );
}

// Reviews are read in the app; this page covers people without it, and shows the text so
// the link previews well in chats.
export default async function SharedReviewPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const shareSource = readShareSource((await searchParams).src);
  const review = await getSharedReview(id);
  if (!review) notFound();

  const posted = formatUpdated(review.createdAt);
  const facts = [
    { label: "Rating", value: `${review.rating} out of 5` },
    ...(review.dish ? [{ label: "Dish", value: review.dish.name }] : []),
    ...(review.stall ? [{ label: "Stall", value: review.stall.name }] : []),
    ...(posted ? [{ label: "Posted", value: posted }] : []),
  ];

  return (
    <SharePreview
      eyebrow="Review on Hungry"
      title={`${review.authorName} reviewed ${review.dish?.name ?? "a dish"}`}
      lead={review.text ? summarise(review.text) : null}
      facts={facts}
      imageUrl={review.dish?.imageUrl}
      appPath={`review/${encodeURIComponent(review.id)}`}
      shareSource={shareSource}
      mapsUrl={review.stall?.mapsUrl}
    />
  );
}
