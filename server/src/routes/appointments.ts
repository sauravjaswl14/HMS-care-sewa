import { Router, Request } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma, Tx } from '../lib/prisma';
import { authorize } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { audit } from '../lib/crud';
import { nextNumber } from '../lib/numbers';
import { P } from '../lib/permissions';
import { config } from '../config';
import { bookSchema } from '../lib/schemas';
import { APPOINTMENT_FLOW, buildDaySlots, RELEASES_SLOT, slotKey, weekdayOf, zonedToUtc } from '../lib/slots';

export const appointmentsRouter = Router();

const include = {
  patient: { select: { id: true, mrn: true, firstName: true, lastName: true, phone: true } },
  doctor: { select: { id: true, name: true, specialization: true } },
  department: { select: { id: true, name: true } },
  service: { select: { id: true, name: true, price: true } },
  encounter: { select: { id: true, status: true } },
} as const;

const dayRange = (date: string) => {
  const start = zonedToUtc(date, '00:00', config.clinicTimezone);
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start, end: zonedToUtc(next.toISOString().slice(0, 10), '00:00', config.clinicTimezone) };
};

/** All slots of one doctor on one date, with availability. */
async function daySlots(doctorId: string, date: string, now = new Date(), db: Tx | typeof prisma = prisma) {
  const { start, end } = dayRange(date);
  const [blocks, held, timeOff] = await Promise.all([
    db.doctorSchedule.findMany({ where: { doctorId, weekday: weekdayOf(date) } }),
    db.appointment.findMany({ where: { doctorId, slotKey: { not: null }, startsAt: { gte: start, lt: end } }, select: { startsAt: true } }),
    db.doctorTimeOff.findMany({ where: { doctorId, startsAt: { lt: end }, endsAt: { gt: start } } }),
  ]);
  return buildDaySlots({ date, tz: config.clinicTimezone, blocks, booked: held.map((h) => h.startsAt), timeOff, now });
}

/** Checks that `time` on `date` is a real, free slot of the doctor and returns its window. */
async function resolveSlot(doctorId: string, date: string, time: string) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor || !doctor.isActive) throw new HttpError(404, 'Doctor not found or not taking appointments');
  const slot = (await daySlots(doctorId, date)).find((s) => s.time === time);
  if (!slot) throw new HttpError(400, `${time} is not in this doctor's schedule on ${date}`);
  if (!slot.available) {
    const why = { booked: 'That slot is already booked', past: 'That time has already passed', time_off: 'The doctor is away at that time' }[slot.reason!];
    throw new HttpError(409, why);
  }
  return { doctor, startsAt: slot.startsAt, endsAt: slot.endsAt };
}

/** A doctor account only ever sees and changes its own appointments. */
const ownDoctor = (req: Request) => (req.user!.role === 'DOCTOR' ? req.user!.doctorId ?? '__none__' : undefined);

async function loadVisible(req: Request, id: string) {
  const appt = await prisma.appointment.findUnique({ where: { id }, include });
  const own = ownDoctor(req);
  if (!appt || (own && appt.doctorId !== own)) throw new HttpError(404, 'Appointment not found');
  return appt;
}

const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

appointmentsRouter.get(
  '/availability',
  authorize(...P.appointments.read),
  asyncHandler(async (req, res) => {
    const { doctorId, date } = z.object({ doctorId: z.string().min(1), date: dateParam }).parse(req.query);
    const slots = await daySlots(doctorId, date);
    res.json({ date, timezone: config.clinicTimezone, slots: slots.map((s) => ({ time: s.time, startsAt: s.startsAt, available: s.available, reason: s.reason ?? null })) });
  }),
);

appointmentsRouter.get(
  '/',
  authorize(...P.appointments.read),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 20));
    const where: Prisma.AppointmentWhereInput = {};
    const own = ownDoctor(req);
    if (own) where.doctorId = own;
    else if (typeof req.query.doctorId === 'string' && req.query.doctorId) where.doctorId = req.query.doctorId;
    for (const f of ['status', 'patientId', 'departmentId'] as const) {
      const v = req.query[f];
      if (typeof v === 'string' && v) (where as Record<string, unknown>)[f] = v;
    }
    if (typeof req.query.date === 'string' && req.query.date) {
      const { start, end } = dayRange(dateParam.parse(req.query.date));
      where.startsAt = { gte: start, lt: end };
    }
    const q = String(req.query.q ?? '').trim();
    if (q) {
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { patient: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { mrn: { contains: q, mode: 'insensitive' } }] } },
      ];
    }
    const upcoming = req.query.sort === 'asc';
    const [data, total] = await Promise.all([
      prisma.appointment.findMany({ where, include, orderBy: { startsAt: upcoming ? 'asc' : 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.appointment.count({ where }),
    ]);
    res.json({ data, total, page, pageSize });
  }),
);

