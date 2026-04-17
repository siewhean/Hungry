import { getHungryService } from "@/lib/services/serviceProvider";
import type { Bite } from "@/lib/services/types";

export async function getHomeBitesFeed(lat?: number, lng?: number): Promise<Bite[]> {
  const bites = await getHungryService().social.getBitesFeed(lat, lng);
  return [...bites].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}
