import { NEAREST_WINDOW_YEARS } from "./indicators";
import type { SeriesMap } from "./normalize";

/** A value resolved for a requested year. Always backed by a real World Bank observation. */
export interface ResolvedValue {
  code: string;
  requestedYear: number;
  observationYear: number;
  value: number;
  /** True when a nearby year's observation stands in for the requested year. */
  isEstimated: boolean;
  obsStatus: string | null;
  source: "World Bank Indicators API";
}

/**
 * Nearest-observation rule:
 * 1. an observation in the requested year;
 * 2. otherwise the closest observation within NEAREST_WINDOW_YEARS, preferring the earlier year on a tie;
 * 3. otherwise null. Missing data is never replaced with zero or an invented value.
 *
 * `notAfter` stops the search from looking past a year, so gameplay never peeks at the country's future.
 */
export function resolveNearest(
  series: SeriesMap,
  code: string,
  requestedYear: number,
  options: { window?: number; notAfter?: number } = {},
): ResolvedValue | null {
  const window = options.window ?? NEAREST_WINDOW_YEARS;
  const points = series[code] ?? [];
  let best: (typeof points)[number] | null = null;
  for (const point of points) {
    const distance = Math.abs(point.year - requestedYear);
    if (distance > window) continue;
    if (options.notAfter !== undefined && point.year > options.notAfter) continue;
    if (
      best === null ||
      distance < Math.abs(best.year - requestedYear) ||
      (distance === Math.abs(best.year - requestedYear) && point.year < best.year)
    ) {
      best = point;
    }
  }
  if (!best) return null;
  return {
    code,
    requestedYear,
    observationYear: best.year,
    value: best.value,
    isEstimated: best.year !== requestedYear,
    obsStatus: best.obsStatus,
    source: "World Bank Indicators API",
  };
}

/** Real observations strictly before a year, for baseline trends that must not use the future. */
export function pastPoints(series: SeriesMap, code: string, beforeYear: number, lookback: number) {
  return (series[code] ?? []).filter((p) => p.year < beforeYear && p.year >= beforeYear - lookback);
}

/** Average annual change of a series over the past, or null with fewer than two points. */
export function averageAnnualChange(points: { year: number; value: number }[], mode: "difference" | "percent"): number | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const years = last.year - first.year;
  if (years <= 0) return null;
  if (mode === "difference") return (last.value - first.value) / years;
  if (first.value <= 0 || last.value <= 0) return null;
  return (Math.pow(last.value / first.value, 1 / years) - 1) * 100;
}

/**
 * Typical annual change: the median of the per-year change between consecutive observations.
 * Unlike a first-to-last average, one statistical break in a series (for example South Africa's
 * enrollment jumping from 81% to 105% in 1989 when coverage changed) cannot dominate the trend.
 */
export function robustAnnualChange(points: { year: number; value: number }[], mode: "difference" | "percent"): number | null {
  const rates: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const years = b.year - a.year;
    if (years <= 0) continue;
    if (mode === "difference") rates.push((b.value - a.value) / years);
    else if (a.value > 0 && b.value > 0) rates.push((Math.pow(b.value / a.value, 1 / years) - 1) * 100);
  }
  if (!rates.length) return null;
  rates.sort((x, y) => x - y);
  const mid = Math.floor(rates.length / 2);
  return rates.length % 2 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2;
}

export function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
