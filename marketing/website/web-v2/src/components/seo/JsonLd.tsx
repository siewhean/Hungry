import { headers } from "next/headers";

import { CSP_NONCE_HEADER } from "@/lib/security/contentSecurityPolicy";

type JsonLdValue = Record<string, unknown> | readonly unknown[];

type JsonLdProps = {
  data: JsonLdValue;
};

export async function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const nonce = (await headers()).get(CSP_NONCE_HEADER) ?? undefined;

  return (
    <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: json }} />
  );
}
