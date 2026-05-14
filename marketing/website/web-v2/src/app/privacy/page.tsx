export const metadata = {
  title: "Privacy Policy | Hungry",
  description: "Privacy Policy for the Hungry app.",
};

export default function PrivacyPolicy() {
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
          Privacy Policy
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
            At Hungry, we take your privacy seriously. This is a stub page for the full privacy
            policy, which will be updated before the official launch.
          </p>

          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginTop: "var(--space-4)",
            }}
          >
            1. Information We Collect
          </h2>
          <p>
            When you join our waitlist, we collect your email address. This is used solely to notify
            you about our launch and early access opportunities.
          </p>

          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginTop: "var(--space-4)",
            }}
          >
            2. How We Use Your Information
          </h2>
          <p>Your information is used to:</p>
          <ul style={{ paddingLeft: "var(--space-6)", listStyleType: "disc" }}>
            <li>Send you updates about Hungry&apos;s launch.</li>
            <li>Provide you with early access to the platform.</li>
            <li>Respond to your inquiries.</li>
          </ul>

          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginTop: "var(--space-4)",
            }}
          >
            3. Contact Us
          </h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at
            hello@hungry.sg.
          </p>
        </div>
      </div>
    </main>
  );
}
