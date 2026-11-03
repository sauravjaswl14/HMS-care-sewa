'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import LineHeading from './LineHeading';

const ITEMS = [
  { q: 'Is it for one hospital or many?', a: 'One hospital per installation. Branches or separate companies would each run their own copy; there is no shared multi-tenant mode.' },
  { q: 'Who can see what?', a: 'There are seven staff roles and an administrator. The server checks the role on every request, and the app hides pages a role can’t open. A doctor with a linked login only sees their own appointments and visits.' },
  { q: 'How are appointment times worked out?', a: 'From each doctor’s weekly working hours and slot length, read in the hospital’s time zone. Time away blocks slots, and past times can’t be booked.' },
  { q: 'What does it run on?', a: 'Node and Express with Prisma on PostgreSQL for the server, and React with TypeScript and Tailwind for the app. You host it yourself.' },
  { q: 'What isn’t included yet?', a: 'A patient self-service portal, SMS or email reminders, insurance claim processing, medical imaging storage, and multiple branches. The booking logic has unit tests; most other workflows don’t have automated tests yet.' },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="bg-box py-24 lg:py-36">
      <div className="mx-auto grid max-w-[88rem] gap-14 px-5 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <LineHeading lines={['Questions,', 'answered plainly.']} className="text-[clamp(2.8rem,4.6vw,4.4rem)]" />
        </div>
        <div className="lg:col-span-8">
          {ITEMS.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={it.q} className="border-t border-ink/80 last:border-b">
                <h3>
                  <button type="button" aria-expanded={isOpen} aria-controls={`faq-${i}`} onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center justify-between gap-6 py-6 text-left">
                    <span className="display-md text-[1.5rem] sm:text-[1.9rem]">{it.q}</span>
                    <motion.svg animate={{ rotate: isOpen ? 45 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-pulse" aria-hidden>
                      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                    </motion.svg>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div id={`faq-${i}`} role="region" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                      <p className="max-w-2xl pb-7 text-lg text-graphite">{it.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
