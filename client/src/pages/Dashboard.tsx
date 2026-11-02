import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { fmtMoney, fmtTime } from '../lib/format';
import { Card, ErrorBox, PageHeader, Spinner, Stat } from '../components/ui';
import { useAuth } from '../lib/auth';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Dashboard() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api<any>('/dashboard') });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorBox error={q.error} />;
  const d = q.data;

  return (
    <div>
      <PageHeader title={`Hello, ${user?.name.split(' ')[0]}`} subtitle={`Today is ${d.today}.`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {d.appointments && <Stat label="Appointments today" value={d.appointments.today} hint={`${d.appointments.waiting} waiting now`} />}
        {d.patients && <Stat label="Patients" value={d.patients.total} hint={`${d.patients.newLast30Days} new in 30 days`} />}
        {d.beds && <Stat label="Beds occupied" value={`${d.beds.occupied} / ${d.beds.total}`} hint={`${d.beds.available} available`} tone={d.beds.available === 0 ? 'warn' : 'default'} />}
        {d.catalog && <Stat label="Doctors" value={d.catalog.doctors} hint={`${d.catalog.departments} departments`} />}
        {d.pharmacy && <Stat label="Prescriptions to dispense" value={d.pharmacy.pendingPrescriptions} tone={d.pharmacy.pendingPrescriptions ? 'warn' : 'default'} />}
        {d.lab && <Stat label="Lab tests open" value={d.lab.awaitingSample + d.lab.awaitingResult} hint={`${d.lab.awaitingSample} need a sample · ${d.lab.urgent} urgent`} tone={d.lab.urgent ? 'warn' : 'default'} />}
        {d.billing && <Stat label="Outstanding" value={fmtMoney(d.billing.outstanding)} hint={`${d.billing.openInvoices} open invoices`} tone={d.billing.openInvoices ? 'warn' : 'default'} />}
        {d.billing && <Stat label="Collected, 30 days" value={fmtMoney(d.billing.collectedLast30Days)} tone="good" />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {d.appointments && (
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Coming up today</h2>
              <Link to="/appointments" className="text-sm text-brand-600 hover:underline">
                All appointments
              </Link>
            </div>
            {d.appointments.next.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Nothing else is booked for today.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.appointments.next.map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span>
                      <span className="font-medium text-slate-900">{a.patient.firstName} {a.patient.lastName}</span>
                      <span className="ml-2 text-slate-500">{a.doctor.name}</span>
                    </span>
                    <span className="tabular-nums text-slate-600">{fmtTime(a.startsAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {d.pharmacy && (
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Medicines running low</h2>
              <Link to="/pharmacy/medicines" className="text-sm text-brand-600 hover:underline">
                Pharmacy
              </Link>
            </div>
            {d.pharmacy.lowStock.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Every medicine is above its reorder level.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.pharmacy.lowStock.map((m: any) => (
                  <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-slate-900">{m.name}</span>
                    <span className="text-amber-700">{m.stock} left (reorder at {m.reorderLevel})</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
