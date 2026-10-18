import { SharePreview, sharePreviewMetadata } from "@/components/share/SharePreview";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return sharePreviewMetadata(
    "A post on Hungry",
    "Open this post in the Hungry app.",
    `/post/${encodeURIComponent(id)}`,
  );
}

// Posts are shown in the app; this page only covers people without it.
export default async function SharedPostPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <SharePreview
      eyebrow="Post on Hungry"
      title="Someone shared a post with you"
      lead="Open it in the Hungry app to see the dish, photos and comments."
      appPath={`post/${encodeURIComponent(id)}`}
    />
  );
}
