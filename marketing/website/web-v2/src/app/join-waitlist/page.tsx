import JoinWaitlistForm from "./JoinWaitlistForm";
import { routeMetadata } from "@/app/seo";

export const metadata = routeMetadata("/join-waitlist");

type Audience = "foodie" | "merchant";

export default function JoinWaitlistPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const initialAudience =
    searchParams?.audience === "merchant" ? "merchant" : "foodie";

  return <JoinWaitlistForm initialAudience={initialAudience as Audience} />;
}

