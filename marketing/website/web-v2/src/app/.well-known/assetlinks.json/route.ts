// Android App Links: lets usehungry.com share links open in the Hungry app.
// ANDROID_APP_SIGNING_SHA256 holds the app signing certificate fingerprint(s)
// from Google Play Console (comma-separated). Without it, links open the website.
const PACKAGE_NAME = "app.hungry.mobile";

export function GET() {
  const fingerprints = (process.env.ANDROID_APP_SIGNING_SHA256 ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return Response.json(
    fingerprints.length
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: PACKAGE_NAME,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : [],
  );
}
