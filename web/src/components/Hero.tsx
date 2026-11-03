'use client';

import { useRef } from 'react';
import { motion } from 'motion/react';
import { gsap, useGSAP, MOTION_OK } from '@/lib/gsap';
import { LINKS } from '@/lib/site';
import { scrollToId } from '@/lib/lenis';
import { trace } from '@/lib/ecg';
import Magnetic from './Magnetic';

const { d: TRACE } = trace(600, 180, 3, 0.4);
const LINES = ['Every patient,', 'seen on time.'];

const rise = { hidden: { y: '108%' }, show: { y: 0 } };

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const live = useRef<SVGPathElement>(null);
  const hr = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        // The bright segment of the trace sweeps along the full trace, like a bedside monitor.
        const len = live.current!.getTotalLength();
        const seg = len * 0.3;
        gsap.set(live.current, { strokeDasharray: `${seg} ${len}`, strokeDashoffset: seg });
        gsap.to(live.current, { strokeDashoffset: -len, duration: 3.6, ease: 'none', repeat: -1 });
        // Heart rate drifts a little between beats.
        const rate = { v: 72 };
        gsap.to(rate, {
          v: 74,
          duration: 1.8,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          onUpdate: () => {
            if (hr.current) hr.current.textContent = String(Math.round(rate.v));
          },
        });
        // Scroll parallax: monitor and chips drift at different speeds.
        gsap.utils.toArray<HTMLElement>('[data-par]').forEach((el) => {
          gsap.to(el, { yPercent: parseFloat(el.dataset.par!), ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true } });
        });
        gsap.to('[data-ghost]', { xPercent: -14, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true } });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="top" className="relative overflow-hidden pb-24 pt-32 lg:pb-36 lg:pt-44">
      <svg data-ghost aria-hidden viewBox="0 0 1800 300" className="pointer-events-none absolute -right-40 top-24 w-[120rem] max-w-none opacity-[0.07]">
        <path d={trace(1800, 300, 6, 0.45).d} fill="none" stroke="#0F2A33" strokeWidth={5} strokeLinejoin="round" />
      </svg>
      <div className="relative mx-auto grid max-w-[88rem] items-center gap-16 px-5 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <motion.h1 initial="hidden" animate="show" transition={{ staggerChildren: 0.12 }} aria-label={LINES.join(' ')} className="display text-[clamp(3.6rem,9.2vw,9rem)] text-ink">
            {LINES.map((l) => (
              <span key={l} aria-hidden className="-mb-[0.08em] block overflow-hidden pb-[0.08em]">
                <motion.span variants={rise} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="block">
                  {l}
                </motion.span>
              </span>
            ))}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.8 }}
            className="mt-8 max-w-xl text-xl text-graphite"
          >
            Carewell runs the hospital day in one place: booking with live slots, consultations, pharmacy, lab, beds and billing.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.8 }} className="mt-10 flex flex-wrap items-center gap-4">
            <Magnetic href={LINKS.login} className="btn btn-ink">
              Open Carewell
            </Magnetic>
            <a href="#booking" onClick={(e) => { e.preventDefault(); scrollToId('booking'); }} className="btn btn-line">
              Try the booking demo
            </a>
          </motion.div>
        </div>

        <div className="relative lg:col-span-5">
          <motion.div data-par="-8" initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.35, duration: 1, ease: [0.16, 1, 0.3, 1] }}>
            <div className="rounded-3xl bg-ink p-5 shadow-pop sm:p-7">
              <div className="mb-3 flex items-center justify-between text-xs text-paper/60">
                <span className="vitals">Bed 04 · Cardiac care</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-pulse motion-safe:animate-pulse" /> Live</span>
              </div>
              <svg viewBox="0 0 600 180" className="w-full" role="img" aria-label="Heartbeat trace">
                <g stroke="#ffffff" strokeOpacity="0.07">
                  {[30, 60, 90, 120, 150].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} />)}
                  {[100, 200, 300, 400, 500].map((x) => <line key={x} y1="0" y2="180" x1={x} x2={x} />)}
                </g>
                <path d={TRACE} fill="none" stroke="#E5484D" strokeOpacity="0.28" strokeWidth="2.5" strokeLinejoin="round" />
                <path ref={live} d={TRACE} fill="none" stroke="#FF6B70" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-paper/10 pt-4 text-paper">
                <div>
                  <dt className="text-xs text-paper/60">Heart rate</dt>
                  <dd className="vitals text-4xl font-medium text-[#FF6B70]"><span ref={hr}>72</span><span className="ml-1 text-sm text-paper/50">bpm</span></dd>
                </div>
                <div>
                  <dt className="text-xs text-paper/60">Oxygen</dt>
                  <dd className="vitals text-4xl font-medium text-band">98<span className="ml-1 text-sm text-paper/50">%</span></dd>
                </div>
                <div>
                  <dt className="text-xs text-paper/60">Pressure</dt>
                  <dd className="vitals text-4xl font-medium">118<span className="text-xl text-paper/50">/76</span></dd>
                </div>
              </dl>
            </div>
          </motion.div>
          <p className="mt-3 text-sm text-graphite">Sample vitals for illustration.</p>

          <div data-par="-26" className="absolute -left-6 -top-6 hidden sm:block lg:-left-14">
            <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.1, type: 'spring', stiffness: 260, damping: 18 }}>
              <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }} className="-rotate-3 rounded-2xl bg-band px-4 py-3 text-sm font-semibold shadow-card">
                09:40 slot booked
                <div className="text-xs font-normal text-ink/70">Dr. Sharma, Cardiology</div>
              </motion.div>
            </motion.div>
          </div>
          <div data-par="-14" className="absolute -bottom-8 right-0 hidden sm:block lg:-right-6">
            <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.3, type: 'spring', stiffness: 260, damping: 18 }}>
              <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }} className="rotate-2 rounded-2xl bg-paper px-4 py-3 text-sm shadow-card">
                <span className="font-semibold">Lab result</span>
                <div className="flex items-center gap-2 text-xs text-graphite">Fasting blood sugar <span className="rounded-full bg-scrub/15 px-2 py-0.5 font-medium text-scrub">Normal</span></div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
