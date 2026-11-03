'use client';

import { useRef } from 'react';
import { gsap, useGSAP, MOTION_OK } from '@/lib/gsap';
import { trace } from '@/lib/ecg';

const { d } = trace(1200, 90, 6, 0.46);

/** A full-width heartbeat that draws itself as it scrolls into view. It separates sections. */
export default function Beat({ stroke = '#E5484D', className = '' }: { stroke?: string; className?: string }) {
  const path = useRef<SVGPathElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.fromTo(
        path.current,
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: path.current, start: 'top 92%', end: 'top 35%', scrub: 0.5 } },
      );
    });
    return () => mm.revert();
  });
  return (
    <svg aria-hidden viewBox="0 0 1200 90" preserveAspectRatio="none" className={`block h-[4.5rem] w-full ${className}`}>
      <path ref={path} d={d} pathLength={1} strokeDasharray={1} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
