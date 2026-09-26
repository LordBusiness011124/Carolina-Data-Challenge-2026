// Central registry of every World Bank indicator the game uses.
// Nothing else in the codebase should hard-code an indicator code.

export type Category = "economy" | "health" | "education" | "infrastructure" | "sustainability" | "structure";

export type IndicatorId =
  | "population"
  | "popGrowth"
  | "gdpPerCapita"
  | "gdpGrowth"
  | "urban"
  | "lifeExpectancy"
  | "infantMortality"
  | "electricity"
  | "internet"
  | "fdi"
  | "trade"
  | "co2"
  | "renewable"
  | "unemployment"
  | "femaleLabor"
  | "education"
  | "agriculture"
  | "birthRate"
  | "industry";

export interface IndicatorDef {
  id: IndicatorId;
  /** World Bank code. For "education" this is the first candidate; see EDUCATION_CANDIDATES. */
  code: string;
  name: string;
  shortName: string;
  category: Category;
  unit: string;
  higherIsBetter: boolean | null;
  /** How the score compares start and end values. */
  normalization: "logRatio" | "difference" | "gapClosed" | "towardTarget";
  /** Change that moves an indicator score from 50 to about 88 (tanh(1)). */
  scoreScale: number;
  displayMin: number;
  displayMax: number;
  decimals: number;
  /** Used in the category score. */
  scored: boolean;
  /** Shown on the main dashboard. */
  headline: boolean;
  source: "World Development Indicators";
}

const WDI = "World Development Indicators" as const;

export const INDICATORS: Record<IndicatorId, IndicatorDef> = {
  population: { id: "population", code: "SP.POP.TOTL", name: "Population, total", shortName: "Population", category: "structure", unit: "people", higherIsBetter: null, normalization: "logRatio", scoreScale: 1, displayMin: 0, displayMax: 2e9, decimals: 0, scored: false, headline: true, source: WDI },
  popGrowth: { id: "popGrowth", code: "SP.POP.GROW", name: "Population growth (annual %)", shortName: "Population growth", category: "structure", unit: "%", higherIsBetter: null, normalization: "difference", scoreScale: 1, displayMin: -3, displayMax: 6, decimals: 2, scored: false, headline: false, source: WDI },
  gdpPerCapita: { id: "gdpPerCapita", code: "NY.GDP.PCAP.KD", name: "GDP per capita (constant 2015 US$)", shortName: "GDP per capita", category: "economy", unit: "US$ (2015)", higherIsBetter: true, normalization: "logRatio", scoreScale: 0.6, displayMin: 0, displayMax: 120000, decimals: 0, scored: true, headline: true, source: WDI },
  gdpGrowth: { id: "gdpGrowth", code: "NY.GDP.MKTP.KD.ZG", name: "GDP growth (annual %)", shortName: "GDP growth", category: "economy", unit: "%", higherIsBetter: true, normalization: "difference", scoreScale: 3, displayMin: -15, displayMax: 20, decimals: 1, scored: false, headline: true, source: WDI },
  urban: { id: "urban", code: "SP.URB.TOTL.IN.ZS", name: "Urban population (% of total population)", shortName: "Urban population", category: "structure", unit: "%", higherIsBetter: null, normalization: "difference", scoreScale: 10, displayMin: 0, displayMax: 100, decimals: 1, scored: false, headline: true, source: WDI },
  lifeExpectancy: { id: "lifeExpectancy", code: "SP.DYN.LE00.IN", name: "Life expectancy at birth, total (years)", shortName: "Life expectancy", category: "health", unit: "years", higherIsBetter: true, normalization: "difference", scoreScale: 6, displayMin: 30, displayMax: 90, decimals: 1, scored: true, headline: true, source: WDI },
  infantMortality: { id: "infantMortality", code: "SP.DYN.IMRT.IN", name: "Mortality rate, infant (per 1,000 live births)", shortName: "Infant mortality", category: "health", unit: "per 1,000", higherIsBetter: false, normalization: "logRatio", scoreScale: 0.7, displayMin: 0, displayMax: 200, decimals: 1, scored: true, headline: true, source: WDI },
  electricity: { id: "electricity", code: "EG.ELC.ACCS.ZS", name: "Access to electricity (% of population)", shortName: "Electricity access", category: "infrastructure", unit: "%", higherIsBetter: true, normalization: "gapClosed", scoreScale: 0.6, displayMin: 0, displayMax: 100, decimals: 1, scored: true, headline: true, source: WDI },
  internet: { id: "internet", code: "IT.NET.USER.ZS", name: "Individuals using the Internet (% of population)", shortName: "Internet users", category: "infrastructure", unit: "%", higherIsBetter: true, normalization: "difference", scoreScale: 30, displayMin: 0, displayMax: 100, decimals: 1, scored: true, headline: false, source: WDI },
  fdi: { id: "fdi", code: "BX.KLT.DINV.WD.GD.ZS", name: "Foreign direct investment, net inflows (% of GDP)", shortName: "Foreign investment", category: "economy", unit: "% of GDP", higherIsBetter: true, normalization: "difference", scoreScale: 3, displayMin: -5, displayMax: 20, decimals: 1, scored: true, headline: false, source: WDI },
  trade: { id: "trade", code: "NE.TRD.GNFS.ZS", name: "Trade (% of GDP)", shortName: "Trade", category: "structure", unit: "% of GDP", higherIsBetter: null, normalization: "difference", scoreScale: 20, displayMin: 0, displayMax: 250, decimals: 1, scored: false, headline: false, source: WDI },
  co2: { id: "co2", code: "EN.GHG.CO2.PC.CE.AR5", name: "CO2 emissions per capita, excluding LULUCF (t CO2e)", shortName: "CO2 per person", category: "sustainability", unit: "t CO2e", higherIsBetter: false, normalization: "logRatio", scoreScale: 0.5, displayMin: 0, displayMax: 40, decimals: 2, scored: true, headline: true, source: WDI },
  renewable: { id: "renewable", code: "EG.FEC.RNEW.ZS", name: "Renewable energy consumption (% of total final energy consumption)", shortName: "Renewable energy", category: "sustainability", unit: "%", higherIsBetter: true, normalization: "difference", scoreScale: 10, displayMin: 0, displayMax: 100, decimals: 1, scored: true, headline: false, source: WDI },
  unemployment: { id: "unemployment", code: "SL.UEM.TOTL.ZS", name: "Unemployment, total (% of total labor force, modeled ILO estimate)", shortName: "Unemployment", category: "economy", unit: "%", higherIsBetter: false, normalization: "difference", scoreScale: 3, displayMin: 0, displayMax: 40, decimals: 1, scored: true, headline: true, source: WDI },
  femaleLabor: { id: "femaleLabor", code: "SL.TLF.CACT.FE.ZS", name: "Labor force participation rate, female (% of female population ages 15+, modeled ILO estimate)", shortName: "Female labor participation", category: "education", unit: "%", higherIsBetter: true, normalization: "difference", scoreScale: 6, displayMin: 0, displayMax: 100, decimals: 1, scored: true, headline: false, source: WDI },
  education: { id: "education", code: "SE.PRM.ENRR", name: "School enrollment, primary (% gross)", shortName: "School enrollment", category: "education", unit: "%", higherIsBetter: true, normalization: "towardTarget", scoreScale: 12, displayMin: 0, displayMax: 150, decimals: 1, scored: true, headline: true, source: WDI },
  agriculture: { id: "agriculture", code: "NV.AGR.TOTL.ZS", name: "Agriculture, forestry, and fishing, value added (% of GDP)", shortName: "Agriculture share", category: "structure", unit: "% of GDP", higherIsBetter: null, normalization: "difference", scoreScale: 10, displayMin: 0, displayMax: 80, decimals: 1, scored: false, headline: false, source: WDI },
  birthRate: { id: "birthRate", code: "SP.DYN.CBRT.IN", name: "Birth rate, crude (per 1,000 people)", shortName: "Birth rate", category: "structure", unit: "per 1,000", higherIsBetter: null, normalization: "difference", scoreScale: 5, displayMin: 0, displayMax: 60, decimals: 1, scored: false, headline: false, source: WDI },
  industry: { id: "industry", code: "NV.IND.TOTL.ZS", name: "Industry (including construction), value added (% of GDP)", shortName: "Industry share", category: "structure", unit: "% of GDP", higherIsBetter: null, normalization: "difference", scoreScale: 10, displayMin: 0, displayMax: 80, decimals: 1, scored: false, headline: false, source: WDI },
};

