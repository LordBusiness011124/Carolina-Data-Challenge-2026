import { describe, expect, it } from "vitest";
import { parsePage, toSeries, WorldBankError } from "@/lib/worldbank/normalize";
import { resolveNearest, averageAnnualChange } from "@/lib/worldbank/observations";
import { buildStartPackage, buildRevealPackage, checkStartYear } from "@/lib/worldbank/package";
import { fixtureSeries, fixtureWorld, TEST_COUNTRY } from "./fixtures/series";

// Shape copied from a real response to
// https://api.worldbank.org/v2/country/VNM/indicator/SP.POP.TOTL;SP.DYN.LE00.IN?format=json&date=1990:1992&source=2
const response = [
  { page: 1, pages: 1, per_page: 100, total: 3, sourceid: "2", lastupdated: "2026-07-13" },
  [
    { indicator: { id: "SP.POP.TOTL", value: "Population, total" }, country: { id: "VN", value: "Viet Nam" }, countryiso3code: "VNM", date: "1991", value: 66891775, unit: "", obs_status: "", decimal: 0 },
    { indicator: { id: "SP.POP.TOTL", value: "Population, total" }, country: { id: "VN", value: "Viet Nam" }, countryiso3code: "VNM", date: "1990", value: 65504552, unit: "", obs_status: "", decimal: 0 },
    { indicator: { id: "EG.ELC.ACCS.ZS", value: "Access to electricity (% of population)" }, country: { id: "VN", value: "Viet Nam" }, countryiso3code: "VNM", date: "1990", value: null, unit: "", obs_status: "", decimal: 1 },
  ],
];

describe("World Bank normalization", () => {
  it("normalizes rows into observations and drops null values instead of zeroing them", () => {
    const page = parsePage(response);
    expect(page.meta.total).toBe(3);
    expect(page.observations).toHaveLength(2);
    expect(page.nullRows).toBe(1);
    expect(page.observations[0]).toMatchObject({ countryCode: "VNM", indicator: "SP.POP.TOTL", year: 1991, value: 66891775, source: "World Bank" });
    const series = toSeries(page.observations);
    expect(series["SP.POP.TOTL"].map((p) => p.year)).toEqual([1990, 1991]);
    expect(series["EG.ELC.ACCS.ZS"]).toBeUndefined();
  });

  it("raises a clear error for API error payloads", () => {
    const error = [{ message: [{ id: "175", key: "Invalid format", value: "The indicator was not found." }] }];
    expect(() => parsePage(error)).toThrow(WorldBankError);
  });

  it("handles an empty result page", () => {
    expect(parsePage([{ page: 1, pages: 0, per_page: 50, total: 0 }, null]).observations).toEqual([]);
  });
});

describe("nearest-observation rule", () => {
  const series = { X: [{ year: 1993, value: 10, obsStatus: null }, { year: 1997, value: 20, obsStatus: null }, { year: 2000, value: 30, obsStatus: null }] };
  it("uses an exact year when present", () => {
    expect(resolveNearest(series, "X", 1997)).toMatchObject({ value: 20, observationYear: 1997, isEstimated: false });
  });
  it("uses the closest year within the window and flags it", () => {
    expect(resolveNearest(series, "X", 1998)).toMatchObject({ value: 20, observationYear: 1997, isEstimated: true, requestedYear: 1998 });
  });
  it("prefers the earlier year on a tie", () => {
    expect(resolveNearest(series, "X", 1995)).toMatchObject({ observationYear: 1993 });
  });
  it("returns null outside the window rather than inventing a value", () => {
    expect(resolveNearest(series, "X", 2005)).toBeNull();
    expect(resolveNearest(series, "missing", 2000)).toBeNull();
  });
  it("never looks past notAfter", () => {
    expect(resolveNearest(series, "X", 1999, { notAfter: 1999 })).toMatchObject({ observationYear: 1997 });
  });
  it("computes past trends only from available points", () => {
    expect(averageAnnualChange([{ year: 1990, value: 10 }, { year: 1995, value: 20 }], "difference")).toBe(2);
    expect(averageAnnualChange([{ year: 1990, value: 10 }], "difference")).toBeNull();
  });
});

describe("start packages", () => {
  it("disables a start year when a required indicator is missing", () => {
    const series = fixtureSeries(1985, 2022, { "EG.ELC.ACCS.ZS": [1987, 1988, 1989, 1990, 1991, 1992] });
    expect(checkStartYear(series, 1990, 2022).valid).toBe(false);
    expect(checkStartYear(series, 1990, 2022).missing).toContain("Electricity access");
    expect(checkStartYear(series, 1995, 2022).valid).toBe(true);
    expect(checkStartYear(series, 2004, 2022).valid).toBe(false);
  });

  it("contains no country values from after the start window", () => {
    const series = fixtureSeries();
    const pkg = buildStartPackage(TEST_COUNTRY, series, fixtureWorld(), fixtureWorld(), 1995, "SE.PRM.ENRR");
    const allowed = new Set(Object.values(series).flatMap((points) => points.filter((p) => p.year <= 1997).map((p) => p.value)));
    for (const value of Object.values(pkg.start)) expect(allowed.has(value!.value)).toBe(true);
    // Only values that never occur on or before 1997 identify future data (flat fixture series repeat values).
    const future = Object.values(series).flatMap((points) => points.filter((p) => p.year > 1997).map((p) => p.value)).filter((v) => !allowed.has(v));
    expect(future.length).toBeGreaterThan(100);
    const json = JSON.stringify({ start: pkg.start, baselines: pkg.baselines });
    for (const value of future) expect(json.includes(String(value))).toBe(false);
  });

  it("builds the reveal from real observations for every turn year", () => {
    const reveal = buildRevealPackage(fixtureSeries(), [1995, 1997], "SE.PRM.ENRR");
    expect(reveal.history.lifeExpectancy[1]).toMatchObject({ requestedYear: 1997, observationYear: 1997 });
  });
});
