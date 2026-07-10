export const MERCHANT_CSRF_COOKIE = "hungry_merchant_csrf_token";
export const MERCHANT_CSRF_HEADER = "x-hungry-csrf-token";

export function readMerchantCsrfToken() {
  if (typeof document === "undefined") return "";

  return (
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${MERCHANT_CSRF_COOKIE}=`))
      ?.slice(MERCHANT_CSRF_COOKIE.length + 1) ?? ""
  );
}

export function merchantMutationFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const csrfToken = readMerchantCsrfToken();

  if (csrfToken) {
    headers.set(MERCHANT_CSRF_HEADER, decodeURIComponent(csrfToken));
  }

  return fetch(input, {
    ...init,
    credentials: "same-origin",
    headers,
  });
}
