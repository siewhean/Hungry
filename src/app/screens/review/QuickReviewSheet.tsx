import { AppText } from "@/components/ui";
interface QuickReviewSheetProps {
  venueId: string;
  venueName: string;
  dishId?: string;
  dishName?: string;
  onSuccess: (data: { rating: number; tagCount: number }) => void;
}
/** Legacy modal entry point: publication requires the complete validated review flow. */
export function QuickReviewSheet(_props: QuickReviewSheetProps) {
  return (
    <AppText>
      To write a review, open Reviews and choose Write a review. Select the exact dish before
      posting.
    </AppText>
  );
}