/** Education coverage varies by country, so the first candidate with data at the start and end of a game is used. */
export const EDUCATION_CANDIDATES: { code: string; name: string; cap: number }[] = [
  { code: "SE.PRM.ENRR", name: "School enrollment, primary (% gross)", cap: 115 },
  { code: "SE.PRM.NENR", name: "School enrollment, primary (% net)", cap: 100 },
  { code: "SE.SEC.ENRR", name: "School enrollment, secondary (% gross)", cap: 115 },
  { code: "SE.TER.ENRR", name: "School enrollment, tertiary (% gross)", cap: 100 },
];

export const INDICATOR_IDS = Object.keys(INDICATORS) as IndicatorId[];

/** All distinct codes fetched for a country history, including every education candidate. */
export const COUNTRY_CODES: string[] = Array.from(
  new Set([...INDICATOR_IDS.filter((id) => id !== "education").map((id) => INDICATORS[id].code), ...EDUCATION_CANDIDATES.map((c) => c.code)]),
);

export const CATEGORY_LABELS: Record<Exclude<Category, "structure">, string> = {
  economy: "Economy",
  health: "Health",
  education: "Education",
  infrastructure: "Infrastructure",
  sustainability: "Sustainability",
};
export const SCORE_CATEGORIES = Object.keys(CATEGORY_LABELS) as Exclude<Category, "structure">[];

// Global context (aggregate "WLD") used to describe world conditions each turn.
export const WORLD_INDICATORS = {
  growth: { code: "NY.GDP.MKTP.KD.ZG", name: "World GDP growth (annual %)" },
  trade: { code: "NE.TRD.GNFS.ZS", name: "World trade (% of GDP)" },
  fdi: { code: "BX.KLT.DINV.WD.GD.ZS", name: "World FDI net inflows (% of GDP)" },
  internet: { code: "IT.NET.USER.ZS", name: "World internet users (% of population)" },
  resourceRents: { code: "NY.GDP.TOTL.RT.ZS", name: "World total natural resources rents (% of GDP)" },
} as const;
export type WorldKey = keyof typeof WORLD_INDICATORS;

/** Maximum distance, in years, between a requested year and a real observation used in its place. */
export const NEAREST_WINDOW_YEARS = 2;

export function indicatorByCode(code: string): IndicatorDef | undefined {
  return INDICATOR_IDS.map((id) => INDICATORS[id]).find((d) => d.code === code);
}
