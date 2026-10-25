import { routeMetadata } from "@/app/seo";
import { PolicyPage } from "@/components/legal/PolicyPage";

export const revalidate = 3600;
export const metadata = routeMetadata("/business");

const sections = [
  {
    title: "Product And Market",
    body: "Hungry is the product name for a dish-first food discovery app and website serving Singapore. The product name alone is not confirmation of a registered company name or registration number.",
  },
  {
    title: "Support And Privacy Requests",
    body: "Email usehungrysingapore@gmail.com for support, privacy, account and waitlist data requests, complaints, or merchant questions. Use the Account deletion instructions if you want to request removal of an account or other submitted personal data. Do not send passwords, authentication codes, or unrelated sensitive documents.",
  },
  {
    title: "Commercial Enquiries",
    body: "Before entering a commercial arrangement, ask the Hungry team for the contracting operator’s registered name, registration number, business address, and applicable paid-service terms. Those registered operator details and a named Data Protection Officer appointment have not been confirmed for publication here.",
  },
];

export default function Page() {
  return (
    <PolicyPage
      title="Business Details"
      intro="The following product and contact information is published for Hungry."
      sections={sections}
    />
  );
}
