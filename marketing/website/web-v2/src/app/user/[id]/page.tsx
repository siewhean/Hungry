import { notFound } from "next/navigation";

import { SharePreview, sharePreviewMetadata } from "@/components/share/SharePreview";
import { getSharedProfile, readShareSource } from "@/lib/share/sharedLinks";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ src?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const profile = await getSharedProfile(id);
  if (!profile) {
    return sharePreviewMetadata(
      "Profile not found",
      "This profile is private or no longer on Hungry.",
      `/user/${id}`,
    );
  }
  return sharePreviewMetadata(
    profile.displayName,
    profile.bio ?? `See what ${profile.displayName} eats and recommends on Hungry.`,
    `/user/${profile.id}`,
    profile.avatarUrl,
  );
}

export default async function SharedProfilePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const shareSource = readShareSource((await searchParams).src);
  const profile = await getSharedProfile(id);
  if (!profile) notFound();

  const facts = [
    { label: "Dishes reviewed", value: String(profile.dishesReviewed) },
    { label: "Stalls visited", value: String(profile.stallsVisited) },
  ];

  return (
    <SharePreview
      eyebrow="Foodie on Hungry"
      title={profile.displayName}
      lead={profile.bio}
      facts={facts}
      appPath={`user/${encodeURIComponent(profile.id)}`}
      shareSource={shareSource}
    />
  );
}
