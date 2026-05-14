import { EmailForm } from "@/components/ui/EmailForm";

export const metadata = {
  title: "Hungry for Merchants | Register Interest",
  description: "Reach more hungry customers in Singapore. Register your food business with Hungry.",
};

export default function ForMerchants() {
  return (
    <main
      className="container"
      style={{
        paddingTop: "calc(var(--header-height) + var(--space-16))",
        paddingBottom: "var(--space-24)",
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "3rem",
            fontWeight: 800,
            marginBottom: "var(--space-6)",
            color: "var(--color-text-primary)",
          }}
        >
          Get discovered by local foodies.
        </h1>
        <p
          style={{
            fontSize: "1.25rem",
            color: "var(--color-text-secondary)",
            marginBottom: "var(--space-12)",
            lineHeight: 1.6,
          }}
        >
          Whether you run a hawker stall, café, restaurant, or home-based business, Hungry helps you
          reach people looking for what to eat right now.
        </p>

        <div
          style={{
            padding: "var(--space-8)",
            backgroundColor: "var(--color-text-primary)",
            color: "var(--color-white)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-xl)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "var(--space-2)",
              color: "var(--color-white)",
            }}
          >
            Register Your Interest
          </h2>
          <p
            style={{
              color: "color-mix(in srgb, var(--color-white) 68%, transparent)",
              marginBottom: "var(--space-6)",
            }}
          >
            Leave your email and we&apos;ll reach out when merchant onboarding begins.
          </p>
          <div
            className="merchant-form-wrapper"
            style={
              {
                "--form-bg": "var(--color-white)",
                "--form-text": "var(--color-text-primary)",
              } as React.CSSProperties
            }
          >
            <EmailForm buttonText="Register Business" />
          </div>
        </div>
      </div>
    </main>
  );
}
