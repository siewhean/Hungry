import { notFound } from "next/navigation";
import { PlaceContent } from "@/components/seo/PlaceContent";
import { getPlace, seoPlaces } from "@/lib/seo/content";
import { routeMetadata } from "@/app/seo";

type PageProps = {
  params: Promise<{ centreSlug: string }>;
};

export function generateStaticParams() {
  return seoPlaces
    .filter((place) => place.type === "hawker_centre")
    .map((place) => ({ centreSlug: place.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { centreSlug } = await params;
  return routeMetadata(`/hawker-centres/${centreSlug}`);
}

export default async function HawkerCentrePage({ params }: PageProps) {
  const { centreSlug } = await params;
  const place = getPlace(centreSlug);

  if (!place || place.type !== "hawker_centre") {
    notFound();
  }

  return <PlaceContent place={place} path={`/hawker-centres/${place.slug}`} />;
}
