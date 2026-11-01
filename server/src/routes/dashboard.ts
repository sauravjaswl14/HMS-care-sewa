import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/error';
import { P, Access } from '../lib/permissions';
import { config } from '../config';
import { toZoned, zonedToUtc } from '../lib/slots';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const role = req.user!.role;
    const can = (a: Access) => role === 'ADMIN' || a.read.includes(role) || a.write.includes(role);
    const own = role === 'DOCTOR' ? req.user!.doctorId ?? '__none__' : undefined;

    const today = toZoned(new Date(), config.clinicTimezone).date;
    const next = new Date(`${today}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const start = zonedToUtc(today, '00:00', config.clinicTimezone);
    const end = zonedToUtc(next.toISOString().slice(0, 10), '00:00', config.clinicTimezone);
    const out: Record<string, unknown> = { today };

    if (can(P.appointments)) {
      const where = { startsAt: { gte: start, lt: end }, ...(own ? { doctorId: own } : {}) };
      const groups = await prisma.appointment.groupBy({ by: ['status'], where, _count: { _all: true } });
      const byStatus = Object.fromEntries(groups.map((g) => [g.status, g._count._all]));
      out.appointments = {
        today: groups.reduce((n, g) => n + g._count._all, 0),
        byStatus,
        waiting: byStatus.CHECKED_IN ?? 0,
        next: await prisma.appointment.findMany({
          where: { ...where, status: { in: ['SCHEDULED', 'CHECKED_IN'] }, startsAt: { gte: new Date(), lt: end } },
          include: { patient: { select: { firstName: true, lastName: true, mrn: true } }, doctor: { select: { name: true } } },
          orderBy: { startsAt: 'asc' },
          take: 6,
        }),
      };
    }
    if (can(P.patients)) {
      const since = new Date(Date.now() - 30 * 86_400_000);
      const [total, recent] = await Promise.all([prisma.patient.count(), prisma.patient.count({ where: { createdAt: { gte: since } } })]);
      out.patients = { total, newLast30Days: recent };
    }
    if (can(P.catalog)) {
      const [doctors, departments] = await Promise.all([prisma.doctor.count({ where: { isActive: true } }), prisma.department.count({ where: { isActive: true } })]);
      out.catalog = { doctors, departments };
    }
    if (can(P.wards)) {
      const grouped = await prisma.bed.groupBy({ by: ['status'], _count: { _all: true } });
      const n = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
      const total = grouped.reduce((a, g) => a + g._count._all, 0);
      out.beds = { total, occupied: n('OCCUPIED'), available: n('AVAILABLE'), maintenance: n('MAINTENANCE') };
    }
    if (can(P.pharmacy)) {
      const meds = await prisma.medicine.findMany({ where: { isActive: true }, select: { id: true, name: true, stock: true, reorderLevel: true } });
      out.pharmacy = {
        pendingPrescriptions: await prisma.prescription.count({ where: { status: 'PENDING' } }),
        lowStock: meds.filter((m) => m.stock <= m.reorderLevel).sort((a, b) => a.stock - b.stock).slice(0, 6),
      };
    }
    if (can(P.lab)) {
      const [ordered, collected, urgent] = await Promise.all([
        prisma.labOrder.count({ where: { status: 'ORDERED' } }),
        prisma.labOrder.count({ where: { status: 'COLLECTED' } }),
        prisma.labOrder.count({ where: { status: { in: ['ORDERED', 'COLLECTED'] }, urgent: true } }),
      ]);
      out.lab = { awaitingSample: ordered, awaitingResult: collected, urgent };
    }
    if (can(P.billing)) {
      const open = await prisma.invoice.findMany({ where: { status: { in: ['ISSUED', 'PARTIAL'] } }, select: { total: true, paid: true } });
      const since = new Date(Date.now() - 30 * 86_400_000);
      const collected = await prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: since } } });
      out.billing = {
        outstanding: open.reduce((s, i) => s + Math.round((Number(i.total) - Number(i.paid)) * 100), 0) / 100,
        openInvoices: open.length,
        collectedLast30Days: Number(collected._sum.amount ?? 0),
      };
    }
    res.json(out);
  }),
);
