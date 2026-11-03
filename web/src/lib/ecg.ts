/**
 * One heartbeat as a path segment starting and ending on the baseline.
 * The shape is the textbook ECG: small P wave, sharp QRS spike, rounded T wave.
 */
export function beat(x: number, base: number, w: number, amp: number): string {
  const u = w / 20;
  return [
    `L${x + 2 * u} ${base}`,
    `Q${x + 3.5 * u} ${base - amp * 0.18} ${x + 5 * u} ${base}`, // P
    `L${x + 7 * u} ${base}`,
    `L${x + 8 * u} ${base + amp * 0.14}`, // Q
    `L${x + 9.2 * u} ${base - amp}`, // R
    `L${x + 10.6 * u} ${base + amp * 0.34}`, // S
    `L${x + 11.4 * u} ${base}`,
    `L${x + 13 * u} ${base}`,
    `Q${x + 15.5 * u} ${base - amp * 0.3} ${x + 18 * u} ${base}`, // T
    `L${x + w} ${base}`,
  ].join(' ');
}

/** A trace of `count` beats across a viewBox of `width` × `height`. */
export function trace(width: number, height: number, count: number, ampRatio = 0.42): { d: string } {
  const base = height / 2;
  const w = width / count;
  let d = `M0 ${base}`;
  for (let i = 0; i < count; i++) d += ' ' + beat(i * w, base, w, height * ampRatio);
  return { d };
}
