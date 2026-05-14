import { EmailForm } from "@/components/ui/EmailForm";

export const metadata = {
  title: "Hungry for Foodies | Join the Waitlist",
  description: "The food discovery app for Singapore. Join the waitlist for early access.",
};

export default function ForFoodies() {
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
          Discover what to eat next.
        </h1>
        <p
          style={{
            fontSize: "1.25rem",
            color: "var(--color-text-secondary)",
            marginBottom: "var(--space-12)",
            lineHeight: 1.6,
          }}
        >
          Hungry is a premium food discovery app built for the way Singapore eats. Join the foodie
          waitlist to get early access when we launch.
        </p>

        <div
          style={{
            padding: "var(--space-8)",
            backgroundColor: "var(--color-white)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-md)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "var(--space-2)",
              color: "var(--color-text-primary)",
            }}
          >
            Join the Foodie Waitlist
          </h2>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-6)" }}>
            Be the first to know when Hungry drops.
          </p>
          <EmailForm buttonText="Get Early Access" />
        </div>
      </div>
    </main>
  );
}
