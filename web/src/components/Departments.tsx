'use client';

import { useRef } from 'react';
import { gsap, useGSAP, MOTION_OK, DESKTOP } from '@/lib/gsap';
import LineHeading from './LineHeading';

/** Names, locations and services follow the sample data that ships with the app. */
const DEPTS = [
  { name: 'General Medicine', where: 'Block A, ground floor', text: 'First point of care for adults: check-ups, fevers, chronic conditions.', services: ['General consultation', 'Full health check-up', 'Adult vaccination'] },
  { name: 'Cardiology', where: 'Block B, 2nd floor', text: 'Heart and blood pressure care, with ECG and echo on site.', services: ['Cardiology consultation', 'ECG', 'Echocardiogram', 'Treadmill stress test'] },
  { name: 'Paediatrics', where: 'Block A, 1st floor', text: 'Care for babies, children and teenagers, including vaccinations.', services: ['Child consultation', 'Childhood vaccination', 'Growth and development review'] },
  { name: 'Orthopaedics', where: 'Block C, ground floor', text: 'Bones, joints and sports injuries.', services: ['Orthopaedic consultation', 'Cast application', 'Joint injection'] },
  { name: 'Obstetrics and Gynaecology', where: 'Block B, 1st floor', text: 'Pregnancy care, delivery and women’s health.', services: ['Antenatal check', 'Pregnancy ultrasound', 'Cervical screening'] },
  { name: 'Dermatology', where: 'Block A, 2nd floor', text: 'Skin, hair and nail conditions.', services: ['Skin consultation', 'Skin biopsy', 'Chemical peel'] },
  { name: 'Emergency', where: 'Main entrance', text: 'Open all day and night for urgent and life-threatening problems.', services: ['Emergency assessment', 'Wound closure'] },
  { name: 'Radiology', where: 'Block C, basement', text: 'X-ray, ultrasound and CT imaging.', services: ['X-ray', 'Ultrasound scan', 'CT scan'] },
];

/** On desktop the section pins and the departments slide past sideways as you scroll. */
export default function Departments() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(`${MOTION_OK} and ${DESKTOP}`, () => {
        const dist = () => track.current!.scrollWidth - window.innerWidth;
        gsap.to(track.current, {
          x: () => -dist(),
          ease: 'none',
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: () => `+=${dist()}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              if (fill.current) fill.current.style.transform = `scaleX(${self.progress})`;
            },
          },
        });
        // Each department name leans in as it crosses the viewport.
        gsap.utils.toArray<HTMLElement>('[data-dept-name]').forEach((el) => {
          gsap.fromTo(el, { xPercent: 12 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: el.closest('[data-dept]'), containerAnimation: gsap.getTweensOf(track.current)[0], start: 'left 100%', end: 'right 0%', scrub: true } });
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="departments" className="relative bg-ink text-paper lg:h-screen lg:overflow-hidden motion-reduce:lg:h-auto motion-reduce:lg:overflow-visible">
      <div className="px-5 pt-24 sm:px-8 lg:absolute lg:inset-x-0 lg:top-0 lg:z-10 lg:pt-20 motion-reduce:lg:static">
        <div className="mx-auto max-w-[88rem]">
          <LineHeading lines={['Eight departments,', 'each with its own services.']} tone="light" className="text-[clamp(2.4rem,4.2vw,4rem)]" />
        </div>
      </div>
      <div ref={track} className="flex flex-col gap-0 pb-24 pt-10 lg:h-full lg:w-max lg:flex-row lg:items-center lg:gap-0 lg:pb-10 lg:pl-[max(2rem,calc((100vw-88rem)/2+2rem))] lg:pt-28 motion-reduce:lg:h-auto motion-reduce:lg:w-auto motion-reduce:lg:flex-wrap motion-reduce:lg:items-start motion-reduce:lg:px-8 motion-reduce:lg:pt-10">
        {DEPTS.map((d) => (
          <article key={d.name} data-dept className="border-t border-paper/15 px-5 py-10 sm:px-8 lg:w-[34rem] lg:shrink-0 lg:border-l lg:border-t-0 lg:px-10 lg:py-0 motion-reduce:lg:w-1/2 motion-reduce:lg:border-l-0 motion-reduce:lg:border-t motion-reduce:lg:py-10">
            <h3 data-dept-name className="display text-[clamp(2.6rem,4.4vw,4.4rem)] text-paper">{d.name}</h3>
            <p className="mt-2 text-sm text-band">{d.where}</p>
            <p className="mt-4 max-w-sm text-paper/75">{d.text}</p>
            <ul className="mt-6 divide-y divide-paper/15 border-y border-paper/15">
              {d.services.map((s) => (
                <li key={s} className="py-2.5 text-[0.98rem]">{s}</li>
              ))}
            </ul>
          </article>
        ))}
        <div aria-hidden className="hidden lg:block lg:w-[20vw] lg:shrink-0 motion-reduce:lg:hidden" />
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 hidden h-1 bg-paper/10 lg:block motion-reduce:lg:hidden">
        <div ref={fill} className="h-full origin-left scale-x-0 bg-pulse" />
      </div>
    </section>
  );
}
