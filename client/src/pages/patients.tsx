import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ResourcePage from '../components/ResourcePage';
import { Badge, Card, Empty, ErrorBox, PageHeader, Spinner, Table } from '../components/ui';
import { api, Page } from '../lib/api';
import { age, enumOptions, fmtDate, fmtDateTime, fmtMoney } from '../lib/format';
import { useAuth } from '../lib/auth';
import { canWrite } from '../lib/access';

/* eslint-disable @typescript-eslint/no-explicit-any */
const GENDERS = enumOptions(['FEMALE', 'MALE', 'OTHER']);
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({ value: v, label: v }));

export function Patients() {
  const { user } = useAuth();
  return (
    <ResourcePage
      title="Patients"
      subtitle="Everyone registered at the hospital. Patients are never deleted, so their history stays complete."
      singular="patient"
      endpoint="/patients"
      searchable
      canWrite={canWrite(user?.role, 'patients')}
      columns={[
        {
          header: 'Patient',
          cell: (r) => (
            <Link to={`/patients/${r.id}`} className="font-medium text-brand-700 hover:underline">
              {r.firstName} {r.lastName}
            </Link>
          ),
        },
        { header: 'MRN', cell: (r) => <span className="font-mono text-xs">{r.mrn}</span> },
        { header: 'Age', cell: (r) => `${age(r.dateOfBirth)} · ${r.gender.toLowerCase()}` },
        { header: 'Phone', cell: (r) => r.phone },
        { header: 'Allergies', cell: (r) => (r.allergies ? <span className="text-red-700">{r.allergies}</span> : '—') },
      ]}
      fields={[
        { name: 'firstName', label: 'First name', required: true },
        { name: 'lastName', label: 'Last name', required: true },
        { name: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true },
        { name: 'gender', label: 'Gender', type: 'select', required: true, options: GENDERS, defaultValue: 'FEMALE' },
        { name: 'phone', label: 'Phone', required: true },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'address', label: 'Address', wide: true },
        { name: 'bloodGroup', label: 'Blood group', type: 'select', options: BLOOD },
        { name: 'allergies', label: 'Allergies', help: 'Shown to doctors during the visit' },
        { name: 'emergencyName', label: 'Emergency contact' },
        { name: 'emergencyPhone', label: 'Emergency phone' },
        { name: 'insuranceProvider', label: 'Insurance provider' },
        { name: 'insuranceNo', label: 'Insurance number' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
    />
  );
}

export function PatientDetail() {
  const { id } = useParams();
  const p = useQuery({ queryKey: ['patient', id], queryFn: () => api<any>(`/patients/${id}`) });
  const appts = useQuery({ queryKey: ['patient-appts', id], queryFn: () => api<Page<any>>(`/appointments?patientId=${id}&pageSize=10`) });
  const invoices = useQuery({ queryKey: ['patient-inv', id], queryFn: () => api<Page<any>>(`/invoices?patientId=${id}&pageSize=10`), retry: false });
  if (p.isLoading) return <Spinner />;
  if (p.isError) return <ErrorBox error={p.error} />;
  const x = p.data;

  const facts: [string, string][] = [
    ['Medical record number', x.mrn],
    ['Born', `${fmtDate(x.dateOfBirth)} (${age(x.dateOfBirth)})`],
    ['Gender', x.gender.toLowerCase()],
    ['Phone', x.phone],
    ['Email', x.email ?? '—'],
    ['Blood group', x.bloodGroup ?? '—'],
    ['Emergency contact', x.emergencyName ? `${x.emergencyName} ${x.emergencyPhone ?? ''}` : '—'],
    ['Insurance', x.insuranceProvider ? `${x.insuranceProvider} ${x.insuranceNo ?? ''}` : '—'],
  ];

  return (
    <div>
      <PageHeader
        title={`${x.firstName} ${x.lastName}`}
        subtitle={x.address ?? undefined}
        actions={
          <Link to="/patients" className="text-sm text-brand-600 hover:underline">
            All patients
          </Link>
        }
      />
      {x.allergies && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">Allergies: {x.allergies}</div>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <dl className="space-y-3 text-sm">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
          {x.notes && <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">{x.notes}</p>}
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-900">Appointments</h2>
            {appts.data?.data.length ? (
              <Table head={['When', 'Doctor', 'Department', 'Status']}>
                {appts.data.data.map((a) => (
                  <tr key={a.id}>
                    <td className="td">{fmtDateTime(a.startsAt)}</td>
                    <td className="td">{a.doctor.name}</td>
                    <td className="td">{a.department.name}</td>
                    <td className="td">
                      <Badge value={a.status} />
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty>No appointments yet.</Empty>
            )}
          </Card>
          {invoices.data && (
            <Card>
              <h2 className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-900">Invoices</h2>
              {invoices.data.data.length ? (
                <Table head={['Number', 'Date', 'Total', 'Paid', 'Status']}>
                  {invoices.data.data.map((i) => (
                    <tr key={i.id}>
                      <td className="td font-mono text-xs">{i.number}</td>
                      <td className="td">{fmtDate(i.issuedAt)}</td>
                      <td className="td tabular-nums">{fmtMoney(i.total)}</td>
                      <td className="td tabular-nums">{fmtMoney(i.paid)}</td>
                      <td className="td">
                        <Badge value={i.status} />
                      </td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <Empty>No invoices yet.</Empty>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
