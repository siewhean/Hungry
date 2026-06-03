import { notFound } from "next/navigation";
import ConsoleScaffoldPage from "../../ConsoleScaffoldPage";
import { productAnalyticsScaffoldPages } from "../../consoleScaffoldCopy";

type ProductAnalyticsSectionPageProps = {
  params: Promise<{ section: string }>;
};

export default async function ProductAnalyticsSectionPage({ params }: ProductAnalyticsSectionPageProps) {
  const { section } = await params;
  const copy = productAnalyticsScaffoldPages[section];

  if (!copy) notFound();

  return <ConsoleScaffoldPage copy={copy} basePath="/console/product-analytics" />;
}
