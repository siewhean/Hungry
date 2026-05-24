import JoinWaitlistForm from "./JoinWaitlistForm";
import { routeMetadata } from "@/app/seo";

export const metadata = routeMetadata("/join-waitlist");

type Audience = "foodie" | "merchant";

type JoinWaitlistPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function JoinWaitlistPage({
  searchParams,
}: JoinWaitlistPageProps) {
  const params = await searchParams;
  const initialAudience =
    params?.audience === "merchant" ? "merchant" : "foodie";

  return <JoinWaitlistForm initialAudience={initialAudience as Audience} />;
}
