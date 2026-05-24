import Hero from "@/components/sections/Hero";
import SplitSection from "@/components/sections/SplitSection";
import LocalGuide from "@/components/sections/LocalGuide";
import StickyShowcase from "@/components/sections/StickyShowcase";
import FoodCarousel from "@/components/sections/FoodCarousel";
import CommunityLayer from "@/components/sections/CommunityLayer";
import FinalCTA from "@/components/sections/FinalCTA";
import { routeMetadata } from "./seo";

export const metadata = routeMetadata("/");

export default function Home() {
  return (
    <main>
      <Hero />
      <SplitSection />
      <LocalGuide />
      <StickyShowcase />
      <FoodCarousel />
      <CommunityLayer />
      <FinalCTA />
    </main>
  );
}
