import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authorize } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { audit } from '../lib/crud';
import { nextNumber } from '../lib/numbers';
import { P } from '../lib/permissions';
import { admitSchema } from '../lib/schemas';

export const inpatientRouter = Router();

const include = {
  patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
  doctor: { select: { id: true, name: true } },
  bed: { select: { id: true, number: true, dailyRate: true, ward: { select: { name: true } } } },
} as const;

inpatientRouter.get(
  '/admissions',
  authorize(...P.wards.read),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 15));
    const where = typeof req.query.status === 'string' && req.query.status ? { status: req.query.status as 'ADMITTED' | 'DISCHARGED' } : {};
    const [data, total] = await Promise.all([
      prisma.admission.findMany({ where, include, orderBy: { admittedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.admission.count({ where }),
    ]);
    res.json({ data, total, page, pageSize });
  }),
);

inpatientRouter.post(
  '/admissions',
  authorize(...P.wards.write, 'DOCTOR'),
  asyncHandler(async (req, res) => {
    const body = admitSchema.parse(req.body);
    const [patient, doctor] = await Promise.all([
      prisma.patient.findUnique({ where: { id: body.patientId }, select: { id: true } }),
      prisma.doctor.findUnique({ where: { id: body.doctorId }, select: { id: true, isActive: true } }),
    ]);
    if (!patient) throw new HttpError(404, 'Patient not found');
    if (!doctor?.isActive) throw new HttpError(400, 'Choose an active doctor');
    if (await prisma.admission.findFirst({ where: { patientId: body.patientId, status: 'ADMITTED' } })) {
      throw new HttpError(409, 'This patient is already admitted');
    }
    const admission = await prisma.$transaction(async (tx) => {
      // Claim the bed first; only one request can flip AVAILABLE to OCCUPIED.
      const claimed = await tx.bed.updateMany({ where: { id: body.bedId, status: 'AVAILABLE' }, data: { status: 'OCCUPIED' } });
      if (claimed.count === 0) throw new HttpError(409, 'That bed is not available');
      return tx.admission.create({ data: { ...body, number: await nextNumber(tx, 'admission', 'ADM') }, include });
    });
    await audit(req, 'ADMIT', 'admission', admission.id);
    res.status(201).json(admission);
  }),
);

inpatientRouter.post(
  '/admissions/:id/discharge',
  authorize(...P.wards.write, 'DOCTOR'),
  asyncHandler(async (req, res) => {
    const { summary } = z.object({ summary: z.string().trim().min(1, 'Add a short discharge summary') }).parse(req.body);
    const adm = await prisma.admission.findUnique({ where: { id: req.params.id } });
    if (!adm) throw new HttpError(404, 'Admission not found');
    const out = await prisma.$transaction(async (tx) => {
      const r = await tx.admission.updateMany({ where: { id: adm.id, status: 'ADMITTED' }, data: { status: 'DISCHARGED', dischargedAt: new Date(), summary } });
      if (r.count === 0) throw new HttpError(400, 'This patient has already been discharged');
      await tx.bed.update({ where: { id: adm.bedId }, data: { status: 'AVAILABLE' } });
      return tx.admission.findUnique({ where: { id: adm.id }, include });
    });
    await audit(req, 'DISCHARGE', 'admission', adm.id);
    res.json(out);
  }),
);
