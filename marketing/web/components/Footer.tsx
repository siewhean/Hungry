import { SectionEyebrow } from "./SectionEyebrow";
import { WaitlistForm } from "./WaitlistForm";
import Link from "next/link";
import { HungryWordmark } from "./HungryWordmark";

export function Footer() {
  return (
    <footer className="site-section-rule bg-white">
      <div className="py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start">
          <div className="max-w-lg">
            <SectionEyebrow>Final call</SectionEyebrow>
            <h2 className="mt-5 text-4xl font-extrabold tracking-[-0.05em] text-hungry-navy md:text-5xl">
              Stop starting with the wrong search.
            </h2>
            <p className="mt-5 text-base leading-7 text-hungry-text-secondary">
              Join the waitlist to hear when Hungry opens early access.
            </p>
          </div>
          <div className="max-w-xl">
            <WaitlistForm variant="footer" surface="light" mode="consumer" />
          </div>
        </div>
      </div>

      <div className="border-t border-hungry-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-hungry-text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link className="inline-flex items-center" href="/">
              <HungryWordmark />
            </Link>
            <span className="font-mono uppercase tracking-[0.18em]">Singapore</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="/terms" className="transition-colors hover:text-hungry-navy">
              Terms
            </a>
            <a href="/privacy" className="transition-colors hover:text-hungry-navy">
              Privacy
            </a>
            <a href="/account/delete" className="transition-colors hover:text-hungry-navy">
              Delete account
            </a>
            <a href="mailto:usehungrysingapore@gmail.com" className="transition-colors hover:text-hungry-navy">
              Contact
            </a>
          </div>

          <p className="font-mono">© 2026 Hungry</p>
        </div>
      </div>
    </footer>
  );
}
