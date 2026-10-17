import { routeMetadata } from "@/app/seo";

export const revalidate = 3600;
export const metadata = routeMetadata("/account/delete");

const sections = [
  {
    title: "What happens after a request",
    body: "Hungry queues the request, signs the account out, and processes deletion or anonymization of account-associated personal data. Some safety, fraud-prevention, moderation, legal, or audit records may be retained in minimized or anonymized form.",
  },
  {
    title: "Expected timeline",
    body: "We aim to process verified deletion requests within 30 days unless a legal, safety, or abuse-prevention exception applies.",
  },
  {
    title: "Contact",
    body: "Email tryhungrysingapore@gmail.com with the subject \"Account deletion\" for status updates, access questions, or correction requests.",
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
          account. If you cannot access the app, email tryhungrysingapore@gmail.com from the address linked to
          your Hungry account.
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
