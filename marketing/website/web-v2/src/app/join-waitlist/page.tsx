import JoinWaitlistForm from "./JoinWaitlistForm";
import { routeMetadata } from "@/app/seo";

export const dynamic = "force-dynamic";
export const metadata = routeMetadata("/join-waitlist");

type Audience = "foodie" | "merchant";
type JoinWaitlistSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function JoinWaitlistPage({
  searchParams,
}: {
  searchParams?: JoinWaitlistSearchParams;
}) {
  const params = await searchParams;
  const initialAudience =
    params?.audience === "merchant" ? "merchant" : "foodie";

  return <JoinWaitlistForm initialAudience={initialAudience as Audience} />;
}
