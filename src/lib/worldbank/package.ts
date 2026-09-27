// Pure functions that turn raw World Bank series into game packages. No network access here,
// so they are unit-tested with fixtures and reused by the server routes.
import { EDUCATION_CANDIDATES, INDICATORS, INDICATOR_IDS, SCORE_CATEGORIES, WORLD_INDICATORS, type IndicatorId, type WorldKey } from "./indicators";
import type { SeriesMap } from "./normalize";
import { averageAnnualChange, mean, pastPoints, resolveNearest, type ResolvedValue } from "./observations";

export const TOTAL_TURNS = 10;
export const YEARS_PER_TURN = 2;
export const GAME_YEARS = TOTAL_TURNS * YEARS_PER_TURN;
export const START_YEAR_RANGE = { first: 1990, last: 2004 };

/**
 * Indicators the simulation cannot run without. Everything else (trade, FDI, unemployment,
 * enrollment, emissions, and so on) is simulated when the country has data and skipped when it does not.
 */
export const REQUIRED_AT_START: IndicatorId[] = ["population", "popGrowth", "gdpPerCapita", "gdpGrowth", "lifeExpectancy", "infantMortality", "electricity"];
/** Placeholder education code when no enrollment series has coverage; it resolves to no data and is skipped. */
export const NO_EDUCATION_CODE = "SE.PRM.ENRR";

/** A country from the World Bank country API. The region code is also a World Bank aggregate code. */
export interface CountryConfig {
  code: string;
  name: string;
  regionCode: string;
  regionName: string;
  incomeLevel: string;
  capital: string;
  latitude: number | null;
  longitude: number | null;
}

/** Suggested starting countries on the landing page. Any country with enough data is playable. */
export const FEATURED_COUNTRIES = ["VNM", "BRA", "GHA", "IND", "KEN", "BGD"];

export function codeFor(id: IndicatorId, educationCode: string): string {
  return id === "education" ? educationCode : INDICATORS[id].code;
}

/** First education indicator with a real observation near both the start and end year. */
export function pickEducationCode(series: SeriesMap, start: number, end: number): string | null {
  for (const candidate of EDUCATION_CANDIDATES) {
    if (resolveNearest(series, candidate.code, start) && resolveNearest(series, candidate.code, end)) return candidate.code;
  }
  return null;
}

export interface StartYearCheck {
  year: number;
  valid: boolean;
  missing: string[];
  educationCode: string | null;
}

/**
 * A start year is playable when every required indicator has a real observation within the
 * nearest-year window at the start, and every score category has at least one indicator with
 * a real observation at the end year (so the final comparison with history is possible).
 */
export function checkStartYear(series: SeriesMap, year: number, lastDataYear: number): StartYearCheck {
  const end = year + GAME_YEARS;
  const missing: string[] = [];
  if (end > lastDataYear) missing.push(`end year ${end} is after the latest data`);
  const educationCode = pickEducationCode(series, year, end);
  for (const id of REQUIRED_AT_START) {
    if (!resolveNearest(series, INDICATORS[id].code, year)) missing.push(INDICATORS[id].shortName);
  }
  for (const category of SCORE_CATEGORIES) {
    const ids = INDICATOR_IDS.filter((id) => INDICATORS[id].scored && INDICATORS[id].category === category);
    const ok = ids.some((id) => {
      const code = id === "education" ? educationCode : INDICATORS[id].code;
      return code && resolveNearest(series, code, year) && resolveNearest(series, code, end);
    });
    if (!ok) missing.push(`${category} data at ${end}`);
  }
  return { year, valid: missing.length === 0, missing, educationCode };
}

export function checkStartYears(series: SeriesMap, lastDataYear: number): StartYearCheck[] {
  const checks: StartYearCheck[] = [];
  for (let year = START_YEAR_RANGE.first; year <= START_YEAR_RANGE.last; year++) checks.push(checkStartYear(series, year, lastDataYear));
  return checks;
}

export function lastYearWithData(series: SeriesMap): number {
  return Math.max(...Object.values(series).flatMap((points) => points.map((p) => p.year)), 0);
}

export interface Baselines {
  /** Average GDP growth over the 8 years before the start (past data only). */
  growthAvg: number | null;
  popGrowthSlope: number | null;
  urbanSlope: number | null;
  lifeSlope: number | null;
  infantDeclinePct: number | null;
  electricityGapClosure: number | null;
  fdiAvg: number | null;
  tradeAvg: number | null;
  renewableSlope: number | null;
  femaleLaborSlope: number | null;
  educationSlope: number | null;
  lookbackYears: number;
}

