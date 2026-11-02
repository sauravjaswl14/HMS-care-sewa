import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import ResourcePage from '../components/ResourcePage';
import { Badge, Button, ErrorBox, Modal } from '../components/ui';
import { api } from '../lib/api';
import { fmtDateTime, fmtMoney } from '../lib/format';
import { useAuth } from '../lib/auth';
import { canWrite } from '../lib/access';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function Medicines() {
  const { user } = useAuth();
  const [restock, setRestock] = useState<any | null>(null);
  const writer = canWrite(user?.role, 'pharmacy');
  return (
    <>
      <ResourcePage
        title="Medicines"
        subtitle="Stock on the pharmacy shelf. Dispensing a prescription reduces it."
        singular="medicine"
        endpoint="/medicines"
        searchable
        canWrite={writer}
        rowActions={(row) =>
          writer ? (
            <Button size="sm" variant="secondary" onClick={() => setRestock(row)}>
              Add stock
            </Button>
          ) : null
        }
        columns={[
          {
            header: 'Medicine',
            cell: (r) => (
              <div>
                <div className="font-medium text-slate-900">{r.name} {r.strength}</div>
                <div className="text-xs text-slate-500">{r.genericName ?? ''} · {r.form} · {r.sku}</div>
              </div>
            ),
          },
          {
            header: 'In stock',
            cell: (r) => (
              <span className={r.stock <= r.reorderLevel ? 'font-medium text-amber-700' : ''}>
                {r.stock}
                {r.stock <= r.reorderLevel && <span className="ml-1 text-xs">low</span>}
              </span>
            ),
          },
          { header: 'Reorder at', cell: (r) => r.reorderLevel },
          { header: 'Price', cell: (r) => <span className="tabular-nums">{fmtMoney(r.unitPrice)}</span> },
          { header: 'Status', cell: (r) => <Badge value={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
        ]}
        fields={[
          { name: 'name', label: 'Name', required: true },
          { name: 'genericName', label: 'Generic name' },
          { name: 'sku', label: 'Code', required: true },
          { name: 'form', label: 'Form', required: true, help: 'Tablet, capsule, syrup…' },
          { name: 'strength', label: 'Strength', help: 'For example 500 mg' },
          { name: 'unitPrice', label: 'Price per unit', type: 'number', required: true, step: '0.01', min: 0 },
          { name: 'stock', label: 'Stock', type: 'number', required: true, min: 0, defaultValue: 0 },
          { name: 'reorderLevel', label: 'Reorder level', type: 'number', required: true, min: 0, defaultValue: 20 },
          { name: 'isActive', label: 'Active', type: 'checkbox', help: 'Can be prescribed' },
        ]}
      />
      {restock && <RestockModal med={restock} onClose={() => setRestock(null)} />}
    </>
  );
}

function RestockModal({ med, onClose }: { med: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [qty, setQty] = useState('');
  const save = useMutation({
    mutationFn: () => api(`/medicines/${med.id}/restock`, { method: 'POST', body: { quantity: Number(qty) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resource', '/medicines'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
  });
  return (
    <Modal title={`Add stock: ${med.name}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <ErrorBox error={save.error} />
        <p className="mb-3 text-sm text-slate-600">Currently {med.stock} in stock.</p>
        <label className="label" htmlFor="qty">Quantity received</label>
        <input id="qty" className="input" type="number" min={1} required autoFocus value={qty} onChange={(e) => setQty(e.target.value)} />
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>Add to stock</Button>
        </div>
      </form>
    </Modal>
  );
}

export function Prescriptions() {
  const { user } = useAuth();
  const pharmacist = user?.role === 'PHARMACIST' || user?.role === 'ADMIN';
  const [error, setError] = useState<unknown>(null);
  return (
    <ResourcePage
      title="Prescriptions"
      subtitle="Written by doctors, handed over by the pharmacy."
      singular="prescription"
      endpoint="/prescriptions"
      filters={[{ name: 'status', label: 'Status', options: ['PENDING', 'DISPENSED', 'CANCELLED'].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() })) }]}
      headerActions={error ? <div className="max-w-md"><ErrorBox error={error} /></div> : null}
      rowActions={(row, refresh) =>
        pharmacist && row.status === 'PENDING' ? (
          <Button
            size="sm"
            onClick={async () => {
              setError(null);
              try {
                await api(`/prescriptions/${row.id}/dispense`, { method: 'POST' });
                refresh();
              } catch (e) {
                setError(e);
              }
            }}
          >
            Dispense
          </Button>
        ) : null
      }
      columns={[
        { header: 'Number', cell: (r) => <span className="font-mono text-xs">{r.number}</span> },
        { header: 'Patient', cell: (r) => <div><div className="font-medium text-slate-900">{r.patient.firstName} {r.patient.lastName}</div><div className="text-xs text-slate-500">{r.encounter.doctor.name}</div></div> },
        {
          header: 'Medicines',
          cell: (r) => (
            <ul className="text-sm">
              {r.items.map((i: any) => (
                <li key={i.id}>
                  {i.medicine.name} {i.medicine.strength} × {i.quantity}
                  {r.status === 'PENDING' && i.medicine.stock < i.quantity && <span className="ml-1 text-xs text-red-600">only {i.medicine.stock} in stock</span>}
                </li>
              ))}
            </ul>
          ),
        },
        { header: 'Written', cell: (r) => fmtDateTime(r.createdAt) },
        { header: 'Status', cell: (r) => <Badge value={r.status} /> },
      ]}
    />
  );
}
