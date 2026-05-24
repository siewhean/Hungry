"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { HungryWordmark } from "./HungryWordmark";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200 ${
          scrolled
            ? "bg-white/90 backdrop-blur-md border-b border-hungry-border shadow-sm"
            : "bg-transparent border-transparent"
        }`}
      >
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5">
          <Link href="/" className="flex items-end gap-3">
            <HungryWordmark />
            <span className="pb-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-hungry-text-muted">
              Singapore
            </span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-semibold text-hungry-text-secondary md:flex">
            <Link href="/#how-it-works" className="transition-colors hover:text-hungry-orange">
              How it works
            </Link>
            <Link href="/for-merchants" className="transition-colors hover:text-hungry-orange">
              For hawkers
            </Link>
            <Link href="/about" className="transition-colors hover:text-hungry-orange">
              About
            </Link>
          </div>

          <div className="hidden md:block">
            <a
              href="#waitlist"
              className="inline-flex items-center rounded-pill bg-hungry-orange px-5 py-2.5 text-sm font-bold text-white transition-[background-color,transform] duration-200 hover:bg-hungry-orange-dark active:scale-[0.97]"
            >
              Join the waitlist
            </a>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-3 rounded-pill border border-hungry-border bg-white/90 px-3 py-2 text-sm font-semibold text-hungry-navy transition-[border-color,color] duration-200 md:hidden"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="relative block h-3.5 w-4" aria-hidden="true">
              <span
                className={`absolute left-0 top-0 h-px w-full bg-current transition-transform duration-200 ${
                  menuOpen ? "translate-y-[6px] rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-[6px] h-px w-full bg-current transition-opacity duration-200 ${
                  menuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 top-3 h-px w-full bg-current transition-transform duration-200 ${
                  menuOpen ? "-translate-y-[6px] -rotate-45" : ""
                }`}
              />
            </span>
            <span>{menuOpen ? "Close" : "Menu"}</span>
          </button>
        </div>
      </nav>

      {menuOpen ? (
        <div
          id="site-menu"
          className="fixed inset-x-5 top-20 z-40 rounded-[28px] border border-hungry-border bg-white p-5 shadow-[0_28px_80px_-48px_rgba(26,46,68,0.55)] md:hidden"
        >
          <div className="space-y-2 text-sm font-semibold text-hungry-navy">
            <Link
              href="/#how-it-works"
              className="block rounded-2xl px-4 py-3 transition-colors hover:bg-hungry-bg-soft"
              onClick={() => setMenuOpen(false)}
            >
              How it works
            </Link>
            <Link
              href="/for-merchants"
              className="block rounded-2xl px-4 py-3 transition-colors hover:bg-hungry-bg-soft"
              onClick={() => setMenuOpen(false)}
            >
              For hawkers
            </Link>
            <Link
              href="/about"
              className="block rounded-2xl px-4 py-3 transition-colors hover:bg-hungry-bg-soft"
              onClick={() => setMenuOpen(false)}
            >
              About
            </Link>
          </div>
          <a
            href="#waitlist"
            className="mt-5 inline-flex w-full items-center justify-center rounded-pill bg-hungry-orange px-5 py-3 text-sm font-bold text-white transition-[background-color,transform] duration-200 hover:bg-hungry-orange-dark active:scale-[0.97]"
            onClick={() => setMenuOpen(false)}
          >
            Join the waitlist
          </a>
        </div>
      ) : null}
    </>
  );
}
