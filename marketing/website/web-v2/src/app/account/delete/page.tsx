import { routeMetadata } from "@/app/seo";
import { PolicyPage } from "@/components/legal/PolicyPage";

export const revalidate = 3600;
export const metadata = routeMetadata("/account/delete");

const sections = [
  {
    title: "What Happens After An Account Request",
    body: "The app schedules deletion after a 30-day grace period and signs the account out. Signing back in does not cancel it. Before the deadline, choose Keep my account and wait for successful cancellation confirmation. The scheduled date is not confirmation of completed processing; contact support for a status update.",
  },
  {
    title: "What May Remain",
    body: "Account-associated personal data is removed or anonymized when the deletion worker processes the request. Menu photos may remain without your name. Limited security, fraud-prevention, moderation, legal, or audit records may be retained where needed. If retained media still identifies you, tell the team so it can be reviewed. Ask support about the data retained and the reason.",
  },
  {
    title: "Waitlist Or Other Data Without An Account",
    body: "Email usehungrysingapore@gmail.com with the subject Data deletion and identify the email address or submission concerned. An app login is not required to request removal of waitlist or other submitted personal data. The team may need proportionate verification. Do not send passwords, sign-in codes, a full payment card number, or identity documents.",
  },
  {
    title: "Withdrawal And Marketing",
    body: "For waitlist email withdrawal, use any unsubscribe facility in the message or email usehungrysingapore@gmail.com with the subject Unsubscribe. For optional website analytics, use Cookie preferences. Withdrawing marketing consent does not require deleting your account.",
  },
];

export default function Page() {
  return (
    <PolicyPage
      title="Delete your Hungry account or submitted data"
      intro="Signed-in users can request deletion in the Hungry app from Profile, Settings, Delete account. If you cannot access the app, email usehungrysingapore@gmail.com from your account address with the subject Account deletion."
      sections={sections}
    />
  );
}
