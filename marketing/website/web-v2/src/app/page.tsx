import Hero from "@/components/sections/Hero";
import SplitSection from "@/components/sections/SplitSection";
import ProblemStack from "@/components/sections/ProblemStack";
import StickyShowcase from "@/components/sections/StickyShowcase";
import FoodCarousel from "@/components/sections/FoodCarousel";
import MerchantStory from "@/components/sections/MerchantStory";
import CommunityLayer from "@/components/sections/CommunityLayer";
import FinalCTA from "@/components/sections/FinalCTA";

export const metadata = {
  title: "Hungry | Decide what to eat next in Singapore",
  description:
    "The food discovery app for Singapore. Find the best hawker food, cafes, and restaurants based on real community recommendations.",
};

export default function Home() {
  return (
    <main>
      <Hero />
      <SplitSection />
      <ProblemStack />
      <StickyShowcase />
      <FoodCarousel />
      <MerchantStory />
      <CommunityLayer />
      <FinalCTA />
    </main>
  );
}
