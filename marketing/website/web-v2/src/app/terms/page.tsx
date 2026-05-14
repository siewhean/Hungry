export const metadata = {
  title: "Terms of Service | Hungry",
  description: "Terms of Service for the Hungry app.",
};

export default function TermsOfService() {
  return (
    <main
      className="container"
      style={{
        paddingTop: "calc(var(--header-height) + var(--space-16))",
        paddingBottom: "var(--space-24)",
        minHeight: "80vh",
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "3rem",
            fontWeight: 800,
            marginBottom: "var(--space-8)",
            color: "var(--color-text-primary)",
          }}
        >
          Terms of Service
        </h1>

        <div
          style={{
            color: "var(--color-text-secondary)",
            lineHeight: 1.8,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          <p>
            <em>Last updated: May 2026</em>
          </p>

          <p>
            Welcome to Hungry. This is a stub page for the full terms of service, which will be
            updated before the official launch.
          </p>

          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginTop: "var(--space-4)",
            }}
          >
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using Hungry, you agree to be bound by these Terms of Service. If you do
            not agree to these terms, please do not use our services.
          </p>

          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginTop: "var(--space-4)",
            }}
          >
            2. Use of Service
          </h2>
          <p>
            Hungry provides a platform for discovering food in Singapore. You agree to use the
            service only for lawful purposes and in accordance with these Terms.
          </p>

          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginTop: "var(--space-4)",
            }}
          >
            3. Waitlist Terms
          </h2>
          <p>
            Joining our waitlist does not guarantee access to the platform. We reserve the right to
            admit users at our discretion.
          </p>

          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginTop: "var(--space-4)",
            }}
          >
            4. Contact Us
          </h2>
          <p>If you have any questions about these Terms, please contact us at hello@hungry.sg.</p>
        </div>
      </div>
    </main>
  );
}
