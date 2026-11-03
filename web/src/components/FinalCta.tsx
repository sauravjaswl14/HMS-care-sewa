'use client';

import { useRef } from 'react';
import { gsap, useGSAP, MOTION_OK } from '@/lib/gsap';
import { LINKS } from '@/lib/site';
import LineHeading from './LineHeading';
import Magnetic from './Magnetic';
import Beat from './Beat';

export default function FinalCta() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.utils.toArray<HTMLElement>('[data-par]').forEach((el) => {
          const s = parseFloat(el.dataset.par ?? '0');
          gsap.fromTo(el, { yPercent: -s }, { yPercent: s, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: true } });
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );
  return (
    <section ref={root} className="relative overflow-hidden bg-scrub py-28 text-paper lg:py-44">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div data-par="30" className="absolute right-[6%] top-16 hidden rotate-6 rounded-2xl bg-band px-5 py-3 text-ink shadow-pop sm:block">09:40 · Dr. Sharma</div>
        <div data-par="55" className="absolute right-[18%] top-48 hidden -rotate-3 rounded-2xl bg-paper px-5 py-3 text-ink shadow-pop sm:block">Bed 04 · free</div>
        <div data-par="18" className="absolute right-[4%] top-80 hidden rotate-2 rounded-2xl bg-pulse px-5 py-3 text-paper shadow-pop lg:block">Result ready</div>
      </div>
      <div className="relative mx-auto max-w-[88rem] px-5 sm:px-8">
        <LineHeading lines={['Start with', 'one department.']} tone="light" className="text-[clamp(3.4rem,8vw,8rem)]" />
        <p className="mt-8 max-w-md text-lg text-paper/85">Add the departments, set each doctor’s hours, and book the first patient.</p>
        <div className="mt-10">
          <Magnetic href={LINKS.login} className="btn bg-paper text-ink hover:bg-band">
            Open Carewell
          </Magnetic>
        </div>
      </div>
      <div className="mt-20"><Beat stroke="#FAFCFC" /></div>
    </section>
  );
}
