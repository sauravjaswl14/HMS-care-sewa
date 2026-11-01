import { z } from 'zod';

const str = z.string().trim();
const opt = z.string().trim().optional().nullable().transform((v) => (v ? v : null));
const money = z.coerce.number().min(0).max(99_999_999);
const date = z.coerce.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm, for example 09:00');

export const departmentSchema = z.object({
  code: str.min(2).max(12).transform((v) => v.toUpperCase()),
  name: str.min(2),
  description: opt,
  location: opt,
  isActive: z.coerce.boolean().default(true),
});

export const serviceSchema = z.object({
  departmentId: str.min(1),
  code: str.min(2).max(20).transform((v) => v.toUpperCase()),
  name: str.min(2),
  description: opt,
  durationMin: z.coerce.number().int().min(5).max(600).default(15),
  price: money,
  isActive: z.coerce.boolean().default(true),
});

export const doctorSchema = z.object({
  departmentId: str.min(1),
  userId: opt,
  name: str.min(2),
  specialization: str.min(2),
  licenseNo: str.min(3),
  email: z.string().trim().email().optional().nullable().or(z.literal('')).transform((v) => v || null),
  phone: opt,
  consultationFee: money,
  isActive: z.coerce.boolean().default(true),
});

export const scheduleSchema = z
  .object({
    doctorId: str.min(1),
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: time,
    endTime: time,
    slotMinutes: z.coerce.number().int().min(5).max(120).default(20),
  })
  .refine((v) => v.startTime < v.endTime, { message: 'End time must be after start time', path: ['endTime'] });

export const timeOffSchema = z
  .object({ doctorId: str.min(1), startsAt: date, endsAt: date, reason: opt })
  .refine((v) => v.startsAt < v.endsAt, { message: 'End must be after start', path: ['endsAt'] });

export const patientSchema = z.object({
  firstName: str.min(1),
  lastName: str.min(1),
  dateOfBirth: date.refine((d) => d <= new Date(), 'Date of birth cannot be in the future'),
  gender: z.enum(['FEMALE', 'MALE', 'OTHER']),
  phone: str.min(5),
  email: z.string().trim().email().optional().nullable().or(z.literal('')).transform((v) => v || null),
  address: opt,
  bloodGroup: z
    .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  allergies: opt,
  emergencyName: opt,
  emergencyPhone: opt,
  insuranceProvider: opt,
  insuranceNo: opt,
  notes: opt,
});

export const medicineSchema = z.object({
  sku: str.min(2).transform((v) => v.toUpperCase()),
  name: str.min(2),
  genericName: opt,
  form: str.min(2),
  strength: opt,
  unitPrice: money,
  stock: z.coerce.number().int().min(0).default(0),
  reorderLevel: z.coerce.number().int().min(0).default(20),
  isActive: z.coerce.boolean().default(true),
});

export const labTestSchema = z.object({
  code: str.min(2).transform((v) => v.toUpperCase()),
  name: str.min(2),
  departmentId: opt,
  price: money,
  sampleType: opt,
  normalRange: opt,
  isActive: z.coerce.boolean().default(true),
});

export const wardSchema = z.object({ name: str.min(2), departmentId: opt, kind: str.min(2).default('General') });

export const bedSchema = z.object({
  wardId: str.min(1),
  number: str.min(1),
  dailyRate: money,
});

export const bookSchema = z.object({
  patientId: str.min(1),
  doctorId: str.min(1),
  serviceId: opt,
  /** Calendar date in the clinic time zone, YYYY-MM-DD */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Slot start, HH:mm in the clinic time zone */
  time,
  reason: opt,
});

export const encounterSchema = z.object({
  complaint: opt,
  bloodPressure: z.string().trim().regex(/^\d{2,3}\/\d{2,3}$/, 'Use 120/80').optional().nullable().or(z.literal('')).transform((v) => v || null),
  pulse: z.coerce.number().int().min(20).max(260).optional().nullable().or(z.literal('')).transform((v) => (v === '' || v == null ? null : v)),
  temperatureC: z.coerce.number().min(30).max(45).optional().nullable().or(z.literal('')).transform((v) => (v === '' || v == null ? null : v)),
  spo2: z.coerce.number().int().min(50).max(100).optional().nullable().or(z.literal('')).transform((v) => (v === '' || v == null ? null : v)),
  weightKg: z.coerce.number().min(0.3).max(500).optional().nullable().or(z.literal('')).transform((v) => (v === '' || v == null ? null : v)),
  heightCm: z.coerce.number().min(20).max(260).optional().nullable().or(z.literal('')).transform((v) => (v === '' || v == null ? null : v)),
  diagnosis: opt,
  notes: opt,
  followUpOn: z.coerce.date().optional().nullable().or(z.literal('')).transform((v) => (v ? v : null)),
});

export const prescriptionSchema = z.object({
  encounterId: str.min(1),
  notes: opt,
  items: z
    .array(
      z.object({
        medicineId: str.min(1),
        dosage: str.min(1),
        frequency: str.min(1),
        durationDays: z.coerce.number().int().min(1).max(365),
        quantity: z.coerce.number().int().min(1).max(10_000),
        instructions: opt,
      }),
    )
    .min(1, 'Add at least one medicine'),
});

export const labOrderSchema = z.object({
  patientId: str.min(1),
  encounterId: opt,
  testId: str.min(1),
  urgent: z.coerce.boolean().default(false),
});

export const labResultSchema = z.object({ result: str.min(1), flag: z.enum(['NORMAL', 'ABNORMAL', 'CRITICAL']) });

export const admitSchema = z.object({ patientId: str.min(1), bedId: str.min(1), doctorId: str.min(1), reason: str.min(2) });

export const invoiceSchema = z.object({
  patientId: str.min(1),
  appointmentId: opt,
  admissionId: opt,
  discount: money.default(0),
  notes: opt,
  lines: z
    .array(
      z.object({
        description: str.min(1),
        quantity: z.coerce.number().int().min(1).max(10_000).default(1),
        unitPrice: money,
        serviceId: opt,
        medicineId: opt,
      }),
    )
    .min(1, 'Add at least one line'),
});

export const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(['CASH', 'CARD', 'INSURANCE', 'ONLINE']),
  reference: opt,
});
