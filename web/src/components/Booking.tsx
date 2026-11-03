'use client';

import { useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import LineHeading from './LineHeading';

/** Illustrative data only: sample doctors and slots. */
const DEPTS = [
  { id: 'gen', name: 'General Medicine', doctors: [{ name: 'Dr. Anita Rai', note: 'Internal medicine', taken: ['09:20', '10:00'] }, { name: 'Dr. Suman Thapa', note: 'Family medicine', taken: ['14:20', '15:00', '15:20'] }] },
  { id: 'card', name: 'Cardiology', doctors: [{ name: 'Dr. Prakash Sharma', note: 'Interventional cardiology', taken: ['10:30', '11:30', '12:00'] }] },
  { id: 'ped', name: 'Paediatrics', doctors: [{ name: 'Dr. Maya Gurung', note: 'Paediatrics', taken: ['09:15', '09:30', '10:15'] }] },
  { id: 'derm', name: 'Dermatology', doctors: [{ name: 'Dr. Binod Adhikari', note: 'Skin and hair', taken: ['13:20', '14:00'] }] },
];

const SLOTS: Record<string, string[]> = {
  gen: ['09:00', '09:20', '09:40', '10:00', '10:20', '10:40', '11:00', '11:20'],
  card: ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'],
  ped: ['09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45'],
  derm: ['13:00', '13:20', '13:40', '14:00', '14:20', '14:40', '15:00', '15:20'],
};

export default function Booking() {
  const [dept, setDept] = useState(DEPTS[0].id);
  const [docIdx, setDocIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [booked, setBooked] = useState<Record<string, string[]>>({});
  const [ticket, setTicket] = useState<{ time: string; doctor: string; dept: string } | null>(null);

  const d = DEPTS.find((x) => x.id === dept)!;
  const doc = d.doctors[Math.min(docIdx, d.doctors.length - 1)];
  const key = `${dept}:${doc.name}`;
  const taken = new Set([...doc.taken, ...(booked[key] ?? [])]);
  const slots = (dept === 'gen' && docIdx === 1 ? ['14:00', '14:20', '14:40', '15:00', '15:20', '15:40', '16:00', '16:20'] : SLOTS[dept]);

  const choose = (id: string) => {
    setDept(id);
    setDocIdx(0);
    setPicked(null);
    setTicket(null);
  };
  const book = () => {
    if (!picked) return;
    setBooked((b) => ({ ...b, [key]: [...(b[key] ?? []), picked] }));
    setTicket({ time: picked, doctor: doc.name, dept: d.name });
    setPicked(null);
  };

  return (
    <section id="booking" className="relative bg-box py-24 lg:py-36">
      <div className="mx-auto grid max-w-[88rem] gap-14 px-5 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <LineHeading lines={['Pick a slot.', 'It’s yours.']} className="text-[clamp(3rem,6vw,5.6rem)]" />
          <p className="mt-6 max-w-md text-lg text-graphite">
            Slots come from each doctor’s working hours. Taken times, past times and time away are greyed out, and two people can never hold the same slot.
          </p>
          <p className="mt-4 max-w-md text-sm text-graphite">Try it. The doctors and times here are samples.</p>
        </div>

        <LayoutGroup>
          <div className="lg:col-span-7">
            <div className="rounded-3xl bg-paper p-5 shadow-card sm:p-8">
              <div role="tablist" aria-label="Department" className="flex flex-wrap gap-x-6 gap-y-2 border-b border-rule pb-1">
                {DEPTS.map((x) => (
                  <button
                    key={x.id}
                    role="tab"
                    aria-selected={dept === x.id}
                    onClick={() => choose(x.id)}
                    className={`relative pb-3 text-[0.95rem] font-semibold transition-colors ${dept === x.id ? 'text-ink' : 'text-graphite hover:text-ink'}`}
                  >
                    {x.name}
                    {dept === x.id && <motion.span layoutId="dept-underline" className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-pulse" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={dept} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }} className="pt-6">
                  <div className="flex flex-wrap gap-3">
                    {d.doctors.map((x, i) => (
                      <button
                        key={x.name}
                        onClick={() => { setDocIdx(i); setPicked(null); }}
                        aria-pressed={docIdx === i}
                        className={`rounded-2xl border-2 px-4 py-2.5 text-left transition-colors ${docIdx === i ? 'border-ink bg-ink text-paper' : 'border-rule hover:border-ink'}`}
                      >
                        <span className="block font-semibold">{x.name}</span>
                        <span className={`block text-xs ${docIdx === i ? 'text-paper/70' : 'text-graphite'}`}>{x.note}</span>
                      </button>
                    ))}
                  </div>

                  <p className="mb-3 mt-7 text-sm font-semibold text-graphite">Tomorrow</p>
                  <div role="radiogroup" aria-label="Available times" className="grid grid-cols-4 gap-2.5 sm:grid-cols-4">
                    {slots.map((t, i) => {
                      const off = taken.has(t);
                      const on = picked === t;
                      return (
                        <motion.button
                          key={`${key}-${t}`}
                          role="radio"
                          aria-checked={on}
                          disabled={off}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.03, type: 'spring', stiffness: 380, damping: 26 }}
                          whileHover={off ? undefined : { y: -3 }}
                          whileTap={off ? undefined : { scale: 0.94 }}
                          onClick={() => setPicked(on ? null : t)}
                          className={`vitals rounded-xl border-2 py-3 text-[0.95rem] ${on ? 'border-pulse bg-band text-ink' : off ? 'cursor-not-allowed border-transparent bg-box text-graphite/40 line-through' : 'border-rule bg-paper hover:border-ink'}`}
                        >
                          {t}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-7 flex min-h-[3.25rem] flex-wrap items-center justify-between gap-4 border-t border-rule pt-5">
                <p className="text-sm text-graphite" aria-live="polite">
                  {picked ? <>Booking <b className="text-ink">{picked}</b> with {doc.name}</> : 'Choose a time to book.'}
                </p>
                <motion.button whileTap={{ scale: 0.96 }} disabled={!picked} onClick={book} className="btn btn-ink disabled:cursor-not-allowed disabled:opacity-40">
                  Book appointment
                </motion.button>
              </div>
            </div>

            <AnimatePresence>
              {ticket && (
                <motion.div
                  key={ticket.time + ticket.doctor}
                  initial={{ opacity: 0, y: 30, rotate: -3, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, rotate: -1.2, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="relative mt-6 rounded-2xl bg-band p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="display-md text-3xl">Booked.</p>
                    <span className="vitals text-sm">APT-00042</span>
                  </div>
                  <p className="mt-1 text-ink/80">{ticket.doctor}, {ticket.dept}, tomorrow at <b className="vitals">{ticket.time}</b>.</p>
                  <p className="mt-2 text-sm text-ink/70">That slot is now greyed out for everyone else. If two receptionists click at the same moment, the database accepts one and tells the other to pick another time.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      </div>
    </section>
  );
}
