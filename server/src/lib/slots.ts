/**
 * Appointment slot arithmetic. Pure functions, no database, so the rules are easy to test.
 * Schedules are wall-clock ("09:00") in the clinic's IANA time zone; everything stored is UTC.
 */

export const toMinutes = (hm: string): number => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hm);
  if (!m) throw new Error(`Invalid time "${hm}", expected HH:mm`);
  return Number(m[1]) * 60 + Number(m[2]);
};

export const fromMinutes = (n: number): string => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

export interface Block {
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

/** Start times of every slot that fits completely inside the block. */
export function slotsForBlock(b: Block): string[] {
  const start = toMinutes(b.startTime);
  const end = toMinutes(b.endTime);
  if (b.slotMinutes < 5 || end <= start) return [];
  const out: string[] = [];
  for (let t = start; t + b.slotMinutes <= end; t += b.slotMinutes) out.push(fromMinutes(t));
  return out;
}

/** 0 = Sunday … 6 = Saturday, for a calendar date "YYYY-MM-DD" (independent of any time zone). */
export function weekdayOf(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`);
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) throw new Error(`Invalid date "${date}"`);
  return d.getUTCDay();
}

/** Offset of `tz` from UTC, in minutes, at the given instant. */
function offsetMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const v = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** The UTC instant at which the wall clock in `tz` reads `date` `time`. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  weekdayOf(date);
  const mins = toMinutes(time);
  const naive = Date.parse(`${date}T00:00:00Z`) + mins * 60000;
  // Two passes handle zones whose offset changes (daylight saving) near the requested time.
  let guess = naive - offsetMinutes(new Date(naive), tz) * 60000;
  guess = naive - offsetMinutes(new Date(guess), tz) * 60000;
  return new Date(guess);
}

/** Calendar date, wall-clock time and weekday of an instant in `tz`. */
export function toZoned(at: Date, tz: string): { date: string; time: string; weekday: number } {
  const off = offsetMinutes(at, tz);
  const local = new Date(at.getTime() + off * 60000);
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), weekday: local.getUTCDay() };
}

export interface SlotInfo {
  time: string;
  startsAt: Date;
  endsAt: Date;
  available: boolean;
  reason?: 'booked' | 'past' | 'time_off';
}

interface Interval {
  startsAt: Date;
  endsAt: Date;
}

/**
 * Every slot of the day with its availability.
 * `blocks` are the doctor's schedule rows for that weekday; `booked` the start times held by active appointments.
 */
export function buildDaySlots(opts: {
  date: string;
  tz: string;
  blocks: Block[];
  booked: Date[];
  timeOff: Interval[];
  now: Date;
}): SlotInfo[] {
  const bookedSet = new Set(opts.booked.map((d) => d.getTime()));
  const seen = new Set<string>();
  const out: SlotInfo[] = [];
  for (const b of opts.blocks) {
    for (const time of slotsForBlock(b)) {
      if (seen.has(time)) continue; // overlapping schedule rows must not produce duplicate slots
      seen.add(time);
      const startsAt = zonedToUtc(opts.date, time, opts.tz);
      const endsAt = new Date(startsAt.getTime() + b.slotMinutes * 60000);
      let reason: SlotInfo['reason'];
      if (startsAt.getTime() <= opts.now.getTime()) reason = 'past';
      else if (bookedSet.has(startsAt.getTime())) reason = 'booked';
      else if (opts.timeOff.some((o) => startsAt < o.endsAt && endsAt > o.startsAt)) reason = 'time_off';
      out.push({ time, startsAt, endsAt, available: !reason, reason });
    }
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export const slotKey = (doctorId: string, startsAt: Date) => `${doctorId}|${startsAt.toISOString()}`;

/** Allowed status moves. Anything else is rejected. */
export const APPOINTMENT_FLOW: Record<string, string[]> = {
  SCHEDULED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/** Statuses that no longer hold their slot. */
export const RELEASES_SLOT = new Set(['CANCELLED', 'NO_SHOW']);
