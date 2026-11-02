import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ResourcePage from '../components/ResourcePage';
import { Badge, Button, Card, Empty, ErrorBox, Modal, PageHeader, Spinner, Table } from '../components/ui';
import { api, Page } from '../lib/api';
import { fmtDateTime, fmtMoney, WEEKDAYS } from '../lib/format';
import { L } from '../lib/lookups';
import { useAuth } from '../lib/auth';
import { canWrite } from '../lib/access';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function Departments() {
  const { user } = useAuth();
  return (
    <ResourcePage
      title="Departments"
      subtitle="Each department offers its own services and has its own doctors."
      singular="department"
      endpoint="/departments"
      searchable
      canWrite={user?.role === 'ADMIN'}
      canDelete
      columns={[
        {
          header: 'Department',
          cell: (r) => (
            <Link to={`/departments/${r.id}`} className="font-medium text-brand-700 hover:underline">
              {r.name}
              <span className="ml-2 text-xs font-normal text-slate-500">{r.code}</span>
            </Link>
          ),
        },
        { header: 'Location', cell: (r) => r.location ?? '—' },
        { header: 'Services', cell: (r) => r._count.services },
        { header: 'Doctors', cell: (r) => r._count.doctors },
        { header: 'Status', cell: (r) => <Badge value={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'code', label: 'Code', required: true, help: 'Short, for example CARD' },
        { name: 'location', label: 'Location', wide: true },
        { name: 'description', label: 'What the department does', type: 'textarea' },
        { name: 'isActive', label: 'Active', type: 'checkbox', help: 'Open for appointments' },
      ]}
    />
  );
}

export function DepartmentDetail() {
  const { id } = useParams();
  const dep = useQuery({ queryKey: ['department', id], queryFn: () => api<any>(`/departments/${id}`) });
  const services = useQuery({ queryKey: ['dept-services', id], queryFn: () => api<Page<any>>(`/services?departmentId=${id}&pageSize=100`) });
  const doctors = useQuery({ queryKey: ['dept-doctors', id], queryFn: () => api<Page<any>>(`/doctors?departmentId=${id}&pageSize=100`) });
  if (dep.isLoading) return <Spinner />;
  if (dep.isError) return <ErrorBox error={dep.error} />;
  const d = dep.data;

  return (
    <div>
      <PageHeader
        title={d.name}
        subtitle={[d.location, d.description].filter(Boolean).join(' · ')}
        actions={
          <Link to="/departments" className="text-sm text-brand-600 hover:underline">
            All departments
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-900">Services</h2>
          {services.isLoading ? (
            <Spinner />
          ) : services.data?.data.length ? (
            <Table head={['Service', 'Time', 'Price']}>
              {services.data.data.map((s) => (
                <tr key={s.id}>
                  <td className="td">
                    <div className="font-medium text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.code}</div>
                  </td>
                  <td className="td">{s.durationMin} min</td>
                  <td className="td tabular-nums">{fmtMoney(s.price)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>This department has no services yet.</Empty>
          )}
        </Card>
        <Card>
          <h2 className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-900">Doctors</h2>
          {doctors.isLoading ? (
            <Spinner />
          ) : doctors.data?.data.length ? (
            <Table head={['Doctor', 'Works on', 'Fee']}>
              {doctors.data.data.map((x) => (
                <tr key={x.id}>
                  <td className="td">
                    <div className="font-medium text-slate-900">{x.name}</div>
                    <div className="text-xs text-slate-500">{x.specialization}</div>
                  </td>
                  <td className="td text-xs">{[...new Set(x.schedules.map((s: any) => WEEKDAYS[s.weekday].slice(0, 3)))].join(', ') || '—'}</td>
                  <td className="td tabular-nums">{fmtMoney(x.consultationFee)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No doctors are assigned yet.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}

export function Services() {
  const { user } = useAuth();
  const departments = useQuery({ queryKey: ['lookup', '/departments'], queryFn: () => api<Page<any>>('/departments?pageSize=200') });
  return (
    <ResourcePage
      title="Services"
      subtitle="What each department offers and what it costs. Services are chosen when an appointment is booked and added to the bill."
      singular="service"
      endpoint="/services"
      searchable
      canWrite={user?.role === 'ADMIN'}
      canDelete
      filters={[{ name: 'departmentId', label: 'Department', options: (departments.data?.data ?? []).map((d) => ({ value: d.id, label: d.name })) }]}
      columns={[
        {
          header: 'Service',
          cell: (r) => (
            <div>
              <div className="font-medium text-slate-900">{r.name}</div>
              <div className="text-xs text-slate-500">{r.code}</div>
            </div>
          ),
        },
        { header: 'Department', cell: (r) => r.department.name },
        { header: 'Time', cell: (r) => `${r.durationMin} min` },
        { header: 'Price', cell: (r) => <span className="tabular-nums">{fmtMoney(r.price)}</span> },
        { header: 'Status', cell: (r) => <Badge value={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
      ]}
      fields={[
        { name: 'departmentId', label: 'Department', type: 'select', required: true, lookup: L.departments },
        { name: 'code', label: 'Code', required: true },
        { name: 'name', label: 'Name', required: true, wide: true },
        { name: 'durationMin', label: 'Duration (minutes)', type: 'number', required: true, defaultValue: 15 },
        { name: 'price', label: 'Price', type: 'number', required: true, step: '0.01', min: 0 },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'isActive', label: 'Active', type: 'checkbox', help: 'Can be booked' },
      ]}
    />
  );
}

export function Doctors() {
  const { user } = useAuth();
  const admin = canWrite(user?.role, 'admin') || user?.role === 'ADMIN';
  const [scheduleFor, setScheduleFor] = useState<any | null>(null);
  const departments = useQuery({ queryKey: ['lookup', '/departments'], queryFn: () => api<Page<any>>('/departments?pageSize=200') });
  return (
    <>
      <ResourcePage
        title="Doctors"
        subtitle="Profiles, fees and weekly working hours. Appointment slots come from the working hours."
        singular="doctor"
        endpoint="/doctors"
        searchable
        canWrite={admin}
        filters={[{ name: 'departmentId', label: 'Department', options: (departments.data?.data ?? []).map((d) => ({ value: d.id, label: d.name })) }]}
        rowActions={(row) => (
          <Button variant="secondary" size="sm" onClick={() => setScheduleFor(row)}>
            Hours
          </Button>
        )}
        columns={[
          {
            header: 'Doctor',
            cell: (r) => (
              <div>
                <div className="font-medium text-slate-900">{r.name}</div>
                <div className="text-xs text-slate-500">{r.specialization} · {r.licenseNo}</div>
              </div>
            ),
          },
          { header: 'Department', cell: (r) => r.department.name },
          { header: 'Works on', cell: (r) => [...new Set(r.schedules.map((s: any) => WEEKDAYS[s.weekday].slice(0, 3)))].join(', ') || 'No hours set' },
          { header: 'Fee', cell: (r) => <span className="tabular-nums">{fmtMoney(r.consultationFee)}</span> },
          { header: 'Status', cell: (r) => <Badge value={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
        ]}
        fields={[
          { name: 'name', label: 'Name', required: true },
          { name: 'specialization', label: 'Specialization', required: true },
          { name: 'departmentId', label: 'Department', type: 'select', required: true, lookup: L.departments },
          { name: 'licenseNo', label: 'Licence number', required: true },
          { name: 'consultationFee', label: 'Consultation fee', type: 'number', required: true, step: '0.01', min: 0 },
          { name: 'userId', label: 'Login account', type: 'select', lookup: L.doctorUsers, help: 'Lets this doctor sign in and see their own appointments' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'phone', label: 'Phone' },
          { name: 'isActive', label: 'Active', type: 'checkbox', help: 'Takes appointments' },
        ]}
      />
      {scheduleFor && <HoursModal doctor={scheduleFor} canEdit={admin} onClose={() => setScheduleFor(null)} />}
    </>
  );
}

function HoursModal({ doctor, canEdit, onClose }: { doctor: any; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const hours = useQuery({ queryKey: ['hours', doctor.id], queryFn: () => api<Page<any>>(`/doctor-schedules?doctorId=${doctor.id}&pageSize=100`) });
  const off = useQuery({ queryKey: ['time-off', doctor.id], queryFn: () => api<Page<any>>(`/doctor-time-off?doctorId=${doctor.id}&pageSize=50`) });
  const [block, setBlock] = useState({ weekday: 1, startTime: '09:00', endTime: '13:00', slotMinutes: 20 });
  const [away, setAway] = useState({ startsAt: '', endsAt: '', reason: '' });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['hours', doctor.id] });
    qc.invalidateQueries({ queryKey: ['time-off', doctor.id] });
    qc.invalidateQueries({ queryKey: ['resource', '/doctors'] });
  };
  const add = useMutation({ mutationFn: () => api('/doctor-schedules', { method: 'POST', body: { doctorId: doctor.id, ...block } }), onSuccess: refresh });
  const del = useMutation({ mutationFn: (id: string) => api(`/doctor-schedules/${id}`, { method: 'DELETE' }), onSuccess: refresh });
  const addAway = useMutation({
    mutationFn: () => api('/doctor-time-off', { method: 'POST', body: { doctorId: doctor.id, startsAt: new Date(away.startsAt).toISOString(), endsAt: new Date(away.endsAt).toISOString(), reason: away.reason } }),
    onSuccess: () => {
      setAway({ startsAt: '', endsAt: '', reason: '' });
      refresh();
    },
  });
  const delAway = useMutation({ mutationFn: (id: string) => api(`/doctor-time-off/${id}`, { method: 'DELETE' }), onSuccess: refresh });

  return (
    <Modal title={`${doctor.name}: working hours`} onClose={onClose} wide>
      <ErrorBox error={add.error ?? del.error ?? addAway.error ?? delAway.error} />
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Weekly hours</h3>
      {hours.data?.data.length ? (
        <Table head={['Day', 'From', 'To', 'Slot length', ...(canEdit ? [''] : [])]}>
          {hours.data.data.map((h) => (
            <tr key={h.id}>
              <td className="td">{WEEKDAYS[h.weekday]}</td>
              <td className="td tabular-nums">{h.startTime}</td>
              <td className="td tabular-nums">{h.endTime}</td>
              <td className="td">{h.slotMinutes} min</td>
              {canEdit && (
                <td className="td text-right">
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => del.mutate(h.id)}>
                    Remove
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </Table>
      ) : (
        <Empty>No hours yet, so this doctor has no bookable slots.</Empty>
      )}
      {canEdit && (
        <form
          className="mt-3 grid items-end gap-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <div>
            <label className="label">Day</label>
            <select className="input" value={block.weekday} onChange={(e) => setBlock({ ...block, weekday: Number(e.target.value) })}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input className="input" type="time" value={block.startTime} onChange={(e) => setBlock({ ...block, startTime: e.target.value })} required />
          </div>
          <div>
            <label className="label">To</label>
            <input className="input" type="time" value={block.endTime} onChange={(e) => setBlock({ ...block, endTime: e.target.value })} required />
          </div>
          <div>
            <label className="label">Slot (min)</label>
            <input className="input" type="number" min={5} max={120} value={block.slotMinutes} onChange={(e) => setBlock({ ...block, slotMinutes: Number(e.target.value) })} />
          </div>
          <Button type="submit" disabled={add.isPending}>
            Add hours
          </Button>
        </form>
      )}

      <h3 className="mb-2 mt-8 text-sm font-semibold text-slate-900">Time away</h3>
      {off.data?.data.length ? (
        <Table head={['From', 'To', 'Reason', ...(canEdit ? [''] : [])]}>
          {off.data.data.map((o) => (
            <tr key={o.id}>
              <td className="td">{fmtDateTime(o.startsAt)}</td>
              <td className="td">{fmtDateTime(o.endsAt)}</td>
              <td className="td">{o.reason ?? '—'}</td>
              {canEdit && (
                <td className="td text-right">
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => delAway.mutate(o.id)}>
                    Remove
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </Table>
      ) : (
        <p className="text-sm text-slate-500">No time away is recorded.</p>
      )}
      {canEdit && (
        <form
          className="mt-3 grid items-end gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            addAway.mutate();
          }}
        >
          <div>
            <label className="label">From</label>
            <input className="input" type="datetime-local" required value={away.startsAt} onChange={(e) => setAway({ ...away, startsAt: e.target.value })} />
          </div>
          <div>
            <label className="label">To</label>
            <input className="input" type="datetime-local" required value={away.endsAt} onChange={(e) => setAway({ ...away, endsAt: e.target.value })} />
          </div>
          <div>
            <label className="label">Reason</label>
            <input className="input" value={away.reason} onChange={(e) => setAway({ ...away, reason: e.target.value })} />
          </div>
          <Button type="submit" variant="secondary" disabled={addAway.isPending}>
            Block this time
          </Button>
        </form>
      )}
    </Modal>
  );
}
