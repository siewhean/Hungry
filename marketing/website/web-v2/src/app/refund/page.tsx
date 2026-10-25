import { routeMetadata } from "@/app/seo";
import { PolicyPage } from "@/components/legal/PolicyPage";

export const revalidate = 3600;
export const metadata = routeMetadata("/refund");

const sections = [
  {
    title: "Website And Waitlist",
    body: "Joining a Hungry waitlist does not authorize a charge, subscription, automatic renewal, or paid merchant plan. No payment card is requested by these public forms.",
  },
  {
    title: "Food And Delivery Purchases",
    body: "If you order directly from a merchant or through a linked delivery platform, the seller or platform takes your payment and handles cancellations, refunds, delivery problems, and any applicable terms. Check the seller, total price including mandatory charges, cancellation conditions, and refund route before paying. Hungry cannot promise a refund of a payment taken by another provider.",
  },
  {
    title: "A Charge You Believe Came From Hungry",
    body: "Email usehungrysingapore@gmail.com with a description, date, amount, and a redacted transaction reference so the team can investigate. Do not send a full card number, security code, password, or identity document. This is an investigation request, not a guarantee of eligibility or timing.",
  },
  {
    title: "Future Paid Features And Consumer Rights",
    body: "Any paid Hungry feature needs its own clear price, mandatory charges, renewal and cancellation terms, and refund conditions before purchase. This page does not create a paid offer or limit rights you may have under applicable law.",
  },
];

export default function Page() {
  return (
    <PolicyPage
      title="Refund Policy"
      intro="Hungry’s public website and waitlist do not take payments or sell food. This policy explains where to send a refund question."
      sections={sections}
    />
  );
}