const LOOKBACK = 8;

/** Trends computed only from observations before the start year. */
export function computeBaselines(series: SeriesMap, start: number, educationCode: string): Baselines {
  const past = (id: IndicatorId) => pastPoints(series, codeFor(id, educationCode), start + 1, LOOKBACK);
  const growth = past("gdpGrowth").map((p) => p.value);
  const infant = averageAnnualChange(past("infantMortality"), "percent");
  const elec = past("electricity");
  let gapClosure: number | null = null;
  if (elec.length >= 2) {
    const a = elec[0], b = elec[elec.length - 1];
    const years = b.year - a.year;
    if (years > 0 && a.value < 100) gapClosure = (b.value - a.value) / (100 - a.value) / years;
  }
  return {
    growthAvg: mean(growth),
    popGrowthSlope: averageAnnualChange(past("popGrowth"), "difference"),
    urbanSlope: averageAnnualChange(past("urban"), "difference"),
    lifeSlope: averageAnnualChange(past("lifeExpectancy"), "difference"),
    infantDeclinePct: infant === null ? null : -infant,
    electricityGapClosure: gapClosure,
    fdiAvg: mean(past("fdi").map((p) => p.value)),
    tradeAvg: mean(past("trade").map((p) => p.value)),
    renewableSlope: averageAnnualChange(past("renewable"), "difference"),
    femaleLaborSlope: averageAnnualChange(past("femaleLabor"), "difference"),
    educationSlope: averageAnnualChange(past("education"), "difference"),
    lookbackYears: LOOKBACK,
  };
}

export type WorldTurn = {
  year: number;
  values: Partial<Record<WorldKey | "regionGrowth", ResolvedValue>>;
};

/** World and regional conditions for a year, never looking past that year. */
export function worldForYear(world: SeriesMap, region: SeriesMap, year: number): WorldTurn {
  const values: WorldTurn["values"] = {};
  for (const key of Object.keys(WORLD_INDICATORS) as WorldKey[]) {
    const r = resolveNearest(world, WORLD_INDICATORS[key].code, year, { notAfter: year });
    if (r) values[key] = r;
  }
  const rg = resolveNearest(region, WORLD_INDICATORS.growth.code, year, { notAfter: year });
  if (rg) values.regionGrowth = rg;
  return { year, values };
}

export interface StartPackage {
  country: CountryConfig;
  startYear: number;
  endYear: number;
  turnYears: number[];
  educationCode: string;
  educationName: string;
  start: Partial<Record<IndicatorId, ResolvedValue>>;
  baselines: Baselines;
  /** World conditions for the start year and each turn year. Global aggregates only. */
  world: WorldTurn[];
  worldReferenceGrowth: number | null;
}

export function buildStartPackage(country: CountryConfig, series: SeriesMap, world: SeriesMap, region: SeriesMap, startYear: number, educationCode: string): StartPackage {
  const endYear = startYear + GAME_YEARS;
  const start: StartPackage["start"] = {};
  for (const id of INDICATOR_IDS) {
    const r = resolveNearest(series, codeFor(id, educationCode), startYear);
    if (r) start[id] = r;
  }
  const turnYears = Array.from({ length: TOTAL_TURNS + 1 }, (_, i) => startYear + i * YEARS_PER_TURN);
  const refGrowth = mean(pastPoints(world, WORLD_INDICATORS.growth.code, startYear + 1, 5).map((p) => p.value));
  return {
    country,
    startYear,
    endYear,
    turnYears,
    educationCode,
    educationName: EDUCATION_CANDIDATES.find((c) => c.code === educationCode)?.name ?? educationCode,
    start,
    baselines: computeBaselines(series, startYear, educationCode),
    world: turnYears.map((year) => worldForYear(world, region, year)),
    worldReferenceGrowth: refGrowth,
  };
}

export interface RevealPackage {
  turnYears: number[];
  /** Real values for each turn year, nearest-year rule applied; null where no observation exists. */
  history: Record<IndicatorId, (ResolvedValue | null)[]>;
}

export function buildRevealPackage(series: SeriesMap, turnYears: number[], educationCode: string): RevealPackage {
  const history = {} as RevealPackage["history"];
  for (const id of INDICATOR_IDS) history[id] = turnYears.map((year) => resolveNearest(series, codeFor(id, educationCode), year));
  return { turnYears, history };
}
