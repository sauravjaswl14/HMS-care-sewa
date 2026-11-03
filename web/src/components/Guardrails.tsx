'use client';

import { useRef } from 'react';
import { gsap, useGSAP, MOTION_OK } from '@/lib/gsap';

const STATEMENTS = [
  'Two people can’t book the same slot. The database refuses the second one.',
  'Stock can’t go below zero. A prescription is dispensed in full or not at all.',
  'A payment can’t be larger than the balance, and a paid invoice can’t be voided.',
  'A closed visit can’t be edited, and every change leaves an audit entry.',
];

/** Each word darkens as you scroll through it, so the section is read at the pace of the scroll. */
export default function Guardrails() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo('[data-w]', { color: '#CBD6DA' }, { color: '#0F2A33', stagger: 0.12, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top 70%', end: 'bottom 62%', scrub: true } });
      });
      return () => mm.revert();
    },
    { scope: root },
  );
  return (
    <section ref={root} className="bg-paper py-24 lg:py-40">
      <div className="mx-auto max-w-[88rem] px-5 sm:px-8">
        <h2 className="display-md max-w-3xl text-[clamp(2.4rem,4.4vw,4.2rem)]">Built so mistakes are hard.</h2>
        <div className="mt-12 max-w-5xl space-y-8">
          {STATEMENTS.map((s) => (
            <p key={s} className="display-md text-[clamp(1.7rem,3.2vw,3rem)] !font-semibold leading-[1.12]">
              {s.split(' ').map((w, i) => (
                <span key={i} data-w className="inline-block pr-[0.28em] text-ink">{w}</span>
              ))}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
