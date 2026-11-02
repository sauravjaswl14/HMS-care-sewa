export type Role = 'ADMIN' | 'DOCTOR' | 'NURSE' | 'RECEPTIONIST' | 'PHARMACIST' | 'LAB_TECH' | 'BILLING';

interface Rule {
  read: Role[];
  write: Role[];
}

/**
 * UI-side mirror of server/src/lib/permissions.ts. It only decides what to show;
 * the API enforces the real rules. ADMIN is always allowed.
 */
export const ACCESS = {
  catalog: { read: ['DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECH', 'BILLING'], write: [] },
  patients: { read: ['DOCTOR', 'NURSE', 'RECEPTIONIST', 'BILLING', 'LAB_TECH', 'PHARMACIST'], write: ['RECEPTIONIST', 'NURSE'] },
  appointments: { read: ['DOCTOR', 'NURSE', 'RECEPTIONIST', 'BILLING'], write: ['RECEPTIONIST', 'DOCTOR', 'NURSE'] },
  encounters: { read: ['DOCTOR', 'NURSE'], write: ['DOCTOR', 'NURSE'] },
  prescriptions: { read: ['DOCTOR', 'NURSE', 'PHARMACIST'], write: ['DOCTOR'] },
  pharmacy: { read: ['DOCTOR', 'NURSE', 'PHARMACIST'], write: ['PHARMACIST'] },
  lab: { read: ['DOCTOR', 'NURSE', 'LAB_TECH'], write: ['LAB_TECH'] },
  wards: { read: ['DOCTOR', 'NURSE', 'RECEPTIONIST'], write: ['NURSE', 'RECEPTIONIST'] },
  billing: { read: ['BILLING', 'RECEPTIONIST'], write: ['BILLING', 'RECEPTIONIST'] },
  admin: { read: [] as Role[], write: [] as Role[] }, // admin-only pages; ADMIN always passes
} satisfies Record<string, Rule>;

export type Module = keyof typeof ACCESS;

const rule = (m: Module): Rule => ACCESS[m];

export const canRead = (role: Role | undefined, m: Module) =>
  !!role && (role === 'ADMIN' || rule(m).read.includes(role) || rule(m).write.includes(role));

export const canWrite = (role: Role | undefined, m: Module) => !!role && (role === 'ADMIN' || rule(m).write.includes(role));
