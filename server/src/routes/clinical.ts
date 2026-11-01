import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authorize } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { audit } from '../lib/crud';
import { nextNumber } from '../lib/numbers';
import { P } from '../lib/permissions';
import { encounterSchema, labOrderSchema, labResultSchema, prescriptionSchema } from '../lib/schemas';

export const clinicalRouter = Router();

const patientBrief = { select: { id: true, mrn: true, firstName: true, lastName: true, dateOfBirth: true, gender: true, allergies: true, bloodGroup: true } } as const;

const encounterInclude = {
  patient: patientBrief,
  doctor: { select: { id: true, name: true } },
  appointment: { select: { id: true, number: true, startsAt: true, status: true, reason: true } },
  prescriptions: { include: { items: { include: { medicine: { select: { name: true, strength: true, form: true } } } } }, orderBy: { createdAt: 'desc' as const } },
  labOrders: { include: { test: { select: { name: true, code: true, normalRange: true } } }, orderBy: { createdAt: 'desc' as const } },
} as const;

const isOwnOrAdmin = (req: Request, doctorId: string) => req.user!.role !== 'DOCTOR' || req.user!.doctorId === doctorId;

// ── Encounters ──────────────────────────────────────────────────────────────

clinicalRouter.get(
  '/encounters',
  authorize(...P.encounters.read),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 15));
    const where: Record<string, unknown> = {};
    for (const f of ['status', 'patientId'] as const) if (typeof req.query[f] === 'string' && req.query[f]) where[f] = req.query[f];
    if (req.user!.role === 'DOCTOR') where.doctorId = req.user!.doctorId ?? '__none__';
    const [data, total] = await Promise.all([
      prisma.encounter.findMany({ where, include: { patient: patientBrief, doctor: { select: { id: true, name: true } }, appointment: { select: { number: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.encounter.count({ where }),
    ]);
    res.json({ data, total, page, pageSize });
  }),
);

clinicalRouter.get(
  '/encounters/:id',
  authorize(...P.encounters.read),
  asyncHandler(async (req, res) => {
    const enc = await prisma.encounter.findUnique({ where: { id: req.params.id }, include: encounterInclude });
    if (!enc || !isOwnOrAdmin(req, enc.doctorId)) throw new HttpError(404, 'Visit not found');
    res.json(enc);
  }),
);

/** Starts (or resumes) the clinical record for a checked-in appointment. */
clinicalRouter.post(
  '/encounters/start',
  authorize('DOCTOR'),
  asyncHandler(async (req, res) => {
    const { appointmentId } = z.object({ appointmentId: z.string().min(1) }).parse(req.body);
    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { encounter: true } });
    if (!appt || !isOwnOrAdmin(req, appt.doctorId)) throw new HttpError(404, 'Appointment not found');
    if (appt.encounter) return res.json(appt.encounter);
    if (appt.status !== 'CHECKED_IN') throw new HttpError(400, 'The patient must be checked in before the visit can start');
    const enc = await prisma.$transaction(async (tx) => {
      const moved = await tx.appointment.updateMany({ where: { id: appt.id, status: 'CHECKED_IN' }, data: { status: 'IN_PROGRESS' } });
      if (moved.count === 0) throw new HttpError(409, 'This appointment was just changed by someone else');
      return tx.encounter.create({ data: { appointmentId: appt.id, patientId: appt.patientId, doctorId: appt.doctorId, complaint: appt.reason } });
    });
    await audit(req, 'START', 'encounter', enc.id);
    return res.status(201).json(enc);
  }),
);

clinicalRouter.patch(
  '/encounters/:id',
  authorize(...P.encounters.write),
  asyncHandler(async (req, res) => {
    const enc = await prisma.encounter.findUnique({ where: { id: req.params.id } });
    if (!enc || !isOwnOrAdmin(req, enc.doctorId)) throw new HttpError(404, 'Visit not found');
    if (enc.status === 'CLOSED') throw new HttpError(400, 'A closed visit can no longer be edited');
    const data = encounterSchema.partial().parse(req.body);
    // Nurses record vitals and the complaint; the diagnosis and plan are the doctor's.
    if (req.user!.role === 'NURSE' && (data.diagnosis !== undefined || data.notes !== undefined || data.followUpOn !== undefined)) {
      throw new HttpError(403, 'Nurses can record vitals and the complaint only');
    }
    const row = await prisma.encounter.update({ where: { id: enc.id }, data, include: encounterInclude });
    await audit(req, 'UPDATE', 'encounter', enc.id);
    res.json(row);
  }),
);

