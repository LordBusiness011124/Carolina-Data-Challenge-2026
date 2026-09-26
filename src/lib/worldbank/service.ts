import "server-only";
import { getCountries, getIndicators } from "./client";
import { COUNTRY_CODES, INDICATORS, WORLD_INDICATORS } from "./indicators";
import { toSeries, type SeriesMap } from "./normalize";
import { resolveNearest } from "./observations";
import { buildRevealPackage, buildStartPackage, checkStartYears, lastYearWithData, NO_EDUCATION_CODE, TOTAL_TURNS, YEARS_PER_TURN, type CountryConfig } from "./package";
import { RIVAL_INDICATORS, type RivalsPackage } from "./rivals";

export const HISTORY_RANGE = { start: 1980, end: new Date().getFullYear() - 1 };

/** Every country in the World Bank country API (aggregates excluded). */
export async function listCountries(): Promise<CountryConfig[]> {
  return getCountries();
}

export async function findCountry(code: string): Promise<CountryConfig> {
  const country = (await getCountries()).find((c) => c.code === code.toUpperCase());
  if (!country) throw new Error("Unknown country code");
  return country;
}

/** Full country history. Server-only: the client never receives future years during play. */
export async function getCountryHistory(code: string): Promise<SeriesMap> {
  return toSeries(await getIndicators(code, COUNTRY_CODES, HISTORY_RANGE.start, HISTORY_RANGE.end));
}

export async function getWorldContext(aggregate = "WLD"): Promise<SeriesMap> {
  const codes = aggregate === "WLD" ? Object.values(WORLD_INDICATORS).map((w) => w.code) : [WORLD_INDICATORS.growth.code];
  return toSeries(await getIndicators(aggregate, codes, HISTORY_RANGE.start, HISTORY_RANGE.end));
}

export async function getSetupInfo(code: string) {
  const country = await findCountry(code);
  const series = await getCountryHistory(country.code);
  const checks = checkStartYears(series, lastYearWithData(series));
  return { country, checks, defaultStart: checks.find((c) => c.valid)?.year ?? null };
}

export async function getStartPackage(code: string, startYear: number) {
  const country = await findCountry(code);
  const [series, world, region] = await Promise.all([getCountryHistory(country.code), getWorldContext("WLD"), getWorldContext(country.regionCode)]);
  const check = checkStartYears(series, lastYearWithData(series)).find((c) => c.year === startYear);
  if (!check?.valid) throw new Error(`Not enough World Bank data to start ${country.name} in ${startYear}`);
  return buildStartPackage(country, series, world, region, startYear, check.educationCode ?? NO_EDUCATION_CODE);
}

export async function getRevealPackage(code: string, startYear: number, educationCode: string) {
  const country = await findCountry(code);
  const series = await getCountryHistory(country.code);
  const turnYears = Array.from({ length: TOTAL_TURNS + 1 }, (_, i) => startYear + i * YEARS_PER_TURN);
  return buildRevealPackage(series, turnYears, educationCode);
}

/**
 * Real values for the other countries in the player's region, for the regional board.
 * The player's own country is excluded, so its future is never sent during play.
 * One batched request covers every rival and indicator.
 */
export async function getRivals(code: string, startYear: number): Promise<RivalsPackage> {
  const country = await findCountry(code);
  const rivals = (await getCountries()).filter((c) => c.regionCode === country.regionCode && c.code !== country.code);
  const turnYears = Array.from({ length: TOTAL_TURNS + 1 }, (_, i) => startYear + i * YEARS_PER_TURN);
  const codes = RIVAL_INDICATORS.map((id) => INDICATORS[id].code);
  const observations = rivals.length ? await getIndicators(rivals.map((r) => r.code).join(";"), codes, startYear - 2, startYear + 22) : [];
  const byCountry = new Map<string, typeof observations>();
  for (const o of observations) byCountry.set(o.countryCode, [...(byCountry.get(o.countryCode) ?? []), o]);
  return {
    regionCode: country.regionCode,
    regionName: country.regionName,
    turnYears,
    rivals: rivals.map((r) => {
      const series = toSeries(byCountry.get(r.code) ?? []);
      return {
        code: r.code,
        name: r.name,
        values: turnYears.map((year) => Object.fromEntries(RIVAL_INDICATORS.map((id) => [id, resolveNearest(series, INDICATORS[id].code, year)?.value ?? null]))),
      };
    }),
  };
}

/** Snapshot of real values for one year (used by the data page). */
export async function getCountrySnapshot(code: string, year: number) {
  const series = await getCountryHistory(code);
  return Object.fromEntries(Object.entries(series).map(([k, points]) => [k, points.find((p) => p.year === year) ?? null]));
}
