import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ResourcePage from '../components/ResourcePage';
import { Badge, Button, Card, ErrorBox, Modal, PageHeader, Spinner } from '../components/ui';
import { api, Page, qs } from '../lib/api';
import { fmtDateTime, fmtMoney } from '../lib/format';
import { L, useLookup } from '../lib/lookups';
import { useAuth } from '../lib/auth';
import { canWrite } from '../lib/access';

/* eslint-disable @typescript-eslint/no-explicit-any */

const bedColor: Record<string, string> = {
  AVAILABLE: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  OCCUPIED: 'border-sky-300 bg-sky-50 text-sky-900',
  MAINTENANCE: 'border-amber-300 bg-amber-50 text-amber-800',
};

export function Wards() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const writer = canWrite(user?.role, 'wards');
  const [admit, setAdmit] = useState<any | null>(null);
  const q = useQuery({ queryKey: ['wards-board'], queryFn: () => api<Page<any>>('/wards?pageSize=100') });
  const maint = useMutation({
    mutationFn: (v: { id: string; on: boolean }) => api(`/beds/${v.id}/maintenance`, { method: 'PATCH', body: { on: v.on } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wards-board'] }),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['wards-board'] });
    qc.invalidateQueries({ queryKey: ['resource', '/admissions'] });
  };
  if (q.isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Wards and beds" subtitle="Green beds are free. Choose one to admit a patient." />
      <ErrorBox error={q.error ?? maint.error} />
      <div className="space-y-6">
        {q.data?.data.map((w) => (
          <Card key={w.id} className="p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-semibold text-slate-900">{w.name}</h2>
              <span className="text-xs text-slate-500">{w.kind} · {w.beds.filter((b: any) => b.status === 'AVAILABLE').length} of {w.beds.length} free</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {w.beds.map((b: any) => {
                const adm = b.admissions[0];
                return (
                  <div key={b.id} className={`rounded-lg border p-3 text-sm ${bedColor[b.status]}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold">{b.number}</span>
                      <span className="text-xs">{fmtMoney(b.dailyRate)}/day</span>
                    </div>
                    {adm ? (
                      <div className="mt-1.5 truncate font-medium">{adm.patient.firstName} {adm.patient.lastName}</div>
                    ) : (
                      <div className="mt-1.5 text-xs">{b.status === 'MAINTENANCE' ? 'Out of service' : 'Free'}</div>
                    )}
                    {writer && b.status === 'AVAILABLE' && (
                      <div className="mt-2 flex gap-1.5">
                        <Button size="sm" onClick={() => setAdmit({ ...b, wardName: w.name })}>Admit</Button>
                        <Button size="sm" variant="ghost" onClick={() => maint.mutate({ id: b.id, on: true })}>Maintenance</Button>
                      </div>
                    )}
                    {writer && b.status === 'MAINTENANCE' && (
                      <Button size="sm" variant="secondary" className="mt-2" onClick={() => maint.mutate({ id: b.id, on: false })}>Back in service</Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
      {admit && <AdmitModal bed={admit} onClose={() => setAdmit(null)} onDone={() => { setAdmit(null); refresh(); }} />}
    </div>
  );
}

function AdmitModal({ bed, onClose, onDone }: { bed: any; onClose: () => void; onDone: () => void }) {
  const [search, setSearch] = useState('');
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [reason, setReason] = useState('');
  const patients = useQuery({ queryKey: ['patient-search', search], queryFn: () => api<Page<any>>(`/patients${qs({ q: search, pageSize: 20 })}`) });
  const doctors = useLookup(L.doctors);
  const save = useMutation({ mutationFn: () => api('/admissions', { method: 'POST', body: { patientId, doctorId, bedId: bed.id, reason } }), onSuccess: onDone });
  return (
    <Modal title={`Admit to ${bed.number}, ${bed.wardName}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <ErrorBox error={save.error} />
        <label className="label">Patient</label>
        <input className="input mb-2" placeholder="Search by name or record number" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" required value={patientId} onChange={(e) => setPatientId(e.target.value)} aria-label="Patient">
          <option value="">Select…</option>
          {patients.data?.data.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.mrn})</option>)}
        </select>
        <label className="label mt-4">Responsible doctor</label>
        <select className="input" required value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
          <option value="">Select…</option>
          {doctors.data?.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <label className="label mt-4">Reason for admission</label>
        <input className="input" required value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>Admit patient</Button>
        </div>
      </form>
    </Modal>
  );
}

export function Admissions() {
  const { user } = useAuth();
  const role = user?.role;
  const [discharge, setDischarge] = useState<any | null>(null);
  const canAct = canWrite(role, 'wards') || role === 'DOCTOR';
  const bill = useMutation({ mutationFn: (id: string) => api(`/invoices/from-admission/${id}`, { method: 'POST' }) });
  const canBill = role === 'ADMIN' || role === 'RECEPTIONIST';
  return (
    <>
      <ResourcePage
        title="Admissions"
        subtitle="Patients staying in the hospital."
        singular="admission"
        endpoint="/admissions"
        filters={[{ name: 'status', label: 'Status', options: [{ value: 'ADMITTED', label: 'Admitted' }, { value: 'DISCHARGED', label: 'Discharged' }] }]}
        headerActions={bill.error ? <div className="max-w-md"><ErrorBox error={bill.error} /></div> : bill.isSuccess ? <Link to="/billing/invoices" className="text-sm text-brand-600 hover:underline">Invoice created: open invoices</Link> : null}
        rowActions={(row) => (
          <>
            {row.status === 'ADMITTED' && canAct && <Button size="sm" onClick={() => setDischarge(row)}>Discharge</Button>}
            {row.status === 'DISCHARGED' && canBill && <Button size="sm" variant="secondary" disabled={bill.isPending} onClick={() => bill.mutate(row.id)}>Bill stay</Button>}
          </>
        )}
        columns={[
          { header: 'Admission', cell: (r) => <span className="font-mono text-xs">{r.number}</span> },
          { header: 'Patient', cell: (r) => `${r.patient.firstName} ${r.patient.lastName}` },
          { header: 'Bed', cell: (r) => `${r.bed.ward.name}, ${r.bed.number}` },
          { header: 'Doctor', cell: (r) => r.doctor.name },
          { header: 'Reason', cell: (r) => r.reason },
          { header: 'Admitted', cell: (r) => fmtDateTime(r.admittedAt) },
          { header: 'Status', cell: (r) => <Badge value={r.status} /> },
        ]}
      />
      {discharge && <DischargeModal adm={discharge} onClose={() => setDischarge(null)} />}
    </>
  );
}

function DischargeModal({ adm, onClose }: { adm: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [summary, setSummary] = useState('');
  const save = useMutation({
    mutationFn: () => api(`/admissions/${adm.id}/discharge`, { method: 'POST', body: { summary } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resource', '/admissions'] });
      qc.invalidateQueries({ queryKey: ['wards-board'] });
      onClose();
    },
  });
  return (
    <Modal title={`Discharge ${adm.patient.firstName} ${adm.patient.lastName}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <ErrorBox error={save.error} />
        <label className="label" htmlFor="sum">Discharge summary</label>
        <textarea id="sum" className="input min-h-[110px]" required autoFocus value={summary} onChange={(e) => setSummary(e.target.value)} />
        <p className="mt-1 text-xs text-slate-400">The bed becomes free as soon as you discharge.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>Discharge</Button>
        </div>
      </form>
    </Modal>
  );
}