clinicalRouter.post(
  '/encounters/:id/close',
  authorize('DOCTOR'),
  asyncHandler(async (req, res) => {
    const enc = await prisma.encounter.findUnique({ where: { id: req.params.id } });
    if (!enc || !isOwnOrAdmin(req, enc.doctorId)) throw new HttpError(404, 'Visit not found');
    if (enc.status === 'CLOSED') throw new HttpError(400, 'This visit is already closed');
    if (!enc.diagnosis) throw new HttpError(400, 'Record a diagnosis before closing the visit');
    await prisma.$transaction(async (tx) => {
      await tx.encounter.update({ where: { id: enc.id }, data: { status: 'CLOSED', closedAt: new Date() } });
      if (enc.appointmentId) await tx.appointment.updateMany({ where: { id: enc.appointmentId, status: 'IN_PROGRESS' }, data: { status: 'COMPLETED' } });
    });
    await audit(req, 'CLOSE', 'encounter', enc.id);
    res.json(await prisma.encounter.findUnique({ where: { id: enc.id }, include: encounterInclude }));
  }),
);

// ── Prescriptions ───────────────────────────────────────────────────────────

const rxInclude = {
  patient: patientBrief,
  items: { include: { medicine: { select: { id: true, name: true, strength: true, form: true, stock: true, unitPrice: true } } } },
  encounter: { select: { doctor: { select: { name: true } } } },
} as const;

clinicalRouter.get(
  '/prescriptions',
  authorize(...P.prescriptions.read),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 15));
    const where: Record<string, unknown> = {};
    for (const f of ['status', 'patientId'] as const) if (typeof req.query[f] === 'string' && req.query[f]) where[f] = req.query[f];
    const [data, total] = await Promise.all([
      prisma.prescription.findMany({ where, include: rxInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.prescription.count({ where }),
    ]);
    res.json({ data, total, page, pageSize });
  }),
);

clinicalRouter.post(
  '/prescriptions',
  authorize(...P.prescriptions.write),
  asyncHandler(async (req, res) => {
    const body = prescriptionSchema.parse(req.body);
    const enc = await prisma.encounter.findUnique({ where: { id: body.encounterId } });
    if (!enc || !isOwnOrAdmin(req, enc.doctorId)) throw new HttpError(404, 'Visit not found');
    if (enc.status !== 'OPEN') throw new HttpError(400, 'Prescriptions can only be added to an open visit');
    const ids = [...new Set(body.items.map((i) => i.medicineId))];
    const meds = await prisma.medicine.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } });
    if (meds.length !== ids.length) throw new HttpError(400, 'One of the medicines is unknown or no longer in use');
    const rx = await prisma.$transaction(async (tx) =>
      tx.prescription.create({
        data: {
          number: await nextNumber(tx, 'prescription', 'RX'),
          encounterId: enc.id,
          patientId: enc.patientId,
          notes: body.notes,
          items: { create: body.items },
        },
        include: rxInclude,
      }),
    );
    await audit(req, 'CREATE', 'prescription', rx.id);
    res.status(201).json(rx);
  }),
);

