import { routeMetadata } from "@/app/seo";
import { PolicyPage } from "@/components/legal/PolicyPage";

export const metadata = routeMetadata("/credits");

const sections = [
  {
    title: "Hawker Centre Diners",
    body: (
      <>
        “Customers at a centre for food-sellers, or hawkers.jpg” by Rogbeer.{" "}
        <a href="https://commons.wikimedia.org/wiki/File:Customers_at_a_centre_for_food-sellers,_or_hawkers.jpg">
          Source
        </a>{" "}
        · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Displayed
        responsively and may be cropped to fit.
      </>
    ),
  },
  {
    title: "Restaurant Diners",
    body: (
      <>
        “Singapore Chinese-New-Year-2015-Yusheng-Restaurant-01.jpg” by CEphoto, Uwe Aranas.{" "}
        <a href="https://commons.wikimedia.org/wiki/File:Singapore_Chinese-New-Year-2015-Yusheng-Restaurant-01.jpg">
          Source
        </a>{" "}
        · <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>. Displayed
        responsively and may be cropped to fit.
      </>
    ),
  },
  {
    title: "Tampines Round Market Food Centre",
    body: (
      <>
        “Hawker Center, Singapore.jpg” by Kagenlim.{" "}
        <a href="https://commons.wikimedia.org/wiki/File:Hawker_Center,_Singapore.jpg">Source</a> ·{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Displayed
        responsively and may be cropped to fit.
      </>
    ),
  },
  {
    title: "Fonts",
    body: (
      <>
        The bundled Nunito, DM Mono, and Fraunces font packages carry SIL Open Font License notices.
        Read the <a href="/licenses/fonts/Nunito-OFL.txt">Nunito notice</a>,{" "}
        <a href="/licenses/fonts/DMMono-OFL.txt">DM Mono notice</a>, and{" "}
        <a href="/licenses/fonts/Fraunces-OFL.txt">Fraunces notice</a>. Each notice preserves the
        applicable copyright and licence terms.
      </>
    ),
  },
  {
    title: "Product Previews And Other Materials",
    body: "Product screens and illustrative food visuals are previews, not testimonials, verified customer activity, or evidence that a specific stall serves the pictured dish. Third-party names and trademarks belong to their respective owners. Listing a brand does not imply endorsement or grant permission to reuse its assets. Contact support with an attribution or rights concern.",
  },
];

export default function CreditsPage() {
  return (
    <PolicyPage
      title="Asset Credits"
      intro="Attribution and licence notices for the identified photography and bundled fonts."
      sections={sections}
    />
  );
}
