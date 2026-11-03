'use client';

import { useRef } from 'react';
import { gsap, useGSAP, MOTION_OK } from '@/lib/gsap';
import { trace } from '@/lib/ecg';
import LineHeading from './LineHeading';

const STEPS = [
  { title: 'Register', text: 'Reception creates the patient record. Allergies are entered once and shown to every doctor from then on.' },
  { title: 'Book', text: 'Pick a department, a doctor and a free slot. A service such as an ECG can be added to the booking.' },
  { title: 'Check in', text: 'On arrival the patient is checked in and appears in the doctor’s list for the day.' },
  { title: 'Consult', text: 'The doctor records vitals, diagnosis and notes, writes prescriptions and orders lab tests. Closing the visit locks the record.' },
  { title: 'Pharmacy and lab', text: 'The pharmacist dispenses and stock goes down. The lab collects the sample and enters a result flagged normal, abnormal or critical.' },
  { title: 'Bill and pay', text: 'The visit becomes an invoice: the consultation fee plus any service. Payments can’t be larger than the balance. A hospital stay is billed per day.' },
];

const { d: V } = trace(1000, 36, 6, 0.4);

/** The heartbeat line draws down the page as the day progresses; each step lights up when the line reaches it. */
export default function Journey() {
  const root = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const line = useRef<SVGPathElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(line.current, { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: list.current, start: 'top 62%', end: 'bottom 62%', scrub: 0.4 } });
        gsap.utils.toArray<HTMLElement>('[data-step]').forEach((el) => {
          gsap.fromTo(el, { opacity: 0.28, x: 24 }, { opacity: 1, x: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top 82%', end: 'top 56%', scrub: true } });
          gsap.fromTo(el.querySelector('[data-node]'), { scale: 0.5, backgroundColor: '#CBD6DA' }, { scale: 1, backgroundColor: '#E5484D', ease: 'none', scrollTrigger: { trigger: el, start: 'top 70%', end: 'top 58%', scrub: true } });
        });
        gsap.to('[data-sticky-note]', { yPercent: -30, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="journey" className="relative bg-paper py-24 lg:py-36">
      <div className="mx-auto grid max-w-[88rem] gap-14 px-5 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <LineHeading lines={['One patient,', 'one day, one record.']} className="text-[clamp(2.8rem,5.2vw,5rem)]" />
            <p className="mt-6 max-w-md text-lg text-graphite">Every step writes to the same record, so nobody re-types what the last desk already knows.</p>
            <div data-sticky-note aria-hidden className="mt-10 hidden w-56 -rotate-3 rounded-2xl bg-band p-4 text-sm shadow-card lg:block">
              Allergy: penicillin. Shown on the booking, the visit and the prescription.
            </div>
          </div>
        </div>

        <div className="relative lg:col-span-7">
          <svg aria-hidden viewBox="0 0 36 1000" preserveAspectRatio="none" className="absolute left-0 top-2 hidden h-[calc(100%-1rem)] w-9 sm:block">
            <g transform="translate(36,0) rotate(90)">
              <path d={V} fill="none" stroke="#CBD6DA" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <path ref={line} d={V} pathLength={1} strokeDasharray={1} fill="none" stroke="#E5484D" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </g>
          </svg>
          <ol ref={list} className="space-y-14 sm:pl-16 lg:space-y-24">
            {STEPS.map((s, i) => (
              <li key={s.title} data-step className="relative">
                <span data-node aria-hidden className="absolute -left-[3.55rem] top-3 hidden h-3.5 w-3.5 rounded-full bg-pulse sm:block" />
                <p className="text-sm font-semibold text-scrub">Step {i + 1}</p>
                <h3 className="display-md mt-1 text-[clamp(2rem,3.4vw,3rem)]">{s.title}</h3>
                <p className="mt-3 max-w-lg text-lg text-graphite">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
