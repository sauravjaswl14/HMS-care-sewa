import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ResourcePage from '../components/ResourcePage';
import { Badge, Button, ErrorBox, Modal, Table } from '../components/ui';
import { api, Page, qs } from '../lib/api';
import { fmtDateTime, fmtMoney, titleCase } from '../lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function Invoices() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['resource', '/invoices'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  return (
    <>
      <ResourcePage
        title="Invoices"
        subtitle="Bill a completed visit from the Appointments page, a stay from Admissions, or write an invoice by hand here."
        singular="invoice"
        endpoint="/invoices"
        searchable
        filters={[{ name: 'status', label: 'Status', options: ['ISSUED', 'PARTIAL', 'PAID', 'VOID'].map((v) => ({ value: v, label: titleCase(v) })) }]}
        headerActions={<Button onClick={() => setCreating(true)}>+ New invoice</Button>}
        rowActions={(row) => (
          <Button size="sm" variant="secondary" onClick={() => setOpen(row.id)}>
            {['ISSUED', 'PARTIAL'].includes(row.status) ? 'Take payment' : 'Open'}
          </Button>
        )}
        columns={[
          { header: 'Invoice', cell: (r) => <div><div className="font-mono text-xs font-medium text-slate-900">{r.number}</div><div className="text-xs text-slate-500">{fmtDateTime(r.issuedAt)}</div></div> },
          { header: 'Patient', cell: (r) => `${r.patient.firstName} ${r.patient.lastName}` },
          { header: 'Total', cell: (r) => <span className="tabular-nums">{fmtMoney(r.total)}</span> },
          { header: 'Paid', cell: (r) => <span className="tabular-nums">{fmtMoney(r.paid)}</span> },
          { header: 'Balance', cell: (r) => <span className="tabular-nums">{fmtMoney(Number(r.total) - Number(r.paid))}</span> },
          { header: 'Status', cell: (r) => <Badge value={r.status} /> },
        ]}
      />
      {open && <InvoiceModal id={open} onClose={() => setOpen(null)} onChanged={refresh} />}
      {creating && <NewInvoiceModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); refresh(); }} />}
    </>
  );
}

function InvoiceModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const inv = useQuery({ queryKey: ['invoice', id], queryFn: () => api<any>(`/invoices/${id}`) });
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const done = () => {
    qc.invalidateQueries({ queryKey: ['invoice', id] });
    onChanged();
  };
  const pay = useMutation({
    mutationFn: () => api(`/invoices/${id}/payments`, { method: 'POST', body: { amount: Number(amount), method, reference: reference || null } }),
    onSuccess: () => {
      setAmount('');
      setReference('');
      done();
    },
  });
  const voidIt = useMutation({ mutationFn: () => api(`/invoices/${id}/void`, { method: 'POST' }), onSuccess: done });
  const v = inv.data;
  const balance = v ? Number(v.total) - Number(v.paid) : 0;

  return (
    <Modal title={v ? `${v.number} · ${v.patient.firstName} ${v.patient.lastName}` : 'Invoice'} onClose={onClose} wide>
      <ErrorBox error={pay.error ?? voidIt.error ?? (inv.isError ? inv.error : null)} />
      {v && (
        <>
          <Table head={['Item', 'Qty', 'Unit price', 'Amount']}>
            {v.lines.map((l: any) => (
              <tr key={l.id}>
                <td className="td">{l.description}</td>
                <td className="td">{l.quantity}</td>
                <td className="td tabular-nums">{fmtMoney(l.unitPrice)}</td>
                <td className="td tabular-nums">{fmtMoney(l.amount)}</td>
              </tr>
            ))}
          </Table>
          <dl className="ml-auto mt-3 w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{fmtMoney(v.subtotal)}</dd></div>
            {Number(v.discount) > 0 && <div className="flex justify-between"><dt className="text-slate-500">Discount</dt><dd className="tabular-nums">−{fmtMoney(v.discount)}</dd></div>}
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular-nums">{fmtMoney(v.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Paid</dt><dd className="tabular-nums">{fmtMoney(v.paid)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Balance</dt><dd className="tabular-nums">{fmtMoney(balance)}</dd></div>
          </dl>

          {v.payments.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-1 text-sm font-semibold text-slate-900">Payments</h3>
              <ul className="divide-y divide-slate-100 text-sm">
                {v.payments.map((p: any) => (
                  <li key={p.id} className="flex justify-between py-1.5">
                    <span>{fmtDateTime(p.paidAt)} · {titleCase(p.method)}{p.reference ? ` · ${p.reference}` : ''}</span>
                    <span className="tabular-nums">{fmtMoney(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {['ISSUED', 'PARTIAL'].includes(v.status) && (
            <form className="mt-6 grid items-end gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}>
              <div>
                <label className="label" htmlFor="pay-amt">Amount</label>
                <input id="pay-amt" className="input" type="number" min={0.01} step="0.01" max={balance} required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={balance.toFixed(2)} />
              </div>
              <div>
                <label className="label" htmlFor="pay-m">Method</label>
                <select id="pay-m" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                  {['CASH', 'CARD', 'INSURANCE', 'ONLINE'].map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="pay-ref">Reference</label>
                <input id="pay-ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={pay.isPending}>Record payment</Button>
                {Number(v.paid) === 0 && <Button type="button" variant="ghost" className="text-red-600" onClick={() => window.confirm('Void this invoice?') && voidIt.mutate()}>Void</Button>}
              </div>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}

interface Line { description: string; quantity: string; unitPrice: string }

function NewInvoiceModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [search, setSearch] = useState('');
  const [patientId, setPatientId] = useState('');
  const [discount, setDiscount] = useState('0');
  const [lines, setLines] = useState<Line[]>([{ description: '', quantity: '1', unitPrice: '' }]);
  const patients = useQuery({ queryKey: ['patient-search', search], queryFn: () => api<Page<any>>(`/patients${qs({ q: search, pageSize: 20 })}`) });
  const save = useMutation({
    mutationFn: () => api('/invoices', { method: 'POST', body: { patientId, discount: Number(discount), lines: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })) } }),
    onSuccess: onDone,
  });
  const upd = (n: number, k: keyof Line, v: string) => setLines((s) => s.map((l, i) => (i === n ? { ...l, [k]: v } : l)));
  const subtotal = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0);

  return (
    <Modal title="New invoice" onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <ErrorBox error={save.error} />
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input" placeholder="Search patient" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input" required aria-label="Patient" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Select a patient…</option>
            {patients.data?.data.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.mrn})</option>)}
          </select>
        </div>
        <div className="mt-4 space-y-2">
          {lines.map((l, n) => (
            <div key={n} className="grid gap-2 sm:grid-cols-[1fr_6rem_8rem_auto]">
              <input className="input" required placeholder="Description" aria-label="Description" value={l.description} onChange={(e) => upd(n, 'description', e.target.value)} />
              <input className="input" type="number" min={1} required aria-label="Quantity" value={l.quantity} onChange={(e) => upd(n, 'quantity', e.target.value)} />
              <input className="input" type="number" min={0} step="0.01" required placeholder="Unit price" aria-label="Unit price" value={l.unitPrice} onChange={(e) => upd(n, 'unitPrice', e.target.value)} />
              {lines.length > 1 ? <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => setLines((s) => s.filter((_, i) => i !== n))}>Remove</Button> : <span />}
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={() => setLines((s) => [...s, { description: '', quantity: '1', unitPrice: '' }])}>+ Add line</Button>
        </div>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="w-40">
            <label className="label" htmlFor="disc">Discount</label>
            <input id="disc" className="input" type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div className="text-right text-sm">
            <div className="text-slate-500">Total</div>
            <div className="text-xl font-semibold tabular-nums">{fmtMoney(Math.max(0, subtotal - Number(discount || 0)))}</div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending || !patientId}>Create invoice</Button>
        </div>
      </form>
    </Modal>
  );
}
