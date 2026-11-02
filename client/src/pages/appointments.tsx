import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Page, qs } from '../lib/api';
import { Badge, Button, Card, Empty, ErrorBox, Modal, PageHeader, Pagination, Spinner, Table } from '../components/ui';
import { fmtDate, fmtTime, titleCase, today } from '../lib/format';
import { useAuth } from '../lib/auth';
import { canRead, canWrite } from '../lib/access';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATUSES = ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

export default function Appointments() {
  const { user } = useAuth();
  const role = user?.role;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [booking, setBooking] = useState<any | 'new' | null>(null);

  const doctors = useQuery({ queryKey: ['lookup', '/doctors?isActive=true'], queryFn: () => api<Page<any>>('/doctors?isActive=true&pageSize=200') });
  const list = useQuery({
    queryKey: ['appointments', date, status, doctorId, q, page],
    queryFn: () => api<Page<any>>(`/appointments${qs({ date, status, doctorId, q, page, pageSize: 20, sort: 'asc' })}`),
    placeholderData: (p) => p,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['appointments'] });

  const move = useMutation({
    mutationFn: (v: { id: string; status: string }) => api(`/appointments/${v.id}/status`, { method: 'POST', body: { status: v.status } }),
    onSuccess: refresh,
  });
  const start = useMutation({
    mutationFn: (id: string) => api<any>('/encounters/start', { method: 'POST', body: { appointmentId: id } }),
    onSuccess: (enc) => navigate(`/visits/${enc.id}`),
  });
  const bill = useMutation({
    mutationFn: (id: string) => api<any>(`/invoices/from-appointment/${id}`, { method: 'POST' }),
    onSuccess: () => {
      refresh();
      navigate('/billing/invoices');
    },
  });

  const can = (...r: string[]) => role === 'ADMIN' || (!!role && r.includes(role));
  const rows = list.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle="Book, check in and follow every visit through the day."
        actions={canWrite(role, 'appointments') ? <Button onClick={() => setBooking('new')}>+ Book appointment</Button> : null}
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <input
            type="date"
            className="input w-auto"
            aria-label="Date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => setDate(today())}>
            Today
          </Button>
          <button className="text-xs text-slate-500 hover:underline" onClick={() => setDate('')}>
            All dates
          </button>
          <select className="input w-auto" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Status: all</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </select>
          {role !== 'DOCTOR' && (
            <select className="input w-auto" aria-label="Doctor" value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setPage(1); }}>
              <option value="">Doctor: all</option>
              {(doctors.data?.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          <input className="input max-w-[14rem]" placeholder="Patient or number" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <div className="px-4 pt-4 empty:hidden">
          <ErrorBox error={move.error ?? start.error ?? bill.error ?? (list.isError ? list.error : null)} />
        </div>
        {list.isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty>No appointments {date ? `on ${fmtDate(date)}` : 'found'}.</Empty>
        ) : (
          <Table head={['Time', 'Patient', 'Doctor', 'Reason', 'Status', '']}>
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/60">
                <td className="td whitespace-nowrap tabular-nums">
                  <div className="font-medium text-slate-900">{fmtTime(a.startsAt)}</div>
                  {!date && <div className="text-xs text-slate-500">{fmtDate(a.startsAt)}</div>}
                </td>
                <td className="td">
                  {canRead(role, 'patients') ? (
                    <Link to={`/patients/${a.patient.id}`} className="font-medium text-brand-700 hover:underline">
                      {a.patient.firstName} {a.patient.lastName}
                    </Link>
                  ) : (
                    `${a.patient.firstName} ${a.patient.lastName}`
                  )}
                  <div className="font-mono text-xs text-slate-500">{a.number}</div>
                </td>
                <td className="td">
                  {a.doctor.name}
                  <div className="text-xs text-slate-500">{a.department.name}{a.service ? ` · ${a.service.name}` : ''}</div>
                </td>
                <td className="td text-slate-600">{a.reason ?? '—'}</td>
                <td className="td">
                  <Badge value={a.status} />
                </td>
                <td className="td whitespace-nowrap text-right">
                  <div className="flex justify-end gap-1.5">
                    {a.status === 'SCHEDULED' && can('RECEPTIONIST', 'NURSE') && (
                      <Button size="sm" disabled={move.isPending} onClick={() => move.mutate({ id: a.id, status: 'CHECKED_IN' })}>
                        Check in
                      </Button>
                    )}
                    {a.status === 'CHECKED_IN' && can('DOCTOR') && (
                      <Button size="sm" disabled={start.isPending} onClick={() => start.mutate(a.id)}>
                        Start visit
                      </Button>
                    )}
                    {['IN_PROGRESS', 'COMPLETED'].includes(a.status) && a.encounter && canRead(role, 'encounters') && (
                      <Link to={`/visits/${a.encounter.id}`} className="inline-flex items-center rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        Open visit
                      </Link>
                    )}
                    {a.status === 'COMPLETED' && can('BILLING', 'RECEPTIONIST') && (
                      <Button size="sm" variant="secondary" disabled={bill.isPending} onClick={() => bill.mutate(a.id)}>
                        Bill visit
                      </Button>
                    )}
                    {['SCHEDULED', 'CHECKED_IN'].includes(a.status) && can('RECEPTIONIST', 'DOCTOR') && (
                      <Button size="sm" variant="secondary" onClick={() => setBooking(a)}>
                        Reschedule
                      </Button>
                    )}
                    {['SCHEDULED', 'CHECKED_IN'].includes(a.status) && can('RECEPTIONIST', 'NURSE') && (
                      <Button size="sm" variant="ghost" className="text-slate-600" disabled={move.isPending} onClick={() => window.confirm('Mark this patient as a no-show?') && move.mutate({ id: a.id, status: 'NO_SHOW' })}>
                        No-show
                      </Button>
                    )}
                    {['SCHEDULED', 'CHECKED_IN'].includes(a.status) && can('RECEPTIONIST', 'DOCTOR') && (
                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" disabled={move.isPending} onClick={() => window.confirm('Cancel this appointment? The slot becomes free.') && move.mutate({ id: a.id, status: 'CANCELLED' })}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination page={page} pageSize={20} total={list.data?.total ?? 0} onPage={setPage} />
      </Card>
      {booking && (
        <BookingModal
          existing={booking === 'new' ? null : booking}
          onClose={() => setBooking(null)}
          onDone={() => {
            setBooking(null);
            refresh();
            qc.invalidateQueries({ queryKey: ['dashboard'] });
          }}
        />
      )}
    </div>
  );
}

/** Pick patient, department, doctor and day; the slot grid comes from the doctor's working hours. */
function BookingModal({ existing, onClose, onDone }: { existing: any | null; onClose: () => void; onDone: () => void }) {
  const rescheduling = !!existing;
  const { user } = useAuth();
  const [patientQ, setPatientQ] = useState('');
  const [patientId, setPatientId] = useState('');
  const [departmentId, setDepartmentId] = useState(existing?.department.id ?? '');
  const [doctorId, setDoctorId] = useState(existing?.doctor.id ?? (user?.role === 'DOCTOR' ? user.doctorId ?? '' : ''));
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [reason, setReason] = useState('');

  const patients = useQuery({
    queryKey: ['patient-search', patientQ],
    enabled: !rescheduling,
    queryFn: () => api<Page<any>>(`/patients${qs({ q: patientQ, pageSize: 20 })}`),
  });
  const departments = useQuery({ queryKey: ['lookup', '/departments'], queryFn: () => api<Page<any>>('/departments?isActive=true&pageSize=200') });
  const doctors = useQuery({
    queryKey: ['doctors-in', departmentId],
    enabled: !!departmentId,
    queryFn: () => api<Page<any>>(`/doctors?departmentId=${departmentId}&isActive=true&pageSize=100`),
  });
  const services = useQuery({
    queryKey: ['services-in', departmentId],
    enabled: !!departmentId && !rescheduling,
    queryFn: () => api<Page<any>>(`/services?departmentId=${departmentId}&isActive=true&pageSize=100`),
  });
  const slots = useQuery({
    queryKey: ['slots', doctorId, date],
    enabled: !!doctorId && !!date,
    queryFn: () => api<any>(`/appointments/availability${qs({ doctorId, date })}`),
  });

  const save = useMutation({
    mutationFn: () =>
      rescheduling
        ? api(`/appointments/${existing.id}/reschedule`, { method: 'POST', body: { date, time } })
        : api('/appointments', { method: 'POST', body: { patientId, doctorId, date, time, serviceId: serviceId || null, reason: reason || null } }),
    onSuccess: onDone,
    onError: () => slots.refetch(), // the slot may have been taken; show what is free now
  });

  const free = (slots.data?.slots ?? []).filter((s: any) => s.available).length;

  return (
    <Modal title={rescheduling ? `Reschedule ${existing.number}` : 'Book an appointment'} onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <ErrorBox error={save.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          {!rescheduling && (
            <div className="sm:col-span-2">
              <label className="label" htmlFor="bk-patient">Patient <span className="text-red-500">*</span></label>
              <div className="grid gap-2 sm:grid-cols-2">
                <input className="input" placeholder="Search by name, record number or phone" value={patientQ} onChange={(e) => setPatientQ(e.target.value)} />
                <select id="bk-patient" className="input" required value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                  <option value="">{patients.isLoading ? 'Searching…' : 'Select a patient…'}</option>
                  {(patients.data?.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} ({p.mrn})
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-xs text-slate-400">New patient? Register them on the Patients page first.</p>
            </div>
          )}
          <div>
            <label className="label" htmlFor="bk-dept">Department <span className="text-red-500">*</span></label>
            <select
              id="bk-dept"
              className="input"
              required
              disabled={rescheduling}
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setDoctorId('');
                setServiceId('');
                setTime('');
              }}
            >
              <option value="">Select…</option>
              {(departments.data?.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="bk-doc">Doctor <span className="text-red-500">*</span></label>
            <select id="bk-doc" className="input" required disabled={rescheduling || !departmentId} value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setTime(''); }}>
              <option value="">{departmentId ? 'Select…' : 'Choose a department first'}</option>
              {(doctors.data?.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}, {d.specialization}
                </option>
              ))}
            </select>
          </div>
          {!rescheduling && (
            <div>
              <label className="label" htmlFor="bk-svc">Service</label>
              <select id="bk-svc" className="input" disabled={!departmentId} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                <option value="">— Consultation only —</option>
                {(services.data?.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="bk-date">Date <span className="text-red-500">*</span></label>
            <input id="bk-date" className="input" type="date" required min={today()} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} />
          </div>
          <div className="sm:col-span-2">
            <div className="label">Time {slots.data && <span className="font-normal text-slate-400">({free} free{slots.data.slots.length ? ` of ${slots.data.slots.length}` : ''}, {slots.data.timezone})</span>}</div>
            {!doctorId ? (
              <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-400">Choose a doctor to see their free times.</p>
            ) : slots.isLoading ? (
              <Spinner />
            ) : slots.data?.slots.length === 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-4 text-sm text-amber-800">This doctor does not work on that day. Try another date.</p>
            ) : (
              <div role="radiogroup" aria-label="Available times" className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {slots.data?.slots.map((s: any) => (
                  <button
                    key={s.time}
                    type="button"
                    role="radio"
                    aria-checked={time === s.time}
                    disabled={!s.available}
                    title={s.reason ? titleCase(s.reason) : undefined}
                    onClick={() => setTime(s.time)}
                    className={`rounded-lg border px-2 py-1.5 text-sm tabular-nums transition-colors ${
                      time === s.time
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : s.available
                          ? 'border-slate-300 bg-white text-slate-800 hover:border-brand-500 hover:bg-brand-50'
                          : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through'
                    }`}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!rescheduling && (
            <div className="sm:col-span-2">
              <label className="label" htmlFor="bk-reason">Reason for visit</label>
              <input id="bk-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: chest tightness when climbing stairs" />
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending || !time || (!rescheduling && !patientId)}>
            {save.isPending ? 'Saving…' : rescheduling ? 'Move appointment' : 'Book appointment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
