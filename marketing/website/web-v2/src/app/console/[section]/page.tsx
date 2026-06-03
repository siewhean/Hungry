import { notFound } from "next/navigation";
import ConsoleScaffoldPage from "../ConsoleScaffoldPage";
import { consoleScaffoldPages } from "../consoleScaffoldCopy";

type ConsoleSectionPageProps = {
  params: Promise<{ section: string }>;
};

export default async function ConsoleSectionPage({ params }: ConsoleSectionPageProps) {
  const { section } = await params;
  const copy = consoleScaffoldPages[section];

  if (!copy) notFound();

  return <ConsoleScaffoldPage copy={copy} basePath="/console" />;
}
