import { routeMetadata } from "@/app/seo";

export const revalidate = 3600;
export const metadata = routeMetadata("/account/delete");

const sections = [
  {
    title: "What happens after a request",
    body: "Hungry schedules deletion 30 days after the request and signs the account out. Signing back in does not cancel deletion. Before the deadline, choose Keep my account in the app and wait for successful cancellation confirmation. After that, account-associated personal data is deleted or anonymized. Menu photos you uploaded stay on the stall's page without your name. Some safety, fraud-prevention, moderation, legal, or audit records may be retained in minimized or anonymized form.",
  },
  {
    title: "Expected timeline",
    body: "Deletion runs once the 30-day grace period ends, unless a legal, safety, or abuse-prevention exception applies.",
  },
  {
    title: "Contact",
    body: 'Email usehungrysingapore@gmail.com with the subject "Account deletion" for status updates, access questions, or correction requests.',
  },
];

export default function AccountDeletionPage() {
  return (
    <main
      className="container"
      style={{
        paddingTop: "calc(var(--header-height) + var(--space-16))",
        paddingBottom: "var(--space-24)",
        minHeight: "80vh",
      }}
    >
      <article style={{ maxWidth: "860px", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "3rem",
            fontWeight: 800,
            marginBottom: "var(--space-4)",
            color: "var(--color-text-primary)",
          }}
        >
          Delete your Hungry account
        </h1>
        <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
          Signed-in users can request deletion in the Hungry app from Profile, Settings, Delete
          account. If you cannot access the app, email usehungrysingapore@gmail.com from the address
          linked to your Hungry account.
        </p>
        <section
          style={{
            color: "var(--color-text-secondary)",
            lineHeight: 1.8,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
            marginTop: "var(--space-8)",
          }}
        >
          {sections.map((section) => (
            <div key={section.title}>
              <h2
                style={{
                  color: "var(--color-text-primary)",
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  marginBottom: "var(--space-2)",
                }}
              >
                {section.title}
              </h2>
              <p>{section.body}</p>
            </div>
          ))}
        </section>
      </article>
    </main>
  );
}
