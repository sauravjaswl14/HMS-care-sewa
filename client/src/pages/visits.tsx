import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ResourcePage from '../components/ResourcePage';
import { Badge, Button, Card, ErrorBox, Modal, PageHeader, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { age, fmtDate, fmtDateTime } from '../lib/format';
import { useLookup, L } from '../lib/lookups';
import { useAuth } from '../lib/auth';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function Visits() {
  return (
    <ResourcePage
      title="Visits"
      subtitle="Clinical records of consultations. Doctors see their own visits."
      singular="visit"
      endpoint="/encounters"
      filters={[{ name: 'status', label: 'Status', options: [{ value: 'OPEN', label: 'Open' }, { value: 'CLOSED', label: 'Closed' }] }]}
      columns={[
        {
          header: 'Patient',
          cell: (r) => (
            <Link to={`/visits/${r.id}`} className="font-medium text-brand-700 hover:underline">
              {r.patient.firstName} {r.patient.lastName}
            </Link>
          ),
        },
        { header: 'Doctor', cell: (r) => r.doctor.name },
        { header: 'Diagnosis', cell: (r) => r.diagnosis ?? <span className="text-slate-400">Not recorded</span> },
        { header: 'Started', cell: (r) => fmtDateTime(r.createdAt) },
        { header: 'Status', cell: (r) => <Badge value={r.status} /> },
      ]}
    />
  );
}

const VITALS: { name: string; label: string; step?: string; unit: string }[] = [
  { name: 'bloodPressure', label: 'Blood pressure', unit: 'mmHg' },
  { name: 'pulse', label: 'Pulse', unit: 'bpm' },
  { name: 'temperatureC', label: 'Temperature', step: '0.1', unit: '°C' },
  { name: 'spo2', label: 'Oxygen (SpO₂)', unit: '%' },
  { name: 'weightKg', label: 'Weight', step: '0.1', unit: 'kg' },
  { name: 'heightCm', label: 'Height', step: '0.1', unit: 'cm' },
];

export function VisitDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['visit', id], queryFn: () => api<any>(`/encounters/${id}`) });
  const [form, setForm] = useState<Record<string, any>>({});
  const [rxOpen, setRxOpen] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['visit', id] });

  useEffect(() => {
    if (q.data) {
      const v: Record<string, any> = {};
      for (const k of ['complaint', 'diagnosis', 'notes', ...VITALS.map((x) => x.name)]) v[k] = q.data[k] ?? '';
      v.followUpOn = q.data.followUpOn ? q.data.followUpOn.slice(0, 10) : '';
      setForm(v);
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => {
      const keys = user?.role === 'NURSE' ? ['complaint', ...VITALS.map((x) => x.name)] : Object.keys(form);
      const body: Record<string, any> = {};
      for (const k of keys) body[k] = form[k] === '' ? null : form[k];
      return api(`/encounters/${id}`, { method: 'PATCH', body });
    },
    onSuccess: refresh,
  });
  const close = useMutation({ mutationFn: () => api(`/encounters/${id}/close`, { method: 'POST' }), onSuccess: refresh });
  const cancelRx = useMutation({ mutationFn: (rx: string) => api(`/prescriptions/${rx}/cancel`, { method: 'POST' }), onSuccess: refresh });

  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorBox error={q.error} />;
  const v = q.data;
  const open = v.status === 'OPEN';
  const doctor = user?.role === 'DOCTOR' || user?.role === 'ADMIN';
  const set = (k: string, val: string) => setForm((f) => ({ ...f, [k]: val }));
  const nurse = user?.role === 'NURSE';

  return (
    <div>
      <PageHeader
        title={`${v.patient.firstName} ${v.patient.lastName}`}
        subtitle={`${age(v.patient.dateOfBirth)} · ${v.patient.gender.toLowerCase()} · ${v.patient.mrn} · seen by ${v.doctor.name}`}
        actions={
          <>
            <Badge value={v.status} />
            {doctor && open && (
              <Button
                disabled={close.isPending}
                onClick={() => window.confirm('Close this visit? It can no longer be edited.') && close.mutate()}
              >
                Close visit
              </Button>
            )}
          </>
        }
      />
      {v.patient.allergies && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">Allergies: {v.patient.allergies}</div>}
      <ErrorBox error={save.error ?? close.error ?? cancelRx.error} />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <h2 className="mb-3 font-semibold text-slate-900">Vitals</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {VITALS.map((x) => (
                <div key={x.name}>
                  <label className="label" htmlFor={`v-${x.name}`}>
                    {x.label} <span className="font-normal text-slate-400">{x.unit}</span>
                  </label>
                  <input id={`v-${x.name}`} className="input" disabled={!open} inputMode="decimal" step={x.step} value={form[x.name] ?? ''} onChange={(e) => set(x.name, e.target.value)} placeholder={x.name === 'bloodPressure' ? '120/80' : ''} />
                </div>
              ))}
            </div>
            <h2 className="mb-3 mt-6 font-semibold text-slate-900">Consultation</h2>
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="v-complaint">Complaint</label>
                <textarea id="v-complaint" className="input min-h-[60px]" disabled={!open} value={form.complaint ?? ''} onChange={(e) => set('complaint', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="v-diagnosis">Diagnosis</label>
                <textarea id="v-diagnosis" className="input min-h-[60px]" disabled={!open || nurse} value={form.diagnosis ?? ''} onChange={(e) => set('diagnosis', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="v-notes">Notes and plan</label>
                <textarea id="v-notes" className="input min-h-[100px]" disabled={!open || nurse} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
              </div>
              <div className="max-w-xs">
                <label className="label" htmlFor="v-follow">Follow-up on</label>
                <input id="v-follow" className="input" type="date" disabled={!open || nurse} value={form.followUpOn ?? ''} onChange={(e) => set('followUpOn', e.target.value)} />
              </div>
            </div>
            {open && (
              <div className="mt-5 flex justify-end">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : 'Save visit'}
                </Button>
              </div>
            )}
          </form>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Prescriptions</h2>
              {doctor && open && (
                <Button size="sm" variant="secondary" onClick={() => setRxOpen(true)}>
                  + Prescribe
                </Button>
              )}
            </div>
            {v.prescriptions.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No prescriptions.</p>
            ) : (
              v.prescriptions.map((rx: any) => (
                <div key={rx.id} className="mb-3 rounded-lg border border-slate-200 p-3 last:mb-0">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">{rx.number}</span>
                    <Badge value={rx.status} />
                  </div>
                  <ul className="space-y-1 text-sm">
                    {rx.items.map((i: any) => (
                      <li key={i.id}>
                        <span className="font-medium text-slate-900">{i.medicine.name} {i.medicine.strength}</span>
                        <span className="text-slate-600"> · {i.dosage}, {i.frequency}, {i.durationDays} days (qty {i.quantity})</span>
                      </li>
                    ))}
                  </ul>
                  {doctor && rx.status === 'PENDING' && (
                    <button className="mt-2 text-xs text-red-600 hover:underline" onClick={() => window.confirm('Cancel this prescription?') && cancelRx.mutate(rx.id)}>
                      Cancel prescription
                    </button>
                  )}
                </div>
              ))
            )}
          </Card>
          <LabCard visit={v} canOrder={doctor && open} onChanged={refresh} />
          {v.followUpOn && <p className="text-sm text-slate-600">Follow-up planned for {fmtDate(v.followUpOn)}.</p>}
        </div>
      </div>
      {rxOpen && (
        <PrescribeModal
          encounterId={v.id}
          onClose={() => setRxOpen(false)}
          onDone={() => {
            setRxOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function LabCard({ visit, canOrder, onChanged }: { visit: any; canOrder: boolean; onChanged: () => void }) {
  const tests = useLookup(L.labTests);
  const [testId, setTestId] = useState('');
  const [urgent, setUrgent] = useState(false);
  const order = useMutation({
    mutationFn: () => api('/lab-orders', { method: 'POST', body: { patientId: visit.patient.id, encounterId: visit.id, testId, urgent } }),
    onSuccess: () => {
      setTestId('');
      setUrgent(false);
      onChanged();
    },
  });
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Lab tests</h2>
      <ErrorBox error={order.error} />
      {visit.labOrders.length === 0 ? (
        <p className="py-3 text-center text-sm text-slate-400">No tests ordered.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {visit.labOrders.map((o: any) => (
            <li key={o.id} className="py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-900">{o.test.name}{o.urgent && <span className="ml-2 text-xs text-red-600">urgent</span>}</span>
                <Badge value={o.status} />
              </div>
              {o.status === 'COMPLETED' && (
                <div className="mt-1 text-slate-600">
                  {o.result} <Badge value={o.flag} />
                  {o.test.normalRange && <span className="ml-2 text-xs text-slate-400">normal: {o.test.normalRange}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canOrder && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            order.mutate();
          }}
        >
          <select className="input min-w-0 flex-1" aria-label="Test" required value={testId} onChange={(e) => setTestId(e.target.value)}>
            <option value="">Order a test…</option>
            {(tests.data ?? []).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Urgent
          </label>
          <Button type="submit" size="sm" disabled={order.isPending}>
            Order
          </Button>
        </form>
      )}
    </Card>
  );
}

interface Item {
  medicineId: string;
  dosage: string;
  frequency: string;
  durationDays: string;
  quantity: string;
  instructions: string;
}
const blank = (): Item => ({ medicineId: '', dosage: '', frequency: '', durationDays: '5', quantity: '', instructions: '' });

function PrescribeModal({ encounterId, onClose, onDone }: { encounterId: string; onClose: () => void; onDone: () => void }) {
  const meds = useLookup(L.medicines);
  const [items, setItems] = useState<Item[]>([blank()]);
  const [notes, setNotes] = useState('');
  const save = useMutation({
    mutationFn: () =>
      api('/prescriptions', {
        method: 'POST',
        body: { encounterId, notes: notes || null, items: items.map((i) => ({ ...i, durationDays: Number(i.durationDays), quantity: Number(i.quantity), instructions: i.instructions || null })) },
      }),
    onSuccess: onDone,
  });
  const upd = (n: number, k: keyof Item, val: string) => setItems((s) => s.map((it, i) => (i === n ? { ...it, [k]: val } : it)));

  return (
    <Modal title="New prescription" onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <ErrorBox error={save.error} />
        {items.map((it, n) => (
          <div key={n} className="mb-3 grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label className="label">Medicine</label>
              <select className="input" required value={it.medicineId} onChange={(e) => upd(n, 'medicineId', e.target.value)}>
                <option value="">Select…</option>
                {(meds.data ?? []).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Dose</label>
              <input className="input" required placeholder="1 tablet" value={it.dosage} onChange={(e) => upd(n, 'dosage', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">How often</label>
              <input className="input" required placeholder="Three times a day" value={it.frequency} onChange={(e) => upd(n, 'frequency', e.target.value)} />
            </div>
            <div>
              <label className="label">Days</label>
              <input className="input" type="number" min={1} required value={it.durationDays} onChange={(e) => upd(n, 'durationDays', e.target.value)} />
            </div>
            <div>
              <label className="label">Quantity</label>
              <input className="input" type="number" min={1} required value={it.quantity} onChange={(e) => upd(n, 'quantity', e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <label className="label">Instructions</label>
              <input className="input" placeholder="After food" value={it.instructions} onChange={(e) => upd(n, 'instructions', e.target.value)} />
            </div>
            <div className="flex items-end justify-end">
              {items.length > 1 && (
                <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => setItems((s) => s.filter((_, i) => i !== n))}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => setItems((s) => [...s, blank()])}>
          + Add medicine
        </Button>
        <div className="mt-4">
          <label className="label">Note to the pharmacist</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Send to pharmacy'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
