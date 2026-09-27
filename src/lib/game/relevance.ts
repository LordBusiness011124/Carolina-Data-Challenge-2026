// Which policies fit this country right now. Each national problem has a pool of candidate
// responses; the four with the highest relevance for the country's own (simulated) data are offered,
// each with a plain-language reason. Income level and region come from the World Bank country API.
import type { GameState } from "./types";

export interface Relevance {
  score: number;
  reason: string;
}

const pct = (v: number | undefined, d = 0) => (v === undefined ? "?" : `${v.toFixed(d)}%`);

/** Disguised harmful options must still be plausible for the country. */
export function temptationFits(policyId: string, s: GameState): boolean {
  const m = s.metrics;
  switch (policyId) {
    case "sell_resources":
      return (m.resourceRents ?? 0) >= 3 || (m.agriculture ?? 0) >= 15;
    case "scrap_rules":
      return (m.industry ?? 25) >= 15;
    default:
      return true;
  }
}

export function relevance(policyId: string, s: GameState): Relevance {
  const m = s.metrics;
  const income = s.setup.country.incomeLevel;
  const region = s.setup.country.regionCode;
  const rich = income === "High income";
  const poor = income === "Low income";
  const worldNet = s.setup.world[s.turn - 1]?.values.internet?.value;
  const gap = m.electricity !== undefined ? 100 - m.electricity : 0;
  switch (policyId) {
    case "grid_expansion":
      return { score: gap / 30 + 0.2, reason: gap > 1 ? `${pct(gap)} of people still lack electricity` : "Keeps a growing economy supplied with power" };
    case "coal_power":
      return rich ? { score: -1, reason: "Not offered to high-income economies" } : { score: gap / 40 + ((m.renewable ?? 50) < 30 ? 0.3 : 0), reason: `Fast, cheap power for the ${pct(gap)} without electricity` };
    case "solar_program":
      return { score: 0.4 + gap / 60 + ((m.renewable ?? 100) < 25 ? 0.4 : 0) + (region === "SSF" || region === "SAS" ? 0.2 : 0), reason: `Renewables are ${pct(m.renewable)} of energy use${gap > 5 ? " and mini-grids reach remote villages" : ""}` };
    case "industrial_zones":
      return { score: rich ? 0.1 : 0.5 + Math.max(0, (32 - (m.industry ?? 32)) / 20), reason: `Industry is ${pct(m.industry)} of GDP` };
    case "export_zones":
      return { score: 0.3 + Math.max(0, (70 - (m.trade ?? 70)) / 60), reason: `Trade is ${pct(m.trade)} of GDP` };
    case "fdi_incentives":
      return { score: 0.3 + Math.max(0, (4 - (m.fdi ?? 4)) / 4), reason: `Foreign investment is ${pct(m.fdi, 1)} of GDP` };
    case "primary_schools":
      return { score: m.education === undefined ? 0.2 : Math.abs(100 - m.education) / 20 + (poor ? 0.3 : 0), reason: m.education === undefined ? "Schooling data is limited here" : `Enrollment is ${pct(m.education)}` };
    case "vocational":
      return { score: 0.4 + Math.max(0, ((m.unemployment ?? 4) - 4) / 6), reason: `Unemployment is ${pct(m.unemployment, 1)}` };
    case "girls_education":
      return { score: 0.3 + Math.max(0, (60 - (m.femaleLabor ?? 60)) / 25) + (region === "MEA" || region === "SAS" ? 0.3 : 0), reason: `${pct(m.femaleLabor)} of women are in the labor force` };
    case "health_clinics":
      return { score: 0.3 + (m.infantMortality ?? 0) / 40, reason: `Infant mortality is ${m.infantMortality?.toFixed(0) ?? "?"} per 1,000 births` };
    case "vaccination":
      return rich ? { score: 0.05, reason: "Childhood immunization is already widespread" } : { score: 0.2 + (m.infantMortality ?? 0) / 30, reason: `${m.infantMortality?.toFixed(0) ?? "?"} of every 1,000 babies die in their first year` };
    case "water_sanitation":
      return { score: rich ? 0.05 : 0.4 + (poor ? 0.5 : 0) + (m.infantMortality ?? 0) / 80, reason: poor ? "Many households lack safe water" : "Fast-growing towns need pipes and sewers" };
    case "tax_reform":
      return { score: 0.3 + Math.max(0, (45 - s.treasury) / 30), reason: `The treasury stands at ${Math.round(s.treasury)}` };
    case "austerity":
      return { score: s.treasury < 25 ? 0.8 : 0.1, reason: "Rebuilds reserves fast, at a political cost" };
    case "borrow_abroad":
      return { score: s.treasury < 35 ? 0.6 + (rich ? 0.2 : 0) : 0.2, reason: rich ? "Markets lend cheaply to rich economies" : "Cash now, repayments later" };
    case "agri_modernize":
      return { score: (m.agriculture ?? 0) / 20, reason: `Farming is ${pct(m.agriculture)} of GDP` };
    case "digital_network":
      return { score: 0.3 + (worldNet !== undefined && m.internet !== undefined ? Math.max(0, (worldNet - m.internet) / Math.max(5, worldNet)) : 0.3), reason: `${pct(m.internet, 1)} of people are online${worldNet !== undefined ? ` (world: ${pct(worldNet)})` : ""}` };
    case "social_programs":
      return { score: 0.4 + (region === "LCN" ? 0.4 : 0) + Math.max(0, (50 - s.satisfaction) / 30), reason: region === "LCN" ? "Conditional cash transfers are a proven regional model" : `Public satisfaction is ${Math.round(s.satisfaction)}` };
    case "carbon_standards":
      return { score: (m.co2 ?? 0) / 4 + (rich ? 0.4 : 0), reason: `Emissions are ${m.co2?.toFixed(1) ?? "?"} tonnes per person` };
    case "urban_housing":
      return { score: 0.3 + Math.max(0, ((m.urban ?? 50) - 25) / 60) + (region === "LCN" || region === "SSF" ? 0.2 : 0), reason: `${pct(m.urban)} of people live in cities` };
    // High-stakes reforms
    case "imf_program":
      return rich ? { score: 0.05, reason: "Rich economies rarely need IMF programs" } : { score: 0.3 + Math.max(0, (40 - s.treasury) / 25) + (poor || income === "Lower middle income" ? 0.2 : 0), reason: `The treasury is down to ${Math.round(s.treasury)} and lenders are wary` };
    case "fuel_subsidy_cut":
      return { score: 0.3 + (s.treasury < 45 ? 0.3 : 0) + ((m.resourceRents ?? 0) > 10 ? 0.3 : 0) + ((m.co2 ?? 0) > 1 ? 0.2 : 0), reason: (m.resourceRents ?? 0) > 10 ? `Resources earn ${pct(m.resourceRents)} of GDP and cheap fuel is a costly habit` : "Fuel subsidies eat a large share of the budget" };
    case "mega_dam":
      return rich ? { score: 0.05, reason: "Most good dam sites are already used" } : { score: gap / 35 + ((m.renewable ?? 100) < 60 ? 0.2 : 0) + (["SSF", "SAS", "EAS", "LCN"].includes(region) ? 0.2 : 0), reason: `${pct(gap)} lack electricity; a big dam could power millions` };
    case "privatize_power":
      return rich ? { score: 0.1, reason: "Power is already reliable" } : { score: 0.4 + gap / 60, reason: gap > 1 ? `The state utility has left ${pct(gap)} without power` : "The state utility runs at a loss" };
    case "nationalize_resources":
      return (m.resourceRents ?? 0) < 5 ? { score: -1, reason: "Few mines or oil fields to nationalize" } : { score: (m.resourceRents ?? 0) / 12, reason: `Mines and oil earn ${pct(m.resourceRents)} of GDP, much of it for foreign owners` };
    case "sez_foreign_loans":
      return rich ? { score: 0.1, reason: "Industry is already established" } : { score: 0.5 + Math.max(0, (3 - (m.fdi ?? 3)) / 4) + ((m.trade ?? 100) < 60 ? 0.2 : 0), reason: `Foreign investment is ${pct(m.fdi, 1)} of GDP and trade ${pct(m.trade)}` };
    case "minimum_wage":
      return { score: (poor ? 0.3 : 0.55) + ((m.unemployment ?? 10) < 5 ? 0.2 : 0), reason: `Unemployment is ${pct(m.unemployment, 1)}, but many workers earn too little to escape poverty` };
    case "free_primary":
      return m.education === undefined ? { score: 0.2, reason: "Schooling data is limited here" } : m.education < 100 ? { score: (100 - m.education) / 15 + (poor ? 0.5 : 0), reason: `Only ${pct(m.education)} enrollment; fees keep poor children out` } : { score: 0.05, reason: "Enrollment is already universal" };
    case "land_reform":
      return { score: (m.agriculture ?? 0) / 25 + (["LCN", "SSF", "SAS"].includes(region) ? 0.3 : 0), reason: `Farming is ${pct(m.agriculture)} of GDP and many rural families have no land` };
    case "food_export_ban":
      return { score: (m.agriculture ?? 0) > 15 && (m.infantMortality ?? 0) > 30 ? 0.6 : 0.15, reason: `Farming is ${pct(m.agriculture)} of GDP and many families struggle to afford food` };
    case "nuclear_plant":
      return poor ? { score: -1, reason: "Too costly for a low-income economy" } : { score: (rich || income === "Upper middle income" ? 0.5 : 0.1) + (m.co2 ?? 0) / 6, reason: `Emissions are ${m.co2?.toFixed(1) ?? "?"} tonnes per person and demand for power keeps rising` };
    case "microfinance":
      return { score: 0.3 + (["SAS", "SSF"].includes(region) ? 0.4 : 0) + Math.max(0, (50 - (m.femaleLabor ?? 50)) / 30), reason: `${pct(m.femaleLabor)} of women are in the labor force` };
    default:
      return { score: 0, reason: "" };
  }
}
