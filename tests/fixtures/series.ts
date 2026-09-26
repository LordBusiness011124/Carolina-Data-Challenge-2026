// TEST FIXTURE ONLY. Synthetic series shaped like normalized World Bank data.
// Never imported by application code; production data always comes from the API.
import { COUNTRY_CODES, INDICATORS, WORLD_INDICATORS } from "@/lib/worldbank/indicators";
import type { SeriesMap } from "@/lib/worldbank/normalize";
import type { CountryConfig } from "@/lib/worldbank/package";

export const TEST_COUNTRY: CountryConfig = { code: "TST", name: "Testland", regionCode: "EAS", regionName: "East Asia & Pacific", incomeLevel: "Lower middle income", capital: "Test City", latitude: 10, longitude: 100 };

const base: Record<string, [number, number]> = {
  [INDICATORS.population.code]: [60e6, 1.015], [INDICATORS.popGrowth.code]: [2, 0.98], [INDICATORS.gdpPerCapita.code]: [800, 1.06],
  [INDICATORS.gdpGrowth.code]: [6, 1], [INDICATORS.urban.code]: [20, 1.02], [INDICATORS.lifeExpectancy.code]: [65, 1.004],
  [INDICATORS.infantMortality.code]: [40, 0.96], [INDICATORS.electricity.code]: [60, 1.02], [INDICATORS.internet.code]: [0.1, 1.4],
  [INDICATORS.fdi.code]: [3, 1], [INDICATORS.trade.code]: [60, 1.01], [INDICATORS.co2.code]: [0.5, 1.05], [INDICATORS.renewable.code]: [60, 0.98],
  [INDICATORS.unemployment.code]: [4, 1], [INDICATORS.femaleLabor.code]: [60, 1], [INDICATORS.agriculture.code]: [30, 0.97], [INDICATORS.industry.code]: [25, 1.01],
  "SE.PRM.ENRR": [95, 1.005], [INDICATORS.birthRate.code]: [28, 0.98],
};

export function fixtureSeries(firstYear = 1985, lastYear = 2022, drop: Record<string, number[]> = {}): SeriesMap {
  const series: SeriesMap = {};
  for (const code of COUNTRY_CODES) {
    if (!base[code]) continue;
    const [v0, r] = base[code];
    series[code] = [];
    for (let y = firstYear; y <= lastYear; y++) {
      if (drop[code]?.includes(y)) continue;
      series[code].push({ year: y, value: v0 * Math.pow(r, y - firstYear), obsStatus: null });
    }
  }
  return series;
}

export function fixtureWorld(): SeriesMap {
  const s: SeriesMap = {};
  const growth: Record<number, number> = { 1998: 2.5, 2000: 4.4, 2001: 1.9, 2002: 2.2, 2008: 2.1, 2009: -1.3 };
  for (const w of Object.values(WORLD_INDICATORS)) {
    s[w.code] = [];
    for (let y = 1985; y <= 2022; y++) {
      const value = w.code === WORLD_INDICATORS.growth.code ? growth[y] ?? 3 : w.code === WORLD_INDICATORS.internet.code ? Math.min(60, 0.05 * Math.pow(1.35, y - 1990)) : 20 + (y - 1985) * 0.3;
      s[w.code].push({ year: y, value, obsStatus: null });
    }
  }
  return s;
}
