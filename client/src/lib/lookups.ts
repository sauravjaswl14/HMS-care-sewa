import { useQuery } from '@tanstack/react-query';
import { api, Page } from './api';

export interface Option {
  value: string;
  label: string;
}

export interface LookupDef {
  /** List endpoint, e.g. "/departments". Fetched with a large page size. */
  endpoint: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  label: (row: any) => string;
}

export const L = {
  departments: { endpoint: '/departments', label: (r) => `${r.name} (${r.code})` },
  doctors: { endpoint: '/doctors?isActive=true', label: (r) => `${r.name}, ${r.specialization}` },
  patients: { endpoint: '/patients', label: (r) => `${r.firstName} ${r.lastName} (${r.mrn})` },
  medicines: { endpoint: '/medicines?isActive=true', label: (r) => `${r.name} ${r.strength ?? ''} · ${r.form}`.trim() },
  labTests: { endpoint: '/lab-tests?isActive=true', label: (r) => `${r.name} (${r.code})` },
  wards: { endpoint: '/wards', label: (r) => r.name },
  doctorUsers: { endpoint: '/users/options?role=DOCTOR', label: (r) => r.name },
} satisfies Record<string, LookupDef>;

export function useLookup(def: LookupDef | undefined) {
  return useQuery({
    queryKey: ['lookup', def?.endpoint],
    enabled: !!def,
    staleTime: 30_000,
    queryFn: async (): Promise<Option[]> => {
      const sep = def!.endpoint.includes('?') ? '&' : '?';
      const r = await api<Page<unknown>>(`${def!.endpoint}${sep}pageSize=200`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return r.data.map((row: any) => ({ value: row.id as string, label: def!.label(row) }));
    },
  });
}
