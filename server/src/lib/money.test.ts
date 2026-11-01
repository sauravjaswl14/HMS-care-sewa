import test from 'node:test';
import assert from 'node:assert/strict';
import { afterPayment, stayDays, totals } from './money';

test('totals sum in cents without float drift', () => {
  const t = totals([{ quantity: 3, unitPrice: 0.1 }, { quantity: 1, unitPrice: 19.99 }], 0.3);
  assert.deepEqual(t, { subtotal: 20.29, discount: 0.3, total: 19.99 });
});

test('discount cannot exceed subtotal', () => {
  assert.throws(() => totals([{ quantity: 1, unitPrice: 10 }], 10.01), RangeError);
});

test('payments move an invoice to partial then paid and never overpay', () => {
  assert.deepEqual(afterPayment(100, 0, 40), { paid: 40, status: 'PARTIAL' });
  assert.deepEqual(afterPayment(100, 40, 60), { paid: 100, status: 'PAID' });
  assert.throws(() => afterPayment(100, 40, 60.01), /balance of 60.00/);
  assert.throws(() => afterPayment(100, 0, 0), RangeError);
});

test('stayDays counts started days, minimum one', () => {
  assert.equal(stayDays(new Date('2026-11-01T10:00:00Z'), new Date('2026-11-01T12:00:00Z')), 1);
  assert.equal(stayDays(new Date('2026-11-01T10:00:00Z'), new Date('2026-11-03T10:00:01Z')), 3);
});
