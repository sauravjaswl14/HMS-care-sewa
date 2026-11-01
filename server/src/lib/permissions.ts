import { Role } from '@prisma/client';

export interface Access {
  read: Role[];
  write: Role[];
}

const CLINICAL: Role[] = ['DOCTOR', 'NURSE'];
const FRONT: Role[] = ['RECEPTIONIST'];

/** Module-level access matrix. ADMIN is implicitly allowed everywhere (see `authorize`). */
export const P = {
  /** Departments, services and doctors are reference data every signed-in role may read. */
  catalog: { read: ['DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECH', 'BILLING'], write: [] },
  patients: { read: ['DOCTOR', 'NURSE', 'RECEPTIONIST', 'BILLING', 'LAB_TECH', 'PHARMACIST'], write: [...FRONT, 'NURSE'] },
  appointments: { read: [...CLINICAL, ...FRONT, 'BILLING'], write: [...FRONT, ...CLINICAL] },
  encounters: { read: CLINICAL, write: CLINICAL },
  prescriptions: { read: [...CLINICAL, 'PHARMACIST'], write: ['DOCTOR'] },
  pharmacy: { read: [...CLINICAL, 'PHARMACIST'], write: ['PHARMACIST'] },
  lab: { read: [...CLINICAL, 'LAB_TECH'], write: ['LAB_TECH'] },
  wards: { read: [...CLINICAL, ...FRONT], write: ['NURSE', ...FRONT] },
  billing: { read: ['BILLING', ...FRONT], write: ['BILLING', ...FRONT] },
} satisfies Record<string, Access>;
