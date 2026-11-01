import type { Tx } from './prisma';

/** Atomic, gap-free-per-transaction document numbers: MRN-00001, APT-00001 … */
export async function nextNumber(tx: Tx, name: string, prefix: string): Promise<string> {
  const row = await tx.sequence.upsert({
    where: { name },
    create: { name, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(row.value).padStart(5, '0')}`;
}
