import ConsoleRoutePage from "../ConsoleRoutePage";

type ConsoleSectionPageProps = {
  params: Promise<{ section: string }>;
};

export default async function ConsoleSectionPage({ params }: ConsoleSectionPageProps) {
  const { section } = await params;
  return <ConsoleRoutePage section={section} />;
}
