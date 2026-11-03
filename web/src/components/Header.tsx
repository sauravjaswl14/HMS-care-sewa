'use client';

import { useState } from 'react';
import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import { scrollToId } from '@/lib/lenis';
import { LINKS } from '@/lib/site';
import Logo from './Logo';

const NAV = [
  { id: 'booking', label: 'Booking' },
  { id: 'departments', label: 'Departments' },
  { id: 'journey', label: 'A patient’s day' },
  { id: 'modules', label: 'Modules' },
  { id: 'faq', label: 'Questions' },
];

/** Slides away while you read down and returns the moment you scroll up. Built with Motion. */
export default function Header() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(y > prev && y > 320);
    setSolid(y > 24);
  });
  return (
    <motion.header
      animate={{ y: hidden ? '-110%' : 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${solid ? 'bg-box/90 shadow-[0_1px_0_#CBD6DA] backdrop-blur' : 'bg-transparent'}`}
    >
      <div className="mx-auto flex h-[4.25rem] max-w-[88rem] items-center justify-between px-5 sm:px-8">
        <a href="#top" aria-label="Back to top" onClick={(e) => { e.preventDefault(); scrollToId('top'); }}>
          <Logo />
        </a>
        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={(e) => { e.preventDefault(); scrollToId(n.id); }}
              className="relative text-[0.95rem] font-medium text-graphite transition-colors hover:text-ink"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <a href={LINKS.login} className="btn btn-ink !px-5 !py-2.5 !text-[0.95rem]">
          Open Carewell
        </a>
      </div>
    </motion.header>
  );
}
