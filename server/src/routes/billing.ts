import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma, Tx } from '../lib/prisma';
import { authorize } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { audit } from '../lib/crud';
import { nextNumber } from '../lib/numbers';
import { P } from '../lib/permissions';
import { invoiceSchema, paymentSchema } from '../lib/schemas';
import { afterPayment, stayDays, totals } from '../lib/money';

export const billingRouter = Router();

const include = {
  patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
  lines: true,
  payments: { orderBy: { paidAt: 'desc' as const } },
} as const;

type Line = { description: string; quantity: number; unitPrice: number; serviceId?: string | null; medicineId?: string | null };

async function createInvoice(
  tx: Tx,
  data: { patientId: string; appointmentId?: string | null; admissionId?: string | null; discount?: number; notes?: string | null; lines: Line[] },
) {
  let t;
  try {
    t = totals(data.lines, data.discount ?? 0);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  return tx.invoice.create({
    data: {
      number: await nextNumber(tx, 'invoice', 'INV'),
      patientId: data.patientId,
      appointmentId: data.appointmentId ?? null,
      admissionId: data.admissionId ?? null,
      notes: data.notes ?? null,
      ...t,
      status: t.total === 0 ? 'PAID' : 'ISSUED',
      lines: { create: data.lines.map((l) => ({ ...l, serviceId: l.serviceId ?? null, medicineId: l.medicineId ?? null, amount: l.quantity * l.unitPrice })) },
    },
    include,
  });
}

billingRouter.get(
  '/invoices',
  authorize(...P.billing.read),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 15));
    const where: Prisma.InvoiceWhereInput = {};
    for (const f of ['status', 'patientId'] as const) if (typeof req.query[f] === 'string' && req.query[f]) (where as Record<string, unknown>)[f] = req.query[f];
    const q = String(req.query.q ?? '').trim();
    if (q) where.OR = [{ number: { contains: q, mode: 'insensitive' } }, { patient: { OR: [{ lastName: { contains: q, mode: 'insensitive' } }, { firstName: { contains: q, mode: 'insensitive' } }, { mrn: { contains: q, mode: 'insensitive' } }] } }];
    const [data, total] = await Promise.all([
      prisma.invoice.findMany({ where, include, orderBy: { issuedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.invoice.count({ where }),
    ]);
    res.json({ data, total, page, pageSize });
  }),
);

billingRouter.get(
  '/invoices/:id',
  authorize(...P.billing.read),
  asyncHandler(async (req, res) => {
    const inv = await prisma.invoice.findUnique({ where: { id: req.params.id }, include });
    if (!inv) throw new HttpError(404, 'Invoice not found');
    res.json(inv);
  }),
);

billingRouter.post(
  '/invoices',
  authorize(...P.billing.write),
  asyncHandler(async (req, res) => {
    const body = invoiceSchema.parse(req.body);
    const inv = await prisma.$transaction((tx) => createInvoice(tx, body));
    await audit(req, 'CREATE', 'invoice', inv.id);
    res.status(201).json(inv);
  }),
);

/** Bills a visit: the doctor's consultation fee, plus the booked service if there is one. */
billingRouter.post(
  '/invoices/from-appointment/:id',
  authorize(...P.billing.write),
  asyncHandler(async (req, res) => {
    const appt = await prisma.appointment.findUnique({ where: { id: req.params.id }, include: { doctor: true, service: true } });
    if (!appt) throw new HttpError(404, 'Appointment not found');
    if (appt.status !== 'COMPLETED') throw new HttpError(400, 'Only a completed visit can be billed');
    const lines: Line[] = [{ description: `Consultation, ${appt.doctor.name}`, quantity: 1, unitPrice: Number(appt.doctor.consultationFee) }];
    if (appt.service) lines.push({ description: appt.service.name, quantity: 1, unitPrice: Number(appt.service.price), serviceId: appt.service.id });
    const inv = await prisma.$transaction(async (tx) => {
      if (await tx.invoice.findFirst({ where: { appointmentId: appt.id, status: { not: 'VOID' } } })) throw new HttpError(409, 'This visit has already been billed');
      return createInvoice(tx, { patientId: appt.patientId, appointmentId: appt.id, lines });
    });
    await audit(req, 'CREATE', 'invoice', inv.id);
    res.status(201).json(inv);
  }),
);

/** Bills a stay at the bed's daily rate for each started day. */
billingRouter.post(
  '/invoices/from-admission/:id',
  authorize(...P.billing.write),
  asyncHandler(async (req, res) => {
    const adm = await prisma.admission.findUnique({ where: { id: req.params.id }, include: { bed: { include: { ward: true } } } });
    if (!adm) throw new HttpError(404, 'Admission not found');
    if (adm.status !== 'DISCHARGED' || !adm.dischargedAt) throw new HttpError(400, 'Bill the stay once the patient is discharged');
    const days = stayDays(adm.admittedAt, adm.dischargedAt);
    const lines: Line[] = [{ description: `Bed ${adm.bed.number}, ${adm.bed.ward.name} (${days} day${days > 1 ? 's' : ''})`, quantity: days, unitPrice: Number(adm.bed.dailyRate) }];
    const inv = await prisma.$transaction(async (tx) => {
      if (await tx.invoice.findFirst({ where: { admissionId: adm.id, status: { not: 'VOID' } } })) throw new HttpError(409, 'This stay has already been billed');
      return createInvoice(tx, { patientId: adm.patientId, admissionId: adm.id, lines });
    });
    await audit(req, 'CREATE', 'invoice', inv.id);
    res.status(201).json(inv);
  }),
);

billingRouter.post(
  '/invoices/:id/payments',
  authorize(...P.billing.write),
  asyncHandler(async (req, res) => {
    const body = paymentSchema.parse(req.body);
    const inv = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!inv) throw new HttpError(404, 'Invoice not found');
    if (!['ISSUED', 'PARTIAL'].includes(inv.status)) throw new HttpError(400, `A ${inv.status.toLowerCase()} invoice cannot take payments`);
    let next;
    try {
      next = afterPayment(Number(inv.total), Number(inv.paid), body.amount);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    await prisma.$transaction(async (tx) => {
      // Only succeeds if nobody else has paid in the meantime (the paid amount must still be what we read).
      const r = await tx.invoice.updateMany({ where: { id: inv.id, paid: inv.paid, status: inv.status }, data: next });
      if (r.count === 0) throw new HttpError(409, 'This invoice was just updated by someone else. Refresh and try again.');
      await tx.payment.create({ data: { invoiceId: inv.id, amount: body.amount, method: body.method, reference: body.reference } });
    });
    await audit(req, 'PAYMENT', 'invoice', inv.id);
    res.status(201).json(await prisma.invoice.findUnique({ where: { id: inv.id }, include }));
  }),
);

billingRouter.post(
  '/invoices/:id/void',
  authorize(...P.billing.write),
  asyncHandler(async (req, res) => {
    const r = await prisma.invoice.updateMany({ where: { id: req.params.id, paid: 0, status: { in: ['ISSUED', 'DRAFT'] } }, data: { status: 'VOID' } });
    if (r.count === 0) throw new HttpError(400, 'Only an unpaid invoice can be voided');
    await audit(req, 'VOID', 'invoice', req.params.id);
    res.json({ ok: true });
  }),
);
