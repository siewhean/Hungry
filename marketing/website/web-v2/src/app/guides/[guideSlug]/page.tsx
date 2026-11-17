import { notFound } from "next/navigation";
import { GuideContent } from "@/components/seo/GuideContent";
import { getGuide, guidePath, seoGuides } from "@/lib/seo/content";
import { routeMetadata } from "@/app/seo";

type PageProps = {
  params: Promise<{ guideSlug: string }>;
};

export function generateStaticParams() {
  return seoGuides
    .filter((guide) => guidePath(guide).startsWith("/guides/"))
    .map((guide) => ({ guideSlug: guide.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { guideSlug } = await params;
  return routeMetadata(`/guides/${guideSlug}`);
}

export default async function GuidePage({ params }: PageProps) {
  const { guideSlug } = await params;
  const guide = getGuide(guideSlug);

  if (!guide || guidePath(guide) !== `/guides/${guideSlug}`) {
    notFound();
  }

  return <GuideContent guide={guide} path={`/guides/${guide.slug}`} />;
}
