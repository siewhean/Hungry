import { routeMetadata } from "@/app/seo";

export const revalidate = 3600;
export const metadata = routeMetadata("/account/delete");

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
      <article style={{ maxWidth: "820px", margin: "0 auto" }}>
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
          account. If you cannot access the app, email hello@hungry.sg from the address linked to
          your Hungry account.
        </p>
        <section style={{ color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
          <h2 style={{ color: "var(--color-text-primary)", fontSize: "1.5rem" }}>
            What happens after a request
          </h2>
          <p>
            Hungry queues the request, signs the account out, and processes deletion or
            anonymization of account-associated personal data. Some safety, fraud-prevention,
            moderation, legal, or audit records may be retained in minimized or anonymized form.
          </p>
          <h2 style={{ color: "var(--color-text-primary)", fontSize: "1.5rem" }}>
            Expected timeline
          </h2>
          <p>
            We aim to process verified deletion requests within 30 days unless a legal, safety, or
            abuse-prevention exception applies.
          </p>
          <h2 style={{ color: "var(--color-text-primary)", fontSize: "1.5rem" }}>Contact</h2>
          <p>
            Email hello@hungry.sg with the subject &quot;Account deletion&quot; for status updates, access
            questions, or correction requests.
          </p>
        </section>
      </article>
    </main>
  );
}
