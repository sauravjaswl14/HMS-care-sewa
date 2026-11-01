/** Money is handled in whole cents so sums never drift. */
export const toCents = (v: number | string | { toString(): string }): number => Math.round(Number(v.toString()) * 100);
export const fromCents = (c: number): number => c / 100;

export function totals(lines: { quantity: number; unitPrice: number }[], discount: number) {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * toCents(l.unitPrice), 0);
  const disc = toCents(discount);
  if (disc > subtotal) throw new RangeError('The discount cannot be more than the subtotal');
  return { subtotal: fromCents(subtotal), discount: fromCents(disc), total: fromCents(subtotal - disc) };
}

export function afterPayment(total: number, alreadyPaid: number, amount: number) {
  const balance = toCents(total) - toCents(alreadyPaid);
  const pay = toCents(amount);
  if (pay <= 0) throw new RangeError('The payment must be more than zero');
  if (pay > balance) throw new RangeError(`The payment is more than the balance of ${fromCents(balance).toFixed(2)}`);
  const paid = fromCents(toCents(alreadyPaid) + pay);
  return { paid, status: pay === balance ? ('PAID' as const) : ('PARTIAL' as const) };
}

/** Whole days of a stay, counting any started day, at least one. */
export function stayDays(from: Date, to: Date): number {
  return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
}
