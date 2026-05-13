"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowRight, MapPin, Fire, Star, Clock } from "@phosphor-icons/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLHeadingElement>(null);
  const bentoRef = useRef<HTMLDivElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero fade up
      gsap.fromTo(
        heroTextRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1.2, ease: "power4.out" },
      );

      // Parallax Background
      gsap.to(".parallax-bg", {
        y: "20%",
        ease: "none",
        scrollTrigger: {
          trigger: parallaxRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });

      // Bento Grid staggered entrance
      gsap.fromTo(
        ".bento-item",
        { opacity: 0, scale: 0.95, y: 30 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.1,
          scrollTrigger: {
            trigger: bentoRef.current,
            start: "top 80%",
          },
        },
      );

      // Section Pinning
      ScrollTrigger.create({
        trigger: ".pin-section",
        start: "top top",
        end: "+=100%",
        pin: ".pin-text",
        scrub: true,
      });
    }, [heroRef, bentoRef, parallaxRef]);

    return () => ctx.revert();
  }, []);

  return (
    <main className="overflow-x-hidden w-full max-w-full bg-hungry-heritage-white">
      {/* Navigation */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md border border-hungry-border rounded-full shadow-lg w-[90%] max-w-5xl">
        <div className="font-display font-bold text-xl tracking-tight text-hungry-text">Hungry</div>
        <div className="hidden md:flex gap-8 items-center text-sm font-medium">
          <a href="#discover" className="hover:text-hungry-orange transition-colors">
            Discover
          </a>
          <a href="#features" className="hover:text-hungry-orange transition-colors">
            Features
          </a>
          <a href="#heritage" className="hover:text-hungry-orange transition-colors">
            Heritage
          </a>
        </div>
        <button className="bg-hungry-orange text-white px-6 py-2 rounded-full font-medium hover:bg-hungry-orange-dark transition-colors duration-300">
          Get Early Access
        </button>
      </nav>

      {/* Hero: Cinematic Center */}
      <section
        ref={heroRef}
        className="relative w-full h-[100svh] flex flex-col items-center justify-center text-center px-6 pt-24 overflow-hidden"
      >
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2574&auto=format&fit=crop"
            alt="Singapore Hawker Culture"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-hungry-night-market/70 bg-gradient-radial-wash" />
        </div>

        <div className="relative z-10 flex flex-col items-center w-full max-w-6xl">
          <h1
            ref={heroTextRef}
            className="font-display font-bold text-[clamp(3rem,6vw,6rem)] leading-[1.1] tracking-tight text-white max-w-5xl"
          >
            Find the exact dish you crave. <br />
            Not just the restaurant.
          </h1>
          <p className="mt-8 text-lg md:text-xl text-white/80 max-w-2xl font-body">
            Singapore&apos;s first dish-centric food discovery platform. Compare nearby hawker
            stalls and dive deep into vibrant heritage flavors.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md">
            <button className="flex-1 bg-hungry-orange text-white px-8 py-4 rounded-full font-medium text-lg flex items-center justify-center gap-2 hover:scale-105 hover:bg-hungry-orange-dark transition-all duration-300 shadow-[0_0_40px_-10px_rgba(232,83,30,0.5)]">
              Join the Waitlist <ArrowRight weight="bold" />
            </button>
            <button className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 text-white px-8 py-4 rounded-full font-medium text-lg hover:bg-white/20 transition-all duration-300">
              Explore the App
            </button>
          </div>
        </div>
      </section>

      {/* Interest: Gapless Bento Grid */}
      <section
        ref={bentoRef}
        id="features"
        className="py-32 px-6 md:px-12 w-full max-w-7xl mx-auto"
      >
        <div className="text-center mb-20 max-w-3xl mx-auto">
          <h2 className="font-display font-bold text-[clamp(2.5rem,4vw,4rem)] leading-tight text-hungry-text">
            Engineered for the perfect bite.
          </h2>
        </div>

        <div className="grid grid-cols-12 auto-rows-[320px] gap-6 grid-flow-dense">
          {/* Card 1 */}
          <div className="bento-item col-span-12 lg:col-span-8 group relative overflow-hidden rounded-[2rem] bg-hungry-surface border border-hungry-border p-8 flex flex-col justify-end">
            <div className="absolute top-0 right-0 w-full h-full opacity-0 group-hover:opacity-10 transition-opacity duration-700 bg-[url('https://images.unsplash.com/photo-1525648199074-cee30ba79a4a?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center" />
            <div className="relative z-10 w-full flex justify-between items-end">
              <div className="max-w-md">
                <MapPin size={32} className="text-hungry-orange mb-4" />
                <h3 className="font-display font-bold text-3xl mb-2 text-hungry-text">
                  Hyper-Local Discovery
                </h3>
                <p className="text-hungry-text-secondary text-lg">
                  Compare dishes from stalls within walking distance. Never settle for mediocre food
                  again.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bento-item col-span-12 md:col-span-6 lg:col-span-4 group relative overflow-hidden rounded-[2rem] bg-hungry-night-market text-white p-8 flex flex-col justify-between">
            <Fire size={32} className="text-hungry-orange" />
            <div>
              <h3 className="font-display font-bold text-3xl mb-2">Wok Hei Magic</h3>
              <p className="text-white/70">
                Uncover the hidden gems that master the art of the flame.
              </p>
            </div>
            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-hungry-orange/20 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-700" />
          </div>

          {/* Card 3 */}
          <div className="bento-item col-span-12 md:col-span-6 lg:col-span-4 group relative overflow-hidden rounded-[2rem] bg-hungry-surface border border-hungry-border p-8 flex flex-col justify-between">
            <Star size={32} className="text-hungry-amber" />
            <div>
              <h3 className="font-display font-bold text-3xl mb-2">Honest Reviews</h3>
              <p className="text-hungry-text-secondary">
                Community-driven ratings for every specific dish.
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bento-item col-span-12 lg:col-span-8 group relative overflow-hidden rounded-[2rem] bg-hungry-surface border border-hungry-border p-0 flex items-center">
            <div className="w-1/2 p-8 h-full flex flex-col justify-center">
              <Clock size={32} className="text-hungry-teal mb-4" />
              <h3 className="font-display font-bold text-3xl mb-2 text-hungry-text">
                Real-Time Queues
              </h3>
              <p className="text-hungry-text-secondary">
                Know exactly how long you&apos;ll wait before you even arrive at the hawker centre.
              </p>
            </div>
            <div className="w-1/2 h-full relative overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1541628951107-a9af5346a3e4?q=80&w=2578&auto=format&fit=crop"
                alt="Hawker stall queue"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Desire: Parallax Heritage Section with Pinned Text */}
      <section
        ref={parallaxRef}
        className="pin-section relative w-full h-[150vh] flex px-6 md:px-12 py-32 bg-hungry-bg"
      >
        <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row gap-16 relative">
          <div className="pin-text w-full md:w-1/2 h-screen flex flex-col justify-center sticky top-0">
            <h2 className="font-display font-bold text-[clamp(3rem,5vw,5rem)] leading-[1.1] text-hungry-text max-w-lg">
              Preserving <span className="text-hungry-chili-red italic">flavors.</span> <br />{" "}
              Elevating <span className="text-hungry-orange italic">access.</span>
            </h2>
            <p className="mt-8 text-xl text-hungry-text-secondary max-w-md">
              Our mission goes beyond discovery. We aim to digitize the unseen menus of
              Singapore&apos;s hawker culture, keeping heritage alive for the next generation.
            </p>
          </div>

          <div className="w-full md:w-1/2 flex flex-col gap-12 pt-[50vh]">
            <div className="relative w-full h-[600px] rounded-3xl overflow-hidden group">
              <Image
                src="https://images.unsplash.com/photo-1626804475297-4160bdfa3449?q=80&w=2670&auto=format&fit=crop"
                alt="Cooking"
                fill
                className="parallax-bg object-cover scale-125"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-700" />
            </div>
            <div className="relative w-full h-[600px] rounded-3xl overflow-hidden group">
              <Image
                src="https://images.unsplash.com/photo-1582450871972-ab5ca641643d?q=80&w=2574&auto=format&fit=crop"
                alt="Ingredients"
                fill
                className="parallax-bg object-cover scale-125"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-700" />
            </div>
          </div>
        </div>
      </section>

      {/* Action: Massive Footer */}
      <footer className="relative w-full py-48 bg-hungry-night-market text-white overflow-hidden flex flex-col items-center text-center px-6">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />

        <h2 className="relative z-10 font-display font-bold text-[clamp(4rem,10vw,12rem)] leading-none tracking-tighter text-white">
          Ready to <br />
          eat well?
        </h2>

        <div className="relative z-10 mt-16 max-w-xl">
          <button className="w-full sm:w-auto bg-hungry-orange text-white px-12 py-6 rounded-full font-bold text-2xl hover:scale-105 hover:bg-hungry-orange-dark transition-all duration-300 shadow-[0_0_60px_-15px_rgba(232,83,30,0.6)]">
            Join the Waitlist Now
          </button>
        </div>

        <div className="relative z-10 mt-32 flex flex-col sm:flex-row justify-between w-full max-w-6xl text-white/50 border-t border-white/10 pt-8 text-sm">
          <p>© 2026 Hungry.sg. All rights reserved.</p>
          <div className="flex gap-8 mt-4 sm:mt-0">
            <a href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </a>
            <a href="/about" className="hover:text-white transition-colors">
              About Us
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
