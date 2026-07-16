export const CSP_NONCE_HEADER = "x-nonce";

const NONCE_PATTERN = /^[A-Za-z0-9+/_=-]+$/;

export function createCspNonce() {
  return btoa(crypto.randomUUID());
}

export function createContentSecurityPolicy(
  nonce: string,
  options: { development?: boolean } = {},
) {
  if (!NONCE_PATTERN.test(nonce)) {
    throw new Error("Content Security Policy nonce contains invalid characters.");
  }

  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(options.development ? ["'unsafe-eval'"] : []),
  ];

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https://images.unsplash.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "script-src-attr 'none'",
    `style-src 'self' 'nonce-${nonce}'`,
    `style-src-elem 'self' 'nonce-${nonce}'`,
    // React style props render as style attributes. Keep that explicitly scoped
    // exception separate from style elements so injected <style> blocks remain blocked.
    "style-src-attr 'unsafe-inline'",
    ...(!options.development ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}
