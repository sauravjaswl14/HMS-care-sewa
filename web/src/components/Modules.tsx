'use client';

import { motion, useReducedMotion } from 'motion/react';
import LineHeading from './LineHeading';

const item = { hidden: { opacity: 0, y: 36 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 20 } } };

function Tile({ title, text, className = '', children }: { title: string; text: string; className?: string; children?: React.ReactNode }) {
  return (
    <motion.div variants={item} whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} className={`flex flex-col justify-between overflow-hidden rounded-3xl bg-paper p-6 shadow-card sm:p-7 ${className}`}>
      <div>
        <h3 className="display-md text-[1.7rem]">{title}</h3>
        <p className="mt-2 max-w-sm text-[0.98rem] text-graphite">{text}</p>
      </div>
      <div className="mt-6">{children}</div>
    </motion.div>
  );
}

const BEDS = ['o', 'o', 'a', 'o', 'a', 'a', 'm', 'o', 'a', 'o', 'a', 'a'];
const BED_COLOR: Record<string, string> = { o: '#9CC9E8', a: '#9DD6B7', m: '#F5D547' };
const ROLES: [string, string][] = [['Administrator', '#0F2A33'], ['Doctor', '#1F7A6B'], ['Nurse', '#6FB7A8'], ['Receptionist', '#F5D547'], ['Pharmacist', '#E5484D'], ['Lab technician', '#9CC9E8'], ['Billing', '#CBD6DA']];

export default function Modules() {
  const still = useReducedMotion();
  return (
    <section id="modules" className="bg-box py-24 lg:py-36">
      <div className="mx-auto max-w-[88rem] px-5 sm:px-8">
        <LineHeading lines={['Everything a hospital', 'does in a day.']} className="text-[clamp(3rem,6vw,5.6rem)]" />
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} transition={{ staggerChildren: 0.09 }} className="mt-14 grid gap-5 lg:grid-cols-6">
          <Tile className="lg:col-span-4" title="Patients and records" text="One record per person with a medical record number, allergies, blood group, emergency contact and insurance. Records are never deleted.">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-box p-4 text-sm">
              <span className="vitals text-graphite">MRN-00001</span>
              <b>Sanjay Basnet</b>
              <span className="text-graphite">40 y · male · O+</span>
              <span className="rounded-full bg-pulse px-3 py-1 text-xs font-semibold text-paper">Allergy: penicillin</span>
            </div>
          </Tile>
          <Tile className="lg:col-span-2" title="Appointments" text="Live slots from working hours, check-in, reschedule, no-show.">
            <div className="grid grid-cols-4 gap-1.5">
              {['09:00', '09:20', '09:40', '10:00', '10:20', '10:40', '11:00', '11:20'].map((t, i) => (
                <span key={t} className={`vitals rounded-lg py-1.5 text-center text-[0.7rem] ${i === 2 ? 'bg-band font-medium' : i === 1 || i === 5 ? 'bg-box text-graphite/40 line-through' : 'border border-rule'}`}>{t}</span>
              ))}
            </div>
          </Tile>
          <Tile className="lg:col-span-2" title="Consultations" text="Vitals, diagnosis, notes and follow-up. A closed visit can’t be edited.">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[['BP', '118/76'], ['Pulse', '72'], ['SpO₂', '98']].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-box py-2"><div className="text-[0.65rem] text-graphite">{k}</div><div className="vitals text-lg font-medium">{v}</div></div>
              ))}
            </div>
          </Tile>
          <Tile className="lg:col-span-2" title="Pharmacy" text="Prescriptions are dispensed in full or not at all, and stock can’t go below zero.">
            <div className="relative flex h-20 items-end gap-2">
              <span aria-hidden className="absolute inset-x-0 bottom-[34%] border-t border-dashed border-pulse" />
              {[78, 52, 20, 64, 30].map((h, i) => (
                <motion.span key={i} initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.07, type: 'spring', stiffness: 140, damping: 18 }} style={{ height: `${h}%`, originY: 1 }} className={`flex-1 rounded-t-md ${h < 34 ? 'bg-pulse' : 'bg-scrub'}`} />
              ))}
            </div>
          </Tile>
          <Tile className="lg:col-span-2" title="Laboratory" text="Order, collect, result. Urgent tests are listed first.">
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-scrub/15 px-3 py-1 text-scrub">Normal</span>
              <span className="rounded-full bg-band px-3 py-1">Abnormal</span>
              <span className="rounded-full bg-pulse px-3 py-1 text-paper">Critical</span>
            </div>
          </Tile>
          <Tile className="lg:col-span-3" title="Wards and beds" text="Admit to a free bed, discharge with a summary, and take a bed out for maintenance. One bed can’t hold two patients.">
            <div className="grid grid-cols-6 gap-2">
              {BEDS.map((b, i) => (
                <motion.span
                  key={i}
                  className="aspect-[4/3] rounded-md"
                  style={{ backgroundColor: BED_COLOR[b] }}
                  animate={still || (i !== 2 && i !== 4) ? undefined : { backgroundColor: i === 2 ? [BED_COLOR.a, BED_COLOR.o, BED_COLOR.a] : [BED_COLOR.a, BED_COLOR.m, BED_COLOR.a] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                />
              ))}
            </div>
          </Tile>
          <Tile className="lg:col-span-3" title="Billing" text="Bill a visit or a stay, take payments by cash, card, insurance or online. A payment can’t exceed the balance.">
            <div className="rounded-2xl bg-box p-4 text-sm">
              <div className="flex justify-between"><span>Consultation, Dr. Sharma</span><span className="vitals">90.00</span></div>
              <div className="flex justify-between"><span>ECG</span><span className="vitals">45.00</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-rule">
                <motion.div initial={{ width: 0 }} whileInView={{ width: '60%' }} viewport={{ once: true }} transition={{ delay: 0.4, duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-scrub" />
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-graphite"><span>Partly paid</span><span className="vitals">81.00 of 135.00</span></div>
            </div>
          </Tile>
          <Tile className="lg:col-span-6" title="Access and audit" text="Seven staff roles plus an administrator. The server checks the role on every request, and sign-ins, bookings, dispensing and payments are written to an audit log.">
            <div className="flex flex-wrap gap-2.5">
              {ROLES.map(([r, c], i) => (
                <motion.span key={r} whileHover={{ rotate: i % 2 ? 3 : -3, y: -4 }} style={{ backgroundColor: c }} className={`rounded-full px-4 py-2 text-sm font-semibold ${c === '#0F2A33' || c === '#1F7A6B' || c === '#E5484D' ? 'text-paper' : 'text-ink'}`}>
                  {r}
                </motion.span>
              ))}
            </div>
          </Tile>
        </motion.div>
      </div>
    </section>
  );
}
