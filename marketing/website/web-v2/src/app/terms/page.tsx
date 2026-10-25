import { routeMetadata } from "@/app/seo";
import { PolicyPage } from "@/components/legal/PolicyPage";

export const revalidate = 3600;
export const metadata = routeMetadata("/terms");

const sections = [
  {
    title: "1. Using Hungry",
    body: "Hungry supports dish-first food discovery in Singapore. Current account creation and personal-data submissions are for adults aged 18 or over. Do not create an account or submit personal details for a child. Provide accurate information, keep your credentials secure, and use the service lawfully.",
  },
  {
    title: "2. User-Generated Content",
    body: "Submit only content you are entitled to share. Reviews should reflect actual experience; fabricated reviews, undisclosed paid endorsements, fake engagement, impersonation, spam, deceptive content, and infringement are prohibited. Illustrative product previews and sample reviews are not endorsements or evidence of real user activity. You remain responsible for your submissions. Hungry may restrict or remove content for safety, moderation, or legal reasons.",
  },
  {
    title: "3. Reporting, Blocking, And Moderation",
    body: "Use available report, hide, and block controls for abuse or misleading content, or contact support. Blocking may not remove previously processed safety or legal records. Moderation and merchant verification do not guarantee the truth or safety of every listing.",
  },
  {
    title: "4. Merchant And Menu Information",
    body: "Merchants must have rights to their photos, text, logos, and other uploads and must keep submitted information accurate. Prices, menus, opening hours, dietary labels, and availability can change. Check important details with the business before travelling or purchasing. A listing, rating, or verification label is not a guarantee of allergen safety, halal certification, quality, or availability.",
  },
  {
    title: "5. AI, OCR, And Recommendations",
    body: "AI and OCR output and recommendation scores are assistance, may be inaccurate, and require review. They are not verified dietary, allergen, medical, or safety advice. Do not rely on them as a substitute for checking with the merchant.",
  },
  {
    title: "6. Prices, Fees, And Refunds",
    body: "The public website and waitlist do not collect payment. Displayed dish prices are informational and may differ at the point of purchase; check taxes, service charges, delivery fees, and the final total with the seller. Purchases through linked delivery platforms are contracted and paid through the relevant provider. See the Refund Policy for who handles a request. These terms do not waive applicable consumer rights.",
  },
  {
    title: "7. Account Deletion",
    body: "Request deletion in app Settings or use the instructions at /account/delete. The request has a 30-day grace period. Signing in alone does not cancel deletion; use Keep my account and wait for confirmation. Processing and limited retention exceptions are explained in the Privacy Policy. You can also request access, correction, or withdrawal of consent by contacting support.",
  },
  {
    title: "8. Intellectual Property",
    body: "Hungry branding and product materials may not be reused without permission or another applicable right. Third-party assets remain subject to their own licences. Uploading content does not transfer its ownership to Hungry; you permit the storage, processing, and display necessary to provide the feature you request. Do not submit content for which you lack the necessary rights.",
  },
  {
    title: "9. Changes And Contact",
    body: "Hungry may update these terms as features change; the update date identifies this version. For support, privacy, complaints, or deletion requests, contact usehungrysingapore@gmail.com. See Business details for published product and contact information. No registered legal entity, business address, or Data Protection Officer appointment is verified by these terms.",
  },
];

export default function Page() {
  return (
    <PolicyPage
      title="Terms of Service"
      intro="These terms cover the Hungry website, app, and merchant tools. Read the Privacy Policy, Cookie Policy, and Refund Policy for the related practices."
      sections={sections}
    />
  );
}