/** Hands the medicines over: stock is reduced atomically, and the whole thing fails if any line is short. */
clinicalRouter.post(
  '/prescriptions/:id/dispense',
  authorize('PHARMACIST'),
  asyncHandler(async (req, res) => {
    const rx = await prisma.prescription.findUnique({ where: { id: req.params.id }, include: { items: { include: { medicine: { select: { name: true } } } } } });
    if (!rx) throw new HttpError(404, 'Prescription not found');
    if (rx.status !== 'PENDING') throw new HttpError(400, `This prescription is already ${rx.status.toLowerCase()}`);
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.prescription.updateMany({ where: { id: rx.id, status: 'PENDING' }, data: { status: 'DISPENSED', dispensedAt: new Date() } });
      if (claimed.count === 0) throw new HttpError(409, 'This prescription was just dispensed by someone else');
      for (const item of rx.items) {
        const r = await tx.medicine.updateMany({ where: { id: item.medicineId, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
        if (r.count === 0) throw new HttpError(409, `Not enough stock of ${item.medicine.name} to dispense ${item.quantity}`);
      }
    });
    await audit(req, 'DISPENSE', 'prescription', rx.id);
    res.json(await prisma.prescription.findUnique({ where: { id: rx.id }, include: rxInclude }));
  }),
);

clinicalRouter.post(
  '/prescriptions/:id/cancel',
  authorize('DOCTOR'),
  asyncHandler(async (req, res) => {
    const r = await prisma.prescription.updateMany({ where: { id: req.params.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    if (r.count === 0) throw new HttpError(400, 'Only a pending prescription can be cancelled');
    await audit(req, 'CANCEL', 'prescription', req.params.id);
    res.json({ ok: true });
  }),
);

// ── Laboratory ──────────────────────────────────────────────────────────────

const labInclude = { patient: patientBrief, test: { select: { id: true, name: true, code: true, normalRange: true, sampleType: true } } } as const;

clinicalRouter.get(
  '/lab-orders',
  authorize(...P.lab.read),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 15));
    const where: Record<string, unknown> = {};
    for (const f of ['status', 'patientId'] as const) if (typeof req.query[f] === 'string' && req.query[f]) where[f] = req.query[f];
    const [data, total] = await Promise.all([
      prisma.labOrder.findMany({ where, include: labInclude, orderBy: [{ urgent: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.labOrder.count({ where }),
    ]);
    res.json({ data, total, page, pageSize });
  }),
);

clinicalRouter.post(
  '/lab-orders',
  authorize('DOCTOR'),
  asyncHandler(async (req, res) => {
    const body = labOrderSchema.parse(req.body);
    const [patient, test] = await Promise.all([
      prisma.patient.findUnique({ where: { id: body.patientId }, select: { id: true } }),
      prisma.labTest.findUnique({ where: { id: body.testId } }),
    ]);
    if (!patient) throw new HttpError(404, 'Patient not found');
    if (!test || !test.isActive) throw new HttpError(400, 'This test is not available');
    if (body.encounterId) {
      const enc = await prisma.encounter.findUnique({ where: { id: body.encounterId } });
      if (!enc || enc.patientId !== body.patientId) throw new HttpError(400, 'That visit does not belong to this patient');
    }
    const order = await prisma.$transaction(async (tx) =>
      tx.labOrder.create({ data: { ...body, number: await nextNumber(tx, 'lab', 'LAB'), orderedById: req.user!.id }, include: labInclude }),
    );
    await audit(req, 'CREATE', 'labOrder', order.id);
    res.status(201).json(order);
  }),
);

const labStep = (from: 'ORDERED' | 'COLLECTED', to: 'COLLECTED' | 'COMPLETED', who: Parameters<typeof authorize>) =>
  asyncHandler(async (req, res) => {
    const extra = to === 'COMPLETED' ? { ...labResultSchema.parse(req.body), resultedAt: new Date() } : { collectedAt: new Date() };
    const r = await prisma.labOrder.updateMany({ where: { id: req.params.id, status: from }, data: { status: to, ...extra } });
    if (r.count === 0) throw new HttpError(400, to === 'COLLECTED' ? 'Only an ordered test can be marked collected' : 'Collect the sample before entering a result');
    await audit(req, to, 'labOrder', req.params.id);
    res.json(await prisma.labOrder.findUnique({ where: { id: req.params.id }, include: labInclude }));
  });
clinicalRouter.post('/lab-orders/:id/collect', authorize('LAB_TECH'), labStep('ORDERED', 'COLLECTED', ['LAB_TECH']));
clinicalRouter.post('/lab-orders/:id/result', authorize('LAB_TECH'), labStep('COLLECTED', 'COMPLETED', ['LAB_TECH']));
clinicalRouter.post(
  '/lab-orders/:id/cancel',
  authorize('DOCTOR', 'LAB_TECH'),
  asyncHandler(async (req, res) => {
    const r = await prisma.labOrder.updateMany({ where: { id: req.params.id, status: 'ORDERED' }, data: { status: 'CANCELLED' } });
    if (r.count === 0) throw new HttpError(400, 'Only a test that has not been collected can be cancelled');
    await audit(req, 'CANCEL', 'labOrder', req.params.id);
    res.json({ ok: true });
  }),
);
