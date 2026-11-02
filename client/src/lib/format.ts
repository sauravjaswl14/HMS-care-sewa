const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtMoney = (v: unknown) => money.format(Number(v ?? 0));
export const fmtNum = (v: unknown) => new Intl.NumberFormat('en-US').format(Number(v ?? 0));

export const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/** ISO timestamp → value for <input type="date"> */
export const toInputDate = (v?: string | null) => (v ? v.slice(0, 10) : '');
export const today = () => new Date().toISOString().slice(0, 10);

export const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/^\w|\s\w/g, (c) => c.toUpperCase());

export const enumOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: titleCase(v) }));

export const fmtTime = (v?: string | null) => (v ? new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—');

export const age = (dob?: string | null) => {
  if (!dob) return '';
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return a < 2 ? `${Math.max(0, a * 12 + now.getMonth() - d.getMonth())} mo` : `${a} y`;
};

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
