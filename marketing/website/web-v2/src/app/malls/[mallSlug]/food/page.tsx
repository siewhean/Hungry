import { notFound } from "next/navigation";
import { PlaceContent } from "@/components/seo/PlaceContent";
import { getPlace, seoPlaces } from "@/lib/seo/content";
import { routeMetadata } from "@/app/seo";

type PageProps = {
  params: Promise<{ mallSlug: string }>;
};

export function generateStaticParams() {
  return seoPlaces
    .filter((place) => place.type === "mall_food_court")
    .map((place) => ({ mallSlug: place.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { mallSlug } = await params;
  return routeMetadata(`/malls/${mallSlug}/food`);
}

export default async function MallFoodPage({ params }: PageProps) {
  const { mallSlug } = await params;
  const place = getPlace(mallSlug);

  if (!place || place.type !== "mall_food_court") {
    notFound();
  }

  return <PlaceContent place={place} path={`/malls/${place.slug}/food`} />;
}
