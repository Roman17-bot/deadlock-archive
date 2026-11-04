import { describe, it, expect } from 'vitest';
import {
  chartGeometry,
  deltaValue,
  markerIndices,
} from '../src/pages/HeroStatisticsPage/chart-model';
const p = (date: string, value: number | null) => ({ date, value, matches: 10 });
describe('statistics chart geometry', () => {
  it('preserves a 0.02pp movement and tiny negative changes without signed zero', () => {
    expect(deltaValue(0.02)).toEqual({ value: 0.02, precision: 2 });
    expect(deltaValue(-0.0002)).toEqual({ value: -0.0002, precision: 4 });
    expect(deltaValue(-0.0000004)).toEqual({ value: 0, precision: 4 });
    expect(Object.is(deltaValue(-0.0000004).value, -0)).toBe(false);
    expect(deltaValue(0.0000004).value).toBe(0);
  });
  it('makes small real changes visible in a local domain', () => {
    const chart = chartGeometry(
      [p('2026-10-01', 50), p('2026-10-02', 50.1)],
      Date.parse('2026-10-01'),
      Date.parse('2026-10-02'),
    );
    expect(Math.abs(chart.points[0].y - chart.points[1].y)).toBeGreaterThan(15);
  });
  it('keeps constant values flat and breaks missing days', () => {
    const chart = chartGeometry(
      [p('2026-10-01', 5), p('2026-10-02', 5), p('2026-10-04', 5)],
      Date.parse('2026-10-01'),
      Date.parse('2026-10-04'),
    );
    expect(new Set(chart.points.map((p) => p.y)).size).toBe(1);
    expect(chart.path.match(/M/g)).toHaveLength(2);
  });
  it('preserves explicit null gaps and isolated observations', () => {
    const chart = chartGeometry(
      [p('2026-10-01', 5), p('2026-10-02', null), p('2026-10-03', 6)],
      Date.parse('2026-10-01'),
      Date.parse('2026-10-03'),
    );
    expect(chart.points).toHaveLength(2);
    expect(chart.path.match(/M/g)).toHaveLength(2);
  });
  it('anchors weekly marker buckets to the requested start and skips absent observations', () => {
    const points = [
      p('2026-10-03', 5),
      p('2026-10-07', 6),
      p('2026-10-08', null),
      p('2026-10-10', 7),
      p('2026-10-21', 8),
    ];
    expect(markerIndices(points, 30, Date.parse('2026-10-02'))).toEqual([1, 3, 4]);
    expect(points[markerIndices(points, 30, Date.parse('2026-10-02'))[0]].date).toBe('2026-10-07');
  });
  it('uses UTC calendar months across the year boundary without inventing missing months', () => {
    const points = [
      p('2025-12-10', 5),
      p('2025-12-31', 6),
      p('2026-01-01', 7),
      p('2026-01-31', null),
      p('2026-03-10', 8),
    ];
    expect(markerIndices(points, 365, Date.parse('2025-12-01'))).toEqual([1, 2, 4]);
  });
  it('returns only actual daily observations for weekly markers', () => {
    const points = [p('2026-10-01', 5), p('2026-10-02', null), p('2026-10-03', 6)];
    expect(markerIndices(points, 7, Date.parse('2026-10-01'))).toEqual([0, 2]);
  });
});
