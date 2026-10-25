import { View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppText, Badge, Button, Card, EmptyState } from "@/components/ui";
import { STALL_SUBMISSION_STATUS } from "@/features/profile/stallSubmissionStatus";
import { useRetryableLoad } from "@/features/profile/useRetryableLoad";
import { useStallSubmissionStore } from "@/store/useStallSubmissionStore";
import { useHungryTheme } from "@/theme";
import { ProfileReviewsSkeleton } from "./ProfileGridSkeleton";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "StallSubmissions">;

function formatSubmittedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

/** The stalls you submitted and what happened to each. */
export function StallSubmissionsScreen({ navigation }: Props) {
  const { spacing } = useHungryTheme();
  const submissions = useStallSubmissionStore((state) => state.submissions);
  const isLoaded = useStallSubmissionStore((state) => state.isLoaded);
  const loadSubmissions = useStallSubmissionStore((state) => state.loadSubmissions);
  const { failed: loadFailed, retry } = useRetryableLoad(loadSubmissions, "stall submissions");

  return (
    <ProfileScreenShell title="My submissions" subtitle="Stalls you've added, and what happened.">
      <View style={{ gap: spacing[3], paddingBottom: spacing[5] }}>
        {submissions.length ? (
          <>
            <Button
              label="Add a stall"
              variant="secondary"
              onPress={() => navigation.navigate("AddStall")}
            />
            {submissions.map((submission) => {
              const status = STALL_SUBMISSION_STATUS[submission.status];
              const submitted = formatSubmittedDate(submission.createdAt);
              return (
                <Card
                  key={submission.id}
                  accessible
                  accessibilityLabel={[
                    submission.stallName,
                    status.label,
                    status.detail,
                    submitted ? `Submitted ${submitted}` : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  style={{ gap: spacing[2], padding: spacing[4] }}
                >
                  <AppText variant="bodyBold">{submission.stallName}</AppText>
                  <Badge label={status.label} tone={status.tone} />
                  <AppText variant="bodySmall" tone="secondary">
                    {status.detail}
                  </AppText>
                  {submitted ? (
                    <AppText variant="micro" tone="muted">
                      {`Submitted ${submitted}`}
                    </AppText>
                  ) : null}
                </Card>
              );
            })}
          </>
        ) : !isLoaded && !loadFailed ? (
          <ProfileReviewsSkeleton />
        ) : loadFailed ? (
          <EmptyState
            title="Couldn't load your submissions"
            body="Check your connection and try again."
            ctaLabel="Retry"
            onPress={retry}
          />
        ) : (
          <EmptyState
            title="No submissions yet"
            body="Add a stall you found and it will show up here with its status."
            ctaLabel="Add a stall"
            onPress={() => navigation.navigate("AddStall")}
          />
        )}
      </View>
    </ProfileScreenShell>
  );
}
