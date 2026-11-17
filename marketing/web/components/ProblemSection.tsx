import { SectionEyebrow } from "./SectionEyebrow";

export function ProblemSection() {
  return (
    <section className="bg-hungry-navy py-20 text-white">
      <div className="mx-auto max-w-7xl px-5">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <div className="max-w-md">
            <SectionEyebrow tone="dark">The problem</SectionEyebrow>
            <h2 className="mt-5 text-4xl font-extrabold tracking-[-0.05em] md:text-5xl">
              Most food apps make you browse the wrong thing first.
            </h2>
            <p className="mt-5 text-base leading-7 text-white/70">
              When you are hungry, you usually know what you feel like eating before you know which
              venue to open. But most tools still push you into restaurant lists, vague map pins, or
              endless scrolling. That is why choosing lunch can still take longer than it should.
            </p>
          </div>

          <div className="grid border-y border-white/12 md:grid-cols-2 md:divide-x md:divide-white/12">
            <div className="py-6 pr-0 md:pr-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/54">
                Venue-first
              </p>
              <div className="mt-6 space-y-4">
                {[
                  "Open Maxwell Food Centre",
                  "Scroll through venue names",
                  "Guess which stall has the right laksa",
                ].map((line, index) => (
                  <div
                    key={line}
                    className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-white">{line}</p>
                      <span className="font-mono text-[11px] text-white/40">0{index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-8 max-w-sm text-sm leading-6 text-white/62">
                Restaurant lists make the user bridge the last mile alone.
              </p>
            </div>

            <div className="border-t border-white/12 py-6 pl-0 md:border-t-0 md:pl-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-hungry-amber">
                Dish-first
              </p>
              <div className="mt-6 rounded-[28px] border border-white/12 bg-white/6 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Laksa nearby</p>
                    <p className="mt-1 text-xs text-white/58">
                      4 strong matches within walking distance
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-hungry-amber">Best fit</span>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    "328 Katong Laksa · 420 m · Unit #01-08",
                    "Beach Road Laksa · 680 m · Floor 2",
                    "Janggut Laksa · 1.1 km · Open now",
                  ].map((item) => (
                    <div
                      key={item}
                      className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0"
                    >
                      <p className="text-sm text-white/78">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-8 max-w-sm text-sm leading-6 text-white/62">
                Start with the craving, compare nearby options, then head straight to the right
                stall.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
