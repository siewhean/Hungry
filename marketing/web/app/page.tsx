"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  MapPin,
  Star,
  Clock,
  Storefront,
  Quotes,
  Heart,
  MagnifyingGlass,
  CheckCircle,
} from "@phosphor-icons/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export default function Home() {
  const mainRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const showcaseRef = useRef<HTMLDivElement>(null);
  const showcaseStickyRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const [activeShowcaseStep, setActiveShowcaseStep] = useState(0);

  useGSAP(
    () => {
      // 1. Hero Animations
      gsap.fromTo(
        ".hero-element",
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1, stagger: 0.15, ease: "power3.out", delay: 0.2 },
      );

      gsap.to(".hero-parallax", {
        y: "15%",
        ease: "none",
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      // 2. Reveal on Scroll for standard sections
      const revealElements = gsap.utils.toArray(".reveal-on-scroll");
      revealElements.forEach((el: any) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "cubic-bezier(0.16, 1, 0.3, 1)",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
            },
          },
        );
      });

      // 3. Sticky Product Showcase
      if (showcaseRef.current && showcaseStickyRef.current) {
        const steps = gsap.utils.toArray(".showcase-step");

        ScrollTrigger.create({
          trigger: showcaseRef.current,
          start: "top top",
          end: "bottom bottom",
          pin: showcaseStickyRef.current,
          scrub: true,
        });

        steps.forEach((step: any, i) => {
          ScrollTrigger.create({
            trigger: step,
            start: "top center",
            end: "bottom center",
            onEnter: () => setActiveShowcaseStep(i),
            onEnterBack: () => setActiveShowcaseStep(i),
          });
        });
      }

      // 4. Horizontal Carousel
      if (carouselRef.current) {
        const container = carouselRef.current.querySelector(".carousel-container");
        if (container) {
          gsap.to(container, {
            x: () => -(container.scrollWidth - window.innerWidth + 48), // 48 is padding
            ease: "none",
            scrollTrigger: {
              trigger: carouselRef.current,
              start: "top top",
              end: "+=150%",
              pin: true,
              scrub: 1,
            },
          });
        }
      }
    },
    { scope: mainRef },
  );

  const showcaseImages = [
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800&auto=format&fit=crop", // Discovery
    "https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=800&auto=format&fit=crop", // Reviews
    "https://images.unsplash.com/photo-1626804475297-4160bdfa3449?q=80&w=800&auto=format&fit=crop", // Stall Info
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop", // Favourites
    "https://images.unsplash.com/photo-1582450871972-ab5ca641643d?q=80&w=800&auto=format&fit=crop", // Merchant
  ];

  return (
    <main
      ref={mainRef}
      className="w-full bg-hungry-bg text-hungry-text font-body selection:bg-hungry-orange selection:text-white"
    >
      {/* 1. Announcement Bar */}
      <div className="w-full bg-hungry-bg-soft text-hungry-text py-2 px-4 text-center text-sm font-medium border-b border-hungry-border">
        Hungry is coming soon in Singapore.{" "}
        <Link href="/join-waitlist" className="text-hungry-orange hover:underline font-bold ml-1">
          Join the waitlist for early access.
        </Link>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-hungry-bg/90 backdrop-blur-md border-b border-hungry-border py-4 px-6 md:px-12 flex justify-between items-center">
        <div className="font-display font-bold text-2xl tracking-tight text-hungry-text">
          Hungry
        </div>
        <div className="hidden md:flex gap-8 text-hungry-text-secondary font-medium text-sm">
          <Link href="/for-foodies" className="hover:text-hungry-orange transition-colors">
            Foodies
          </Link>
          <Link href="/for-merchants" className="hover:text-hungry-orange transition-colors">
            Merchants
          </Link>
          <Link href="/about" className="hover:text-hungry-orange transition-colors">
            About
          </Link>
          <Link href="/merchant-login" className="hover:text-hungry-orange transition-colors">
            Merchant Portal
          </Link>
        </div>
        <Link
          href="/join-waitlist"
          className="bg-hungry-orange text-white px-5 py-2.5 rounded-pill font-bold text-sm hover:bg-hungry-orange-dark transition-colors"
        >
          Join Waitlist
        </Link>
      </nav>

      {/* 2. Immersive Hero Scroll Story */}
      <section
        ref={heroRef}
        className="relative w-full h-[90svh] flex flex-col items-center justify-center overflow-hidden px-6"
      >
        <div className="absolute inset-0 z-0 bg-hungry-bg-soft hero-parallax">
          <Image
            src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2574&auto=format&fit=crop"
            alt="Singapore Hawker Culture"
            fill
            className="object-cover opacity-10 mix-blend-multiply"
            priority
          />
          {/* Subtle gradient wash over background */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-hungry-bg" />
        </div>

        <div className="relative z-10 w-full max-w-5xl flex flex-col items-center text-center mt-[-5svh]">
          <h1 className="hero-element font-display font-extrabold text-[clamp(3.5rem,8vw,6rem)] leading-[1.05] tracking-tight text-hungry-text mb-4">
            Discover food around you.
            <br />
            Get Hungry.
          </h1>
          <p className="hero-element text-xl md:text-2xl text-hungry-text-secondary font-medium mb-4">
            Find the dish. Not just the restaurant.
          </p>
          <p className="hero-element text-hungry-text-secondary max-w-2xl mx-auto mb-10">
            Hungry is a Singapore food discovery app that helps you discover nearby dishes, reviews,
            rankings, menus, and stall information — while helping merchants get discovered.
          </p>
          <div className="hero-element flex flex-col sm:flex-row gap-4 w-full justify-center">
            <Link
              href="/join-waitlist"
              className="bg-hungry-orange text-white px-8 py-4 rounded-pill font-bold text-lg hover:bg-hungry-orange-dark transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Join Waitlist
            </Link>
            <Link
              href="/for-merchants"
              className="bg-white text-hungry-text border border-hungry-border px-8 py-4 rounded-pill font-bold text-lg hover:bg-hungry-bg-soft transition-colors shadow-sm hover:shadow-md transform hover:-translate-y-1"
            >
              Register Interest
            </Link>
          </div>
        </div>

        {/* Floating UI Elements (Hero Parallax) */}
        <div className="hero-element absolute bottom-[10%] left-[10%] hidden lg:flex items-center gap-3 bg-white p-4 rounded-2xl shadow-xl border border-hungry-border">
          <div className="w-12 h-12 bg-hungry-orange/10 rounded-full flex items-center justify-center text-hungry-orange">
            <MapPin weight="fill" size={24} />
          </div>
          <div>
            <p className="font-bold text-hungry-text">Chicken rice</p>
            <p className="text-sm text-hungry-text-secondary">near Bugis</p>
          </div>
        </div>
        <div className="hero-element absolute top-[25%] right-[10%] hidden lg:flex items-center gap-3 bg-white p-3 rounded-2xl shadow-xl border border-hungry-border">
          <div className="w-3 h-3 bg-hungry-green rounded-full animate-pulse" />
          <p className="font-bold text-hungry-text text-sm">Open now</p>
        </div>
      </section>

      {/* 3. Built for Foodies and Merchants */}
      <section className="py-24 px-6 md:px-12 w-full max-w-7xl mx-auto">
        <div className="text-center mb-16 reveal-on-scroll">
          <h2 className="font-display font-bold text-4xl md:text-5xl text-hungry-text mb-4">
            Built for foodies and merchants.
          </h2>
          <p className="text-lg text-hungry-text-secondary max-w-2xl mx-auto">
            Whether you are searching for your next meal or running a food business, Hungry helps
            people connect through food.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Foodie Card */}
          <div className="reveal-on-scroll group relative bg-white border border-hungry-border rounded-[2rem] p-8 md:p-12 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-hungry-amber/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10">
              <h3 className="text-hungry-text-secondary font-bold uppercase tracking-widest text-sm mb-2">
                For foodies
              </h3>
              <h4 className="font-display font-bold text-3xl md:text-4xl text-hungry-text mb-6">
                Discover food all over Singapore.
              </h4>
              <ul className="space-y-4 mb-12">
                {[
                  "Find nearby dishes",
                  "Browse reviews and rankings",
                  "See stall and menu information",
                  "Save places to try later",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-hungry-text-secondary">
                    <CheckCircle size={24} weight="fill" className="text-hungry-teal" /> {feature}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/join-waitlist"
              className="relative z-10 inline-flex items-center font-bold text-hungry-orange group-hover:text-hungry-orange-dark"
            >
              Join Waitlist{" "}
              <ArrowRight
                weight="bold"
                className="ml-2 group-hover:translate-x-1 transition-transform"
              />
            </Link>
          </div>

          {/* Merchant Card */}
          <div className="reveal-on-scroll group relative bg-hungry-navy border border-hungry-navy rounded-[2rem] p-8 md:p-12 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 flex flex-col justify-between overflow-hidden text-white">
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-hungry-orange/20 rounded-full blur-3xl -mr-20 -mb-20 group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10">
              <h3 className="text-hungry-orange font-bold uppercase tracking-widest text-sm mb-2">
                For merchants
              </h3>
              <h4 className="font-display font-bold text-3xl md:text-4xl text-white mb-6">
                Get discovered by hungry customers.
              </h4>
              <ul className="space-y-4 mb-12">
                {[
                  "Register interest",
                  "Claim or create your listing",
                  "Show your menu and opening hours",
                  "Help nearby customers find you",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/80">
                    <CheckCircle size={24} weight="fill" className="text-hungry-orange" /> {feature}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/for-merchants"
              className="relative z-10 inline-flex items-center font-bold text-white group-hover:text-hungry-orange-light"
            >
              Register Interest{" "}
              <ArrowRight
                weight="bold"
                className="ml-2 group-hover:translate-x-1 transition-transform"
              />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Why Food Discovery Still Feels Broken */}
      <section className="py-24 bg-hungry-bg-soft">
        <div className="w-full max-w-7xl mx-auto px-6 md:px-12 flex flex-col lg:flex-row gap-16 items-center">
          <div className="lg:w-1/2 reveal-on-scroll">
            <h2 className="font-display font-bold text-4xl md:text-5xl text-hungry-text mb-6">
              Food discovery should not be this difficult.
            </h2>
            <p className="text-xl text-hungry-text-secondary leading-relaxed">
              You are hungry. You search. You scroll. You still do not know what is open, what is
              good, or what the menu looks like.
            </p>
          </div>
          <div className="lg:w-1/2 flex flex-col gap-4 w-full">
            {[
              "Menus are hard to find",
              "Opening hours are uncertain",
              "Good food nearby gets missed",
              "Smaller merchants struggle to be seen",
              "Reviews and recommendations are scattered",
            ].map((problem, i) => (
              <div
                key={i}
                className="reveal-on-scroll bg-white p-6 rounded-2xl shadow-sm border border-hungry-border flex items-center gap-4 text-hungry-text font-medium text-lg"
              >
                <div className="w-8 h-8 rounded-full bg-hungry-red/10 text-hungry-red flex items-center justify-center flex-shrink-0">
                  ✕
                </div>
                {problem}
              </div>
            ))}
            <div className="reveal-on-scroll mt-8 bg-hungry-orange p-8 rounded-2xl shadow-lg text-white font-bold text-xl md:text-2xl">
              Hungry brings food discovery, reviews, rankings, menus, opening hours, and
              merchant-updated information into one app.
            </div>
          </div>
        </div>
      </section>

      {/* 5. Sticky Product Showcase */}
      <section ref={showcaseRef} className="relative w-full h-[500vh] bg-white">
        <div
          className="w-full h-screen sticky top-0 flex flex-col md:flex-row items-center justify-center px-6 md:px-12 max-w-7xl mx-auto gap-12"
          ref={showcaseStickyRef}
        >
          {/* Left: Sticky Device */}
          <div className="w-full md:w-1/2 flex justify-center items-center h-full relative">
            <div className="w-[280px] h-[600px] bg-hungry-navy rounded-[3rem] border-8 border-hungry-border shadow-2xl overflow-hidden relative transition-all duration-500">
              <Image
                src={showcaseImages[activeShowcaseStep]}
                alt="App Screenshot"
                fill
                className="object-cover transition-opacity duration-500"
              />
            </div>
          </div>

          {/* Right: Scroll Linked Steps */}
          <div className="w-full md:w-1/2 h-full relative">
            <div className="absolute inset-0 flex flex-col justify-center">
              {[
                {
                  title: "Discover food across Singapore",
                  desc: "Explore dishes, stalls, cafés, restaurants, and home-based food businesses around you.",
                },
                {
                  title: "See reviews and rankings",
                  desc: "Find what people recommend, compare rankings, and discover what is worth trying.",
                },
                {
                  title: "View stall and menu information",
                  desc: "Check menus, dish photos, opening hours, and business details before you go.",
                },
                {
                  title: "Save and revisit favourites",
                  desc: "Keep track of places and dishes you want to try next.",
                },
                {
                  title: "Help merchants get discovered",
                  desc: "Merchants can manage their presence so hungry customers know what they offer.",
                },
              ].map((step, i) => (
                <div
                  key={i}
                  className={`showcase-step h-screen flex flex-col justify-center transition-opacity duration-500 ${activeShowcaseStep === i ? "opacity-100" : "opacity-10"}`}
                >
                  <div className="text-hungry-orange font-bold text-xl mb-4">Step 0{i + 1}</div>
                  <h3 className="font-display font-bold text-3xl md:text-5xl text-hungry-text mb-4">
                    {step.title}
                  </h3>
                  <p className="text-xl text-hungry-text-secondary">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. Built for the Way Singapore Eats (Horizontal Carousel) */}
      <section
        ref={carouselRef}
        className="h-screen bg-hungry-bg-soft flex flex-col justify-center overflow-hidden"
      >
        <div className="px-6 md:px-12 max-w-7xl mx-auto w-full mb-12">
          <h2 className="font-display font-bold text-4xl md:text-5xl text-hungry-text mb-4">
            Built for the way Singapore eats.
          </h2>
          <p className="text-xl text-hungry-text-secondary max-w-2xl">
            From hawker centres and kopitiams to cafés, restaurants, and home-based food businesses,
            Hungry helps people discover what is worth eating next.
          </p>
        </div>

        <div className="carousel-container flex gap-6 px-6 md:px-12 w-max">
          {[
            {
              title: "Hawker Stalls",
              desc: "Find local favourites and hidden gems across hawker centres.",
              img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1",
            },
            {
              title: "Cafés",
              desc: "Discover neighbourhood cafés, bakes, drinks, and brunch spots.",
              img: "https://images.unsplash.com/photo-1554118811-1e0d58224f24",
            },
            {
              title: "Restaurants",
              desc: "Explore restaurants by dish, reviews, and menu information.",
              img: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4",
            },
            {
              title: "Home-Based Businesses",
              desc: "Support small food makers and home-based kitchens.",
              img: "https://images.unsplash.com/photo-1626804475297-4160bdfa3449",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="w-[300px] md:w-[400px] h-[500px] flex-shrink-0 relative rounded-3xl overflow-hidden group cursor-grab active:cursor-grabbing"
            >
              <Image
                src={`${item.img}?q=80&w=600&auto=format&fit=crop`}
                alt={item.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-hungry-navy via-hungry-navy/50 to-transparent opacity-80" />
              <div className="absolute bottom-0 p-8 w-full">
                <h3 className="font-display font-bold text-2xl text-white mb-2">{item.title}</h3>
                <p className="text-white/80">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Merchant Discovery Story */}
      <section className="py-32 bg-white px-6 md:px-12">
        <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
          <div className="lg:w-1/2 reveal-on-scroll">
            <h2 className="font-display font-bold text-5xl md:text-6xl text-hungry-text mb-6">
              Get discovered.
            </h2>
            <p className="text-xl text-hungry-text-secondary mb-8">
              Hungry helps merchants show up when people are deciding what to eat nearby.
            </p>
            <ul className="space-y-6 mb-10">
              {[
                {
                  title: "Register interest",
                  desc: "Let Hungry know you want your business to be part of the platform.",
                },
                {
                  title: "Claim or create your listing",
                  desc: "Take ownership of your business profile.",
                },
                {
                  title: "Add menu and photos",
                  desc: "Show customers what you sell before they visit.",
                },
                { title: "Get discovered", desc: "Appear when hungry users search nearby." },
              ].map((step, i) => (
                <li key={i} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-hungry-orange text-white flex items-center justify-center font-mono font-bold flex-shrink-0 mt-1">
                    {i + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-xl text-hungry-text mb-1">{step.title}</h4>
                    <p className="text-hungry-text-secondary">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href="/for-merchants"
              className="bg-hungry-navy text-white px-8 py-4 rounded-pill font-bold text-lg hover:bg-hungry-text transition-colors inline-block"
            >
              Register Interest
            </Link>
          </div>
          <div className="lg:w-1/2 w-full reveal-on-scroll">
            <div className="relative w-full aspect-square bg-hungry-bg-soft rounded-3xl border border-hungry-border overflow-hidden shadow-2xl flex items-center justify-center p-12">
              <Storefront size={120} className="text-hungry-amber opacity-20 absolute" />
              <div className="relative z-10 w-full bg-white rounded-2xl shadow-lg p-6 border border-hungry-border transform rotate-2 hover:rotate-0 transition-transform duration-500">
                <div className="flex justify-between items-center mb-6">
                  <h5 className="font-bold text-hungry-text">Merchant Dashboard</h5>
                  <span className="bg-hungry-green/10 text-hungry-green px-3 py-1 rounded-pill text-xs font-bold uppercase tracking-wider">
                    Live
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="h-4 bg-hungry-bg-soft rounded w-3/4" />
                  <div className="h-4 bg-hungry-bg-soft rounded w-1/2" />
                  <div className="h-4 bg-hungry-bg-soft rounded w-5/6" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Reviews, Rankings, and Community Layer */}
      <section className="py-32 bg-hungry-bg px-6 md:px-12">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-20 reveal-on-scroll">
            <h2 className="font-display font-bold text-4xl md:text-5xl text-hungry-text mb-4">
              Food discovery, shaped by the community.
            </h2>
            <p className="text-xl text-hungry-text-secondary max-w-2xl mx-auto">
              Hungry is designed around reviews, rankings, photos, and recommendations from people
              who actually eat around Singapore.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Star weight="fill" className="text-hungry-amber" />,
                title: "Top-rated chicken rice nearby",
                bg: "bg-white",
              },
              {
                icon: <Heart weight="fill" className="text-hungry-red" />,
                title: "Most saved cafés this week",
                bg: "bg-hungry-bg-soft",
              },
              {
                icon: <Quotes weight="fill" className="text-hungry-teal" />,
                title: "Community photo reviews",
                bg: "bg-white",
              },
            ].map((card, i) => (
              <div
                key={i}
                className={`reveal-on-scroll p-8 rounded-3xl border border-hungry-border flex flex-col gap-6 ${card.bg} hover:shadow-lg transition-shadow duration-300`}
              >
                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center border border-hungry-border text-2xl">
                  {card.icon}
                </div>
                <h3 className="font-display font-bold text-2xl text-hungry-text">{card.title}</h3>
                <div className="w-full h-24 bg-gradient-to-r from-hungry-border/50 to-transparent rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Final Split CTA */}
      <section className="py-24 bg-white border-t border-hungry-border px-6 md:px-12">
        <div className="w-full max-w-7xl mx-auto grid md:grid-cols-2 gap-8">
          <div className="reveal-on-scroll bg-hungry-bg-soft p-12 rounded-3xl text-center flex flex-col items-center justify-center">
            <h2 className="font-display font-bold text-3xl text-hungry-text mb-4">
              Want early access to Hungry?
            </h2>
            <p className="text-hungry-text-secondary mb-8">
              Join the waitlist and be first to discover food across Singapore when Hungry launches.
            </p>
            <Link
              href="/join-waitlist"
              className="bg-hungry-orange text-white px-8 py-4 rounded-pill font-bold hover:bg-hungry-orange-dark transition-colors w-full sm:w-auto inline-block"
            >
              Join Waitlist
            </Link>
          </div>
          <div className="reveal-on-scroll bg-hungry-navy p-12 rounded-3xl text-center flex flex-col items-center justify-center text-white">
            <h2 className="font-display font-bold text-3xl mb-4">Own a food business?</h2>
            <p className="text-white/80 mb-8">
              Register interest and help hungry customers discover your food.
            </p>
            <Link
              href="/for-merchants"
              className="bg-white text-hungry-text px-8 py-4 rounded-pill font-bold hover:bg-hungry-bg transition-colors w-full sm:w-auto inline-block"
            >
              Register Interest
            </Link>
          </div>
        </div>
      </section>

      {/* 10. Footer */}
      <footer className="w-full py-16 bg-white border-t border-hungry-border text-center flex flex-col items-center">
        <div className="font-display font-extrabold text-3xl tracking-tight text-hungry-text mb-4">
          Hungry
        </div>
        <p className="text-hungry-text-secondary font-medium mb-12">
          Find the dish. Not just the restaurant.
        </p>

        <div className="flex flex-wrap justify-center gap-6 md:gap-12 mb-12 text-sm font-bold text-hungry-text">
          <Link href="/for-foodies" className="hover:text-hungry-orange transition-colors">
            Foodies
          </Link>
          <Link href="/for-merchants" className="hover:text-hungry-orange transition-colors">
            Merchants
          </Link>
          <Link href="/about" className="hover:text-hungry-orange transition-colors">
            About
          </Link>
          <Link href="/join-waitlist" className="hover:text-hungry-orange transition-colors">
            Join Waitlist
          </Link>
          <Link href="/merchant-login" className="hover:text-hungry-orange transition-colors">
            Merchant Portal
          </Link>
        </div>

        <div className="text-hungry-text-secondary/50 text-xs">
          © 2026 Hungry.sg. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
