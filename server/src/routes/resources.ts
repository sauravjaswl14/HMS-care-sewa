import { Router } from 'express';
import { z } from 'zod';
import { crud, audit } from '../lib/crud';
import { P } from '../lib/permissions';
import { prisma } from '../lib/prisma';
import { nextNumber } from '../lib/numbers';
import { authorize } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import * as s from '../lib/schemas';

/** Master data served by the generic CRUD factory. Only ADMIN edits the catalogue (departments, services, doctors). */
export const resourcesRouter = Router();

resourcesRouter.use(
  '/departments',
  crud({
    model: 'department',
    schema: s.departmentSchema,
    searchFields: ['name', 'code'],
    filterFields: ['isActive'],
    include: { _count: { select: { services: true, doctors: true } } },
    orderBy: { name: 'asc' },
    ...P.catalog,
  }),
);
resourcesRouter.use(
  '/services',
  crud({
    model: 'service',
    schema: s.serviceSchema,
    searchFields: ['name', 'code'],
    filterFields: ['departmentId', 'isActive'],
    include: { department: { select: { id: true, name: true, code: true } } },
    orderBy: { name: 'asc' },
    ...P.catalog,
  }),
);
resourcesRouter.use(
  '/doctors',
  crud({
    model: 'doctor',
    schema: s.doctorSchema,
    searchFields: ['name', 'specialization', 'licenseNo'],
    filterFields: ['departmentId', 'isActive'],
    include: { department: { select: { id: true, name: true, code: true } }, schedules: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] } },
    orderBy: { name: 'asc' },
    ...P.catalog,
  }),
);
// Schedule blocks and time off are created or removed, never edited in place, so each rule is checked in full.
resourcesRouter.use('/doctor-schedules', crud({ model: 'doctorSchedule', filterFields: ['doctorId'], orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }], methods: ['list', 'get'], ...P.catalog }));
resourcesRouter.post(
  '/doctor-schedules',
  authorize(),
  asyncHandler(async (req, res) => {
    const data = s.scheduleSchema.parse(req.body);
    const sameDay = await prisma.doctorSchedule.findMany({ where: { doctorId: data.doctorId, weekday: data.weekday } });
    if (sameDay.some((b) => data.startTime < b.endTime && data.endTime > b.startTime)) {
      throw new HttpError(409, 'This overlaps another working block on the same day');
    }
    const row = await prisma.doctorSchedule.create({ data });
    await audit(req, 'CREATE', 'doctorSchedule', row.id);
    res.status(201).json(row);
  }),
);
resourcesRouter.delete(
  '/doctor-schedules/:id',
  authorize(),
  asyncHandler(async (req, res) => {
    await prisma.doctorSchedule.delete({ where: { id: req.params.id } });
    await audit(req, 'DELETE', 'doctorSchedule', req.params.id);
    res.status(204).end();
  }),
);
resourcesRouter.use('/doctor-time-off', crud({ model: 'doctorTimeOff', filterFields: ['doctorId'], include: { doctor: { select: { name: true } } }, orderBy: { startsAt: 'desc' }, methods: ['list', 'get'], ...P.catalog }));
resourcesRouter.post(
  '/doctor-time-off',
  authorize(),
  asyncHandler(async (req, res) => {
    const row = await prisma.doctorTimeOff.create({ data: s.timeOffSchema.parse(req.body) });
    await audit(req, 'CREATE', 'doctorTimeOff', row.id);
    res.status(201).json(row);
  }),
);
resourcesRouter.delete(
  '/doctor-time-off/:id',
  authorize(),
  asyncHandler(async (req, res) => {
    await prisma.doctorTimeOff.delete({ where: { id: req.params.id } });
    await audit(req, 'DELETE', 'doctorTimeOff', req.params.id);
    res.status(204).end();
  }),
);

resourcesRouter.use(
  '/patients',
  crud({
    model: 'patient',
    schema: s.patientSchema,
    searchFields: ['firstName', 'lastName', 'mrn', 'phone', 'email'],
    orderBy: { createdAt: 'desc' },
    methods: ['list', 'get', 'create', 'update'], // clinical history is never deleted
    beforeCreate: async (data) => ({ ...data, mrn: await prisma.$transaction((tx) => nextNumber(tx, 'patient', 'MRN')) }),
    ...P.patients,
  }),
);

resourcesRouter.use(
  '/medicines',
  crud({ model: 'medicine', schema: s.medicineSchema, searchFields: ['name', 'genericName', 'sku'], filterFields: ['isActive'], orderBy: { name: 'asc' }, ...P.pharmacy }),
);
resourcesRouter.post(
  '/medicines/:id/restock',
  authorize(...P.pharmacy.write),
  asyncHandler(async (req, res) => {
    const { quantity } = z.object({ quantity: z.coerce.number().int().min(1).max(100_000) }).parse(req.body);
    const med = await prisma.medicine.update({ where: { id: req.params.id }, data: { stock: { increment: quantity } } });
    await audit(req, 'RESTOCK', 'medicine', med.id);
    res.json(med);
  }),
);

resourcesRouter.use(
  '/lab-tests',
  crud({
    model: 'labTest',
    schema: s.labTestSchema,
    searchFields: ['name', 'code'],
    filterFields: ['departmentId', 'isActive'],
    include: { department: { select: { name: true } } },
    orderBy: { name: 'asc' },
    read: [...P.lab.read, 'RECEPTIONIST', 'BILLING'],
    write: ['LAB_TECH'],
  }),
);

resourcesRouter.use(
  '/wards',
  crud({
    model: 'ward',
    schema: s.wardSchema,
    include: { beds: { orderBy: { number: 'asc' }, include: { admissions: { where: { status: 'ADMITTED' }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } } } } } } },
    orderBy: { name: 'asc' },
    ...P.wards,
  }),
);
resourcesRouter.use(
  '/beds',
  crud({ model: 'bed', schema: s.bedSchema, filterFields: ['wardId', 'status'], include: { ward: { select: { name: true } } }, orderBy: [{ wardId: 'asc' }, { number: 'asc' }], ...P.wards }),
);

// Writing a bed's status by hand is how an occupied bed could be freed, so only maintenance toggles are allowed through CRUD.
resourcesRouter.patch(
  '/beds/:id/maintenance',
  authorize(...P.wards.write),
  asyncHandler(async (req, res) => {
    const { on } = z.object({ on: z.boolean() }).parse(req.body);
    const r = await prisma.bed.updateMany({
      where: { id: req.params.id, status: on ? 'AVAILABLE' : 'MAINTENANCE' },
      data: { status: on ? 'MAINTENANCE' : 'AVAILABLE' },
    });
    if (r.count === 0) throw new HttpError(409, on ? 'Only an available bed can go into maintenance' : 'This bed is not in maintenance');
    res.json({ ok: true });
  }),
);
