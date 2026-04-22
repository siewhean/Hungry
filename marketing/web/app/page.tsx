import type { Metadata } from "next";
import { Navbar } from "../components/Navbar";
import { Hero } from "../components/Hero";
import { ProblemSection } from "../components/ProblemSection";
import { FeaturesSection } from "../components/FeaturesSection";
import { HowItWorks } from "../components/HowItWorks";
import { LocalSection } from "../components/LocalSection";
import { PreviewSection } from "../components/PreviewSection";
import { HawkerSection } from "../components/HawkerSection";
import { FaqSection } from "../components/FaqSection";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: "Hungry — Find the dish. Not just the restaurant.",
};

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorks />
      <LocalSection />
      <PreviewSection />
      <HawkerSection />
      <FaqSection />
      <Footer />
    </main>
  );
}