appointmentsRouter.get(
  '/:id',
  authorize(...P.appointments.read),
  asyncHandler(async (req, res) => res.json(await loadVisible(req, req.params.id))),
);

appointmentsRouter.post(
  '/',
  authorize(...P.appointments.write),
  asyncHandler(async (req, res) => {
    const body = bookSchema.parse(req.body);
    const own = ownDoctor(req);
    if (own && body.doctorId !== own) throw new HttpError(403, 'Doctors can only book into their own schedule');
    const patient = await prisma.patient.findUnique({ where: { id: body.patientId }, select: { id: true } });
    if (!patient) throw new HttpError(404, 'Patient not found');
    const { doctor, startsAt, endsAt } = await resolveSlot(body.doctorId, body.date, body.time);
    if (body.serviceId) {
      const svc = await prisma.service.findUnique({ where: { id: body.serviceId } });
      if (!svc || !svc.isActive || svc.departmentId !== doctor.departmentId) {
        throw new HttpError(400, "Choose a service offered by this doctor's department");
      }
    }
    const clash = await prisma.appointment.findFirst({ where: { patientId: body.patientId, startsAt, slotKey: { not: null } }, select: { number: true } });
    if (clash) throw new HttpError(409, `This patient already has appointment ${clash.number} at that time`);

    try {
      const appt = await prisma.$transaction(async (tx) =>
        tx.appointment.create({
          data: {
            number: await nextNumber(tx, 'appointment', 'APT'),
            patientId: body.patientId,
            doctorId: doctor.id,
            departmentId: doctor.departmentId,
            serviceId: body.serviceId ?? null,
            startsAt,
            endsAt,
            reason: body.reason,
            slotKey: slotKey(doctor.id, startsAt),
            createdById: req.user!.id,
          },
          include,
        }),
      );
      await audit(req, 'BOOK', 'appointment', appt.id);
      res.status(201).json(appt);
    } catch (e) {
      // Someone else took the slot between the check above and the insert; the unique slotKey caught it.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new HttpError(409, 'That slot was just booked by someone else. Pick another time.');
      throw e;
    }
  }),
);

appointmentsRouter.post(
  '/:id/reschedule',
  authorize(...P.appointments.write),
  asyncHandler(async (req, res) => {
    const { date, time } = z.object({ date: dateParam, time: bookSchema.shape.time }).parse(req.body);
    const appt = await loadVisible(req, req.params.id);
    if (!['SCHEDULED', 'CHECKED_IN'].includes(appt.status)) throw new HttpError(400, 'Only a scheduled or checked-in appointment can be moved');
    const { startsAt, endsAt } = await resolveSlot(appt.doctorId, date, time);
    try {
      const updated = await prisma.appointment.update({
        where: { id: appt.id },
        data: { startsAt, endsAt, slotKey: slotKey(appt.doctorId, startsAt), status: 'SCHEDULED' },
        include,
      });
      await audit(req, 'RESCHEDULE', 'appointment', appt.id);
      res.json(updated);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new HttpError(409, 'That slot was just booked by someone else. Pick another time.');
      throw e;
    }
  }),
);

const ROLE_MOVES: Record<string, string[]> = {
  // Who may move an appointment into each status. ADMIN may do all of them.
  CHECKED_IN: ['RECEPTIONIST', 'NURSE'],
  IN_PROGRESS: ['DOCTOR'],
  COMPLETED: ['DOCTOR'],
  CANCELLED: ['RECEPTIONIST', 'DOCTOR'],
  NO_SHOW: ['RECEPTIONIST', 'NURSE'],
};

appointmentsRouter.post(
  '/:id/status',
  authorize(...P.appointments.write),
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']) }).parse(req.body);
    const appt = await loadVisible(req, req.params.id);
    if (!APPOINTMENT_FLOW[appt.status].includes(status)) {
      throw new HttpError(400, `An appointment that is ${appt.status.toLowerCase().replace('_', ' ')} cannot become ${status.toLowerCase().replace('_', ' ')}`);
    }
    if (req.user!.role !== 'ADMIN' && !ROLE_MOVES[status].includes(req.user!.role)) {
      throw new HttpError(403, 'Your role cannot make this change');
    }
    // Guarded by the current status so two people clicking at once cannot both win.
    const r = await prisma.appointment.updateMany({
      where: { id: appt.id, status: appt.status },
      data: { status, ...(RELEASES_SLOT.has(status) ? { slotKey: null } : {}) },
    });
    if (r.count === 0) throw new HttpError(409, 'This appointment was just changed by someone else. Refresh and try again.');
    await audit(req, status, 'appointment', appt.id);
    res.json(await loadVisible(req, appt.id));
  }),
);
