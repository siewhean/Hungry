import { Banner } from "./Banner";

interface InlineBannerProps {
  message: string;
  tone?: "info" | "warning" | "error" | "success";
}

/**
 * @deprecated Use `<Banner variant=... />`. Kept as a thin alias so auth screens
 * render the shared Banner until they migrate.
 */
export function InlineBanner({ message, tone = "info" }: InlineBannerProps) {
  return <Banner message={message} variant={tone} />;
}
