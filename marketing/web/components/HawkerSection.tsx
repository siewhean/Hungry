import Image from "next/image";

import { SITE_MEDIA } from "./siteMedia";
import { SectionEyebrow } from "./SectionEyebrow";
import { WaitlistForm } from "./WaitlistForm";

export function HawkerSection() {
  return (
    <section className="bg-hungry-navy py-24 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="overflow-hidden rounded-[36px] border border-white/10 bg-white/6 editorial-shadow">
          <Image
            src={SITE_MEDIA.pizza}
            alt="Cooked dishes arranged on a counter for service"
            width={1200}
            height={900}
            sizes="(max-width: 1024px) 100vw, 48vw"
            className="h-full min-h-[26rem] w-full object-cover opacity-88"
          />
        </div>

        <div>
          <SectionEyebrow tone="dark">For hawkers</SectionEyebrow>
          <h2 className="mt-5 text-4xl font-extrabold tracking-[-0.05em] md:text-5xl">
            Own a stall? Get discovered by dish.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/72">
            Hungry is designed to help smaller stalls show up when people search for the dish they
            actually sell. If you are interested in early visibility tools, register your interest
            and we will keep you in the loop.
          </p>
          <div className="mt-8 max-w-xl">
            <WaitlistForm mode="hawker" surface="dark" />
          </div>
        </div>
      </div>
    </section>
  );
}
