import { redirect } from "next/navigation";

// /home is the app's Home tab link (weekly picks push). Without the app installed,
// send visitors to the site's landing page instead of a 404.
export default function HomeRedirectPage() {
  redirect("/");
}
