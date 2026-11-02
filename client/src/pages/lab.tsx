import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import ResourcePage from '../components/ResourcePage';
import { Badge, Button, ErrorBox, Modal } from '../components/ui';
import { api } from '../lib/api';
import { fmtDateTime, fmtMoney } from '../lib/format';
import { L } from '../lib/lookups';
import { useAuth } from '../lib/auth';
import { canWrite } from '../lib/access';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function LabTests() {
  const { user } = useAuth();
  return (
    <ResourcePage
      title="Lab tests"
      subtitle="The tests the laboratory offers."
      singular="test"
      endpoint="/lab-tests"
      searchable
      canWrite={canWrite(user?.role, 'lab')}
      columns={[
        { header: 'Test', cell: (r) => <div><div className="font-medium text-slate-900">{r.name}</div><div className="text-xs text-slate-500">{r.code}</div></div> },
        { header: 'Sample', cell: (r) => r.sampleType ?? '—' },
        { header: 'Normal range', cell: (r) => r.normalRange ?? '—' },
        { header: 'Price', cell: (r) => <span className="tabular-nums">{fmtMoney(r.price)}</span> },
        { header: 'Status', cell: (r) => <Badge value={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'code', label: 'Code', required: true },
        { name: 'departmentId', label: 'Department', type: 'select', lookup: L.departments },
        { name: 'price', label: 'Price', type: 'number', required: true, step: '0.01', min: 0 },
        { name: 'sampleType', label: 'Sample', help: 'Blood, urine…' },
        { name: 'normalRange', label: 'Normal range' },
        { name: 'isActive', label: 'Active', type: 'checkbox', help: 'Can be ordered' },
      ]}
    />
  );
}

export function LabOrders() {
  const { user } = useAuth();
  const tech = user?.role === 'LAB_TECH' || user?.role === 'ADMIN';
  const [resultFor, setResultFor] = useState<any | null>(null);
  const [error, setError] = useState<unknown>(null);
  const act = (path: string, refresh: () => void) => async () => {
    setError(null);
    try {
      await api(path, { method: 'POST' });
      refresh();
    } catch (e) {
      setError(e);
    }
  };
  return (
    <>
      <ResourcePage
        title="Lab orders"
        subtitle="Urgent tests are listed first. Collect the sample, then enter the result."
        singular="order"
        endpoint="/lab-orders"
        filters={[{ name: 'status', label: 'Status', options: ['ORDERED', 'COLLECTED', 'COMPLETED', 'CANCELLED'].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() })) }]}
        headerActions={error ? <div className="max-w-md"><ErrorBox error={error} /></div> : null}
        rowActions={(row, refresh) =>
          tech ? (
            <>
              {row.status === 'ORDERED' && <Button size="sm" onClick={act(`/lab-orders/${row.id}/collect`, refresh)}>Sample collected</Button>}
              {row.status === 'COLLECTED' && <Button size="sm" onClick={() => setResultFor({ row, refresh })}>Enter result</Button>}
            </>
          ) : null
        }
        columns={[
          { header: 'Order', cell: (r) => <span className="font-mono text-xs">{r.number}</span> },
          { header: 'Patient', cell: (r) => `${r.patient.firstName} ${r.patient.lastName}` },
          { header: 'Test', cell: (r) => <div>{r.test.name}{r.urgent && <span className="ml-2 text-xs font-medium text-red-600">Urgent</span>}<div className="text-xs text-slate-500">{r.test.sampleType}</div></div> },
          { header: 'Result', cell: (r) => (r.result ? <div>{r.result} <Badge value={r.flag} /></div> : '—') },
          { header: 'Ordered', cell: (r) => fmtDateTime(r.createdAt) },
          { header: 'Status', cell: (r) => <Badge value={r.status} /> },
        ]}
      />
      {resultFor && <ResultModal order={resultFor.row} onClose={() => setResultFor(null)} onDone={() => { resultFor.refresh(); setResultFor(null); }} />}
    </>
  );
}

function ResultModal({ order, onClose, onDone }: { order: any; onClose: () => void; onDone: () => void }) {
  const [result, setResult] = useState('');
  const [flag, setFlag] = useState('NORMAL');
  const save = useMutation({ mutationFn: () => api(`/lab-orders/${order.id}/result`, { method: 'POST', body: { result, flag } }), onSuccess: onDone });
  return (
    <Modal title={`Result: ${order.test.name}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <ErrorBox error={save.error} />
        <p className="mb-3 text-sm text-slate-600">{order.patient.firstName} {order.patient.lastName}{order.test.normalRange ? ` · normal: ${order.test.normalRange}` : ''}</p>
        <label className="label" htmlFor="res">Result</label>
        <textarea id="res" className="input min-h-[90px]" required autoFocus value={result} onChange={(e) => setResult(e.target.value)} />
        <label className="label mt-4" htmlFor="flag">Reading</label>
        <select id="flag" className="input" value={flag} onChange={(e) => setFlag(e.target.value)}>
          <option value="NORMAL">Normal</option>
          <option value="ABNORMAL">Abnormal</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>Save result</Button>
        </div>
      </form>
    </Modal>
  );
}
