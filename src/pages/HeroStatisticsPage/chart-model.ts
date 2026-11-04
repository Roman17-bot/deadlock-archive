export type HistoryPoint = { date: string; value: number | null; matches: number };
export const dayTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
/** Keep small movements readable, normalizing values below display precision to unsigned zero. */
export function deltaValue(change: number) {
  let precision = 1;
  while (change !== 0 && Number(change.toFixed(precision)) === 0 && precision < 4) precision++;
  const value = Number(change.toFixed(precision)) || 0;
  return { value, precision };
}
/** Local domains show movement without changing the real values or connecting absent days. */
export function chartGeometry(history: HistoryPoint[], start: number, end: number) {
  const values = history.flatMap((p) => (p.value === null ? [] : [p.value]));
  const low = Math.min(...values),
    high = Math.max(...values);
  const padding = Math.max((high - low) * 0.15, (0.2 - (high - low)) / 2);
  const min = Math.max(0, low - padding),
    max = Math.min(100, high + padding);
  let previous: HistoryPoint | undefined;
  const points: (HistoryPoint & { x: number; y: number })[] = [];
  const path = history
    .map((p) => {
      if (p.value === null) {
        previous = undefined;
        return '';
      }
      const x = 8 + ((dayTime(p.date) - start) / Math.max(end - start, 86400000)) * 164;
      const y = high === low ? 28 : 48 - ((p.value - min) / (max - min)) * 40;
      points.push({ ...p, x, y });
      const connect = previous && dayTime(p.date) - dayTime(previous.date) === 86400000;
      previous = p;
      return `${connect ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  return { points, path };
}
