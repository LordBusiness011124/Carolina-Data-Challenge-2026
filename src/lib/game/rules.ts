// All tunable game rules live here: constants, policies, national problems and world events.
import type { IndicatorId } from "../worldbank/indicators";
import type { Difficulty, GameState, MechanicsDelta, Modifiers, Objective } from "./types";

export const CONSTANTS = {
  startResources: { easy: { treasury: 75, politicalCapital: 70, satisfaction: 60 }, normal: { treasury: 60, politicalCapital: 60, satisfaction: 55 }, hard: { treasury: 45, politicalCapital: 50, satisfaction: 48 } } as Record<Difficulty, { treasury: number; politicalCapital: number; satisfaction: number }>,
  revenuePerTurn: { easy: 12, normal: 10, hard: 8 } as Record<Difficulty, number>,
  revenuePerGrowthPoint: 0.8,
  politicalRegen: 6,
  /** Extra political capital each turn while the player leads at least half of the region's rivals. */
  regionLeaderBonus: 4,
  regionLeaderShare: 0.5,
  advisorUses: 3,
  /** Fortune dice: total 2 scales an event to 0.7x, total 12 to 1.3x. */
  diceSeverityRange: [0.7, 1.3] as [number, number],
  politicalRegenLowSatisfaction: 1,
  lowSatisfaction: 35,
  lowTreasury: 12,
  growthPenaltyLowTreasury: -0.8,
  growthPenaltyLowSatisfaction: -0.6,
  satisfactionPerGrowthPoint: 1.2,
  satisfactionPerUnemploymentPoint: -2.5,
  satisfactionReversion: 0.08,
  debtCrisisSatisfaction: -10,
  defaultGrowthAnchor: 4,
  growthAnchorRange: [1, 7] as [number, number],
  worldGrowthPassThrough: 0.5,
  defaultElectricityGapClosure: 0.035,
  internetBaseRate: 0.22,
  fdiAdjustment: 0.35,
  tradeAdjustment: 0.25,
  co2IncomeElasticity: 1.1,
  /** Extra annual % growth in emissions per person while emissions are low (below 3 t), as economies shift to modern energy. */
  co2TransitionGrowth: 0.8,
  lifeExpectancyCeiling: 84,
  /** Overall strength of policy effects. Tuned with tests/calibration.ts so that active play beats staying the course by several points. */
  policyEffectScale: 1,
  /** Each earlier use of the same policy multiplies its new effects by this factor. */
  repeatDecay: 0.6,
  /** Seeded range of how well a policy is carried out. */
  executionRange: [0.7, 1.2] as [number, number],
  /** GDP growth points lost per point of treasury spent this turn (taxes or borrowing crowd out private activity). */
  spendingDrag: 0.025,
  /** Share of the pre-start trend that persists into the game (trends fade rather than continue forever). */
  trendPersistence: 0.6,
  /** Renewable shares above this level drift down as traditional biomass gives way to modern fuels. */
  renewableDriftLevel: 40,
  renewableDriftRate: 0.035,
};

export type Hint = "+++" | "++" | "+" | "-" | "--" | "---";

export interface PolicyDef {
  id: string;
  title: string;
  category: "Infrastructure" | "Education" | "Healthcare" | "Industry" | "Trade" | "Energy" | "Taxes" | "Agriculture" | "Debt" | "Technology" | "Social";
  description: string;
  cost: { treasury: number; politicalCapital: number };
  /** Instant changes to game mechanics. */
  mechanics: MechanicsDelta;
  /** Modifiers applied during the coming two years. */
  immediate: Modifiers;
  immediateLabels: { label: string; direction: "up" | "down" }[];
  delayed: { label: string; startsAfterTurns: number; durationTurns: number; modifiers: Modifiers; callback: string }[];
  risk: { chance: number; description: string; modifiers?: Modifiers; mechanics?: MechanicsDelta } | null;
  hints: Record<string, Hint>;
  affects: IndicatorId[];
  /** UN Sustainable Development Goals the policy mainly targets. */
  sdgs?: number[];
}

export const POLICIES: Record<string, PolicyDef> = {
  status_quo: {
    id: "status_quo", sdgs: [], title: "Stay the Course", category: "Social",
    description: "Take no major action this turn. Saves money and rebuilds political capital, but the problem is left to existing trends.",
    cost: { treasury: 0, politicalCapital: 0 }, mechanics: { politicalCapital: 6, satisfaction: -2 },
    immediate: {}, immediateLabels: [{ label: "Political capital", direction: "up" }],
    delayed: [], risk: null,
    hints: { "Political capital": "++", Treasury: "+", Satisfaction: "-" }, affects: [],
  },
  grid_expansion: {
    id: "grid_expansion", sdgs: [7, 9], title: "National Grid Expansion", category: "Infrastructure",
    description: "Build transmission lines and power plants to connect towns and factories.",
    cost: { treasury: 18, politicalCapital: 8 }, mechanics: { satisfaction: 3 },
    immediate: { electricityRate: 0.04, unemploymentPP: -0.15 }, immediateLabels: [{ label: "Construction employment", direction: "up" }, { label: "Electricity access", direction: "up" }],
    delayed: [{ label: "Industrial productivity from reliable power", startsAfterTurns: 1, durationTurns: 4, modifiers: { growthPP: 0.35, fdiTarget: 0.4, co2Intensity: 0.6 }, callback: "Factories connected by your grid expansion are running longer shifts." }],
    risk: { chance: 0.2, description: "Cost overruns on the power plants drained the budget.", mechanics: { treasury: -6 } },
    hints: { Electricity: "+++", Treasury: "--", Growth: "+", Emissions: "-" }, affects: ["electricity", "gdpGrowth", "co2"],
  },
  coal_power: {
    id: "coal_power", sdgs: [7], title: "Fast-Track Coal Plants", category: "Energy",
    description: "Cheap, quick power from coal to end blackouts now.",
    cost: { treasury: 10, politicalCapital: 4 }, mechanics: { satisfaction: 4 },
    immediate: { electricityRate: 0.03, growthPP: 0.4, co2Intensity: 3, renewableGain: -0.6 }, immediateLabels: [{ label: "Electricity access", direction: "up" }, { label: "Emissions", direction: "up" }],
    delayed: [{ label: "Coal lock-in raises emissions", startsAfterTurns: 1, durationTurns: 5, modifiers: { co2Intensity: 2, renewableGain: -0.4 }, callback: "The coal fleet you approved is now a large source of emissions." }],
    risk: { chance: 0.25, description: "Air pollution protests broke out near the new plants.", mechanics: { satisfaction: -6, politicalCapital: -4 } },
    hints: { Electricity: "++", Growth: "+", Emissions: "---", Renewables: "--", Treasury: "-" }, affects: ["electricity", "co2", "renewable"],
  },
  solar_program: {
    id: "solar_program", sdgs: [7, 13], title: "Renewable Power Program", category: "Energy",
    description: "Hydro, solar and wind with mini-grids for remote villages.",
    cost: { treasury: 22, politicalCapital: 8 }, mechanics: { satisfaction: 1 },
    immediate: { electricityRate: 0.02, renewableGain: 0.8 }, immediateLabels: [{ label: "Renewable share", direction: "up" }, { label: "Rural electricity", direction: "up" }],
    delayed: [{ label: "Clean power lowers emissions growth", startsAfterTurns: 1, durationTurns: 5, modifiers: { renewableGain: 0.6, co2Intensity: -1.5, electricityRate: 0.015 }, callback: "Your renewable program is now supplying a growing share of the grid." }],
    risk: { chance: 0.2, description: "Early projects underperformed and needed extra funding.", mechanics: { treasury: -5 } },
    hints: { Renewables: "+++", Emissions: "++", Electricity: "+", Treasury: "---" }, affects: ["renewable", "co2", "electricity"],
  },
  industrial_zones: {
    id: "industrial_zones", sdgs: [8, 9], title: "Industrial Zones and Subsidies", category: "Industry",
    description: "Subsidized land, power and credit for manufacturers.",
    cost: { treasury: 16, politicalCapital: 10 }, mechanics: { satisfaction: 2 },
    immediate: { growthPP: 0.8, unemploymentPP: -0.3, co2Intensity: 1.2, urbanRate: 0.2 }, immediateLabels: [{ label: "Growth", direction: "up" }, { label: "Factory jobs", direction: "up" }],
    delayed: [{ label: "Manufacturing base attracts investors", startsAfterTurns: 1, durationTurns: 3, modifiers: { growthPP: 0.4, fdiTarget: 0.8, co2Intensity: 0.8 }, callback: "Manufacturers from your industrial zones are drawing foreign investors." }],
    risk: { chance: 0.25, description: "Some subsidized firms failed and loans went bad.", mechanics: { treasury: -7 } },
    hints: { Growth: "++", Jobs: "++", Emissions: "--", Treasury: "--" }, affects: ["gdpGrowth", "unemployment", "fdi", "co2"],
  },
  export_zones: {
    id: "export_zones", sdgs: [8, 17], title: "Open Export Processing Zones", category: "Trade",
    description: "Lower tariffs and fast customs for exporters.",
    cost: { treasury: 8, politicalCapital: 12 }, mechanics: { satisfaction: -1 },
    immediate: { tradeTarget: 10, growthPP: 0.4 }, immediateLabels: [{ label: "Trade openness", direction: "up" }, { label: "Protected firms", direction: "down" }],
    delayed: [{ label: "Exporters scale up", startsAfterTurns: 1, durationTurns: 4, modifiers: { growthPP: 0.5, fdiTarget: 1, unemploymentPP: -0.15 }, callback: "Export zones you opened are now shipping to new markets." }],
    risk: { chance: 0.2, description: "Import competition closed some domestic firms.", mechanics: { satisfaction: -5 }, modifiers: { unemploymentPP: 0.3 } },
    hints: { Trade: "+++", Growth: "++", Investment: "+", "Global exposure": "--" }, affects: ["trade", "gdpGrowth", "fdi"],
  },
  fdi_incentives: {
    id: "fdi_incentives", sdgs: [8, 17], title: "Foreign Investment Incentives", category: "Trade",
    description: "Tax holidays and a one-stop office for foreign firms.",
    cost: { treasury: 10, politicalCapital: 8 }, mechanics: {},
    immediate: { fdiTarget: 2 }, immediateLabels: [{ label: "Investor interest", direction: "up" }, { label: "Tax revenue", direction: "down" }],
    delayed: [{ label: "Foreign plants begin operating", startsAfterTurns: 1, durationTurns: 3, modifiers: { growthPP: 0.5, unemploymentPP: -0.2, internetRate: 0.03 }, callback: "Foreign-owned plants attracted by your incentives are hiring." }],
    risk: { chance: 0.15, description: "Investors used the tax holiday and left early.", modifiers: { fdiTarget: -1 } },
    hints: { Investment: "+++", Growth: "+", Treasury: "--" }, affects: ["fdi", "gdpGrowth"],
  },
  primary_schools: {
    id: "primary_schools", sdgs: [4], title: "Universal Schooling Drive", category: "Education",
    description: "Build classrooms, hire teachers and remove school fees.",
    cost: { treasury: 16, politicalCapital: 5 }, mechanics: { satisfaction: 4 },
    immediate: { educationGain: 1.5 }, immediateLabels: [{ label: "Enrollment", direction: "up" }],
    delayed: [{ label: "Better-educated workers enter the economy", startsAfterTurns: 2, durationTurns: 4, modifiers: { growthPP: 0.4, femaleLaborGain: 0.25, infantDecline: 0.4 }, callback: "Students from your schooling drive are now entering the workforce." }],
    risk: null,
    hints: { Education: "+++", "Long-term growth": "++", Treasury: "--" }, affects: ["education", "gdpGrowth", "femaleLabor"],
  },
  vocational: {
    id: "vocational", sdgs: [4, 8], title: "Technical and Vocational Training", category: "Education",
    description: "Train workers for factory, construction and service jobs.",
    cost: { treasury: 12, politicalCapital: 4 }, mechanics: { satisfaction: 2 },
    immediate: { unemploymentPP: -0.2, educationGain: 0.4 }, immediateLabels: [{ label: "Skills", direction: "up" }, { label: "Unemployment", direction: "down" }],
    delayed: [{ label: "Skilled workforce raises productivity", startsAfterTurns: 1, durationTurns: 3, modifiers: { growthPP: 0.35, unemploymentPP: -0.2, fdiTarget: 0.4 }, callback: "Graduates of your training programs are filling skilled jobs." }],
    risk: null,
    hints: { Jobs: "++", Education: "+", Growth: "+", Treasury: "-" }, affects: ["unemployment", "education", "gdpGrowth"],
  },
  girls_education: {
    id: "girls_education", sdgs: [4, 5], title: "Girls' Education and Childcare", category: "Education",
    description: "Scholarships for girls and subsidized childcare for working mothers.",
    cost: { treasury: 12, politicalCapital: 8 }, mechanics: { satisfaction: 2 },
    immediate: { educationGain: 0.8, femaleLaborGain: 0.4 }, immediateLabels: [{ label: "Female enrollment", direction: "up" }, { label: "Women in work", direction: "up" }],
    delayed: [{ label: "More women in the labor force", startsAfterTurns: 2, durationTurns: 4, modifiers: { femaleLaborGain: 0.5, growthPP: 0.3, infantDecline: 0.6 }, callback: "Women educated under your program are joining the labor force." }],
    risk: { chance: 0.15, description: "Traditional leaders opposed the program.", mechanics: { politicalCapital: -5 } },
    hints: { Education: "++", "Women in work": "+++", Health: "+", Treasury: "--" }, affects: ["education", "femaleLabor", "infantMortality"],
  },
  health_clinics: {
    id: "health_clinics", sdgs: [3], title: "Primary Health Clinics", category: "Healthcare",
    description: "A clinic and trained nurse in every district.",
    cost: { treasury: 16, politicalCapital: 5 }, mechanics: { satisfaction: 5 },
    immediate: { infantDecline: 1.5, lifeGain: 0.08 }, immediateLabels: [{ label: "Access to care", direction: "up" }, { label: "Public satisfaction", direction: "up" }],
    delayed: [{ label: "Healthier population", startsAfterTurns: 1, durationTurns: 5, modifiers: { lifeGain: 0.12, infantDecline: 1 }, callback: "Clinics you opened are steadily lowering child deaths." }],
    risk: null,
    hints: { Health: "+++", Satisfaction: "+", Treasury: "--" }, affects: ["infantMortality", "lifeExpectancy"],
  },
  vaccination: {
    id: "vaccination", sdgs: [3], title: "Child Vaccination Campaign", category: "Healthcare",
    description: "Nationwide immunization and nutrition for young children.",
    cost: { treasury: 8, politicalCapital: 3 }, mechanics: { satisfaction: 3 },
    immediate: { infantDecline: 2.5 }, immediateLabels: [{ label: "Infant survival", direction: "up" }],
    delayed: [{ label: "Fewer childhood deaths", startsAfterTurns: 1, durationTurns: 2, modifiers: { infantDecline: 1.2, lifeGain: 0.06 }, callback: "The children vaccinated in your campaign are growing up healthier." }],
    risk: null,
    hints: { "Infant health": "+++", Treasury: "-" }, affects: ["infantMortality", "lifeExpectancy"],
  },
  water_sanitation: {
    id: "water_sanitation", sdgs: [6, 3], title: "Clean Water and Sanitation", category: "Infrastructure",
    description: "Piped water, wells and sewers for growing towns.",
    cost: { treasury: 15, politicalCapital: 5 }, mechanics: { satisfaction: 4 },
    immediate: { infantDecline: 1.5, unemploymentPP: -0.1 }, immediateLabels: [{ label: "Water access", direction: "up" }, { label: "Child health", direction: "up" }],
    delayed: [{ label: "Less waterborne disease", startsAfterTurns: 1, durationTurns: 4, modifiers: { lifeGain: 0.1, infantDecline: 1 }, callback: "Water systems you built are cutting waterborne disease." }],
    risk: null,
    hints: { Health: "++", "Urban living": "+", Treasury: "--" }, affects: ["infantMortality", "lifeExpectancy"],
  },
  tax_reform: {
    id: "tax_reform", sdgs: [17, 16], title: "Broaden the Tax Base", category: "Taxes",
    description: "Introduce a value-added tax and close loopholes.",
    cost: { treasury: 0, politicalCapital: 14 }, mechanics: { treasury: 18, satisfaction: -6 },
    immediate: { growthPP: -0.2 }, immediateLabels: [{ label: "Revenue", direction: "up" }, { label: "Popularity", direction: "down" }],
    delayed: [{ label: "Stable revenue", startsAfterTurns: 1, durationTurns: 3, modifiers: {}, callback: "Your tax reform is delivering steadier revenue." }],
    risk: { chance: 0.2, description: "Businesses shifted into the informal economy.", modifiers: { growthPP: -0.3 } },
    hints: { Treasury: "+++", Satisfaction: "--", Growth: "-" }, affects: ["gdpGrowth"],
  },
  austerity: {
    id: "austerity", sdgs: [], title: "Spending Cuts", category: "Debt",
    description: "Freeze public hiring and cut subsidies to rebuild reserves.",
    cost: { treasury: 0, politicalCapital: 10 }, mechanics: { treasury: 22, satisfaction: -9 },
    immediate: { growthPP: -0.6, unemploymentPP: 0.25 }, immediateLabels: [{ label: "Reserves", direction: "up" }, { label: "Jobs", direction: "down" }],
    delayed: [], risk: { chance: 0.25, description: "Public sector strikes disrupted services.", mechanics: { satisfaction: -5 } },
    hints: { Treasury: "+++", Satisfaction: "---", Growth: "-", Jobs: "-" }, affects: ["gdpGrowth", "unemployment"],
  },
  borrow_abroad: {
    id: "borrow_abroad", sdgs: [17], title: "Borrow on International Markets", category: "Debt",
    description: "Issue foreign bonds to fund the budget now and repay later.",
    cost: { treasury: 0, politicalCapital: 5 }, mechanics: { treasury: 25, satisfaction: 1 },
    immediate: {}, immediateLabels: [{ label: "Cash on hand", direction: "up" }],
    delayed: [{ label: "Debt repayments", startsAfterTurns: 2, durationTurns: 3, modifiers: { growthPP: -0.25 }, callback: "Repayments on the loans you took out are weighing on growth." }],
    risk: { chance: 0.2, description: "Lenders demanded a higher interest rate.", mechanics: { treasury: -8 } },
    hints: { Treasury: "+++", "Future growth": "-" }, affects: ["gdpGrowth"],
  },
  agri_modernize: {
    id: "agri_modernize", sdgs: [2, 1], title: "Modernize Agriculture", category: "Agriculture",
    description: "Irrigation, better seeds and rural roads for farmers.",
    cost: { treasury: 12, politicalCapital: 5 }, mechanics: { satisfaction: 3 },
    immediate: { growthPP: 0.3, urbanRate: -0.15, infantDecline: 0.5 }, immediateLabels: [{ label: "Farm incomes", direction: "up" }, { label: "Rural migration", direction: "down" }],
    delayed: [{ label: "Higher farm productivity", startsAfterTurns: 1, durationTurns: 3, modifiers: { growthPP: 0.3, tradeTarget: 3 }, callback: "Irrigation from your farm program is lifting harvests and exports." }],
    risk: { chance: 0.15, description: "Irrigation projects increased land clearing.", modifiers: { co2Intensity: 0.8 } },
    hints: { Growth: "+", "Rural incomes": "++", Health: "+", Treasury: "-" }, affects: ["gdpGrowth", "urban", "trade"],
  },
  digital_network: {
    id: "digital_network", sdgs: [9], title: "National Digital Network", category: "Technology",
    description: "Liberalize telecoms and lay fiber to cities and universities.",
    cost: { treasury: 14, politicalCapital: 6 }, mechanics: { satisfaction: 2 },
    immediate: { internetRate: 0.12 }, immediateLabels: [{ label: "Internet access", direction: "up" }],
    delayed: [{ label: "Digital services grow", startsAfterTurns: 1, durationTurns: 4, modifiers: { internetRate: 0.08, growthPP: 0.3, fdiTarget: 0.4 }, callback: "The digital network you built is powering new service companies." }],
    risk: null,
    hints: { Internet: "+++", Growth: "+", Treasury: "--" }, affects: ["internet", "gdpGrowth", "fdi"],
  },
  social_programs: {
    id: "social_programs", sdgs: [1, 10], title: "Cash Transfers for Poor Families", category: "Social",
    description: "Monthly payments to poor households tied to school attendance and checkups.",
    cost: { treasury: 14, politicalCapital: 2 }, mechanics: { satisfaction: 10, politicalCapital: 4 },
    immediate: { educationGain: 0.5, infantDecline: 0.8 }, immediateLabels: [{ label: "Public satisfaction", direction: "up" }, { label: "School attendance", direction: "up" }],
    delayed: [{ label: "Healthier, better-schooled children", startsAfterTurns: 2, durationTurns: 3, modifiers: { educationGain: 0.4, lifeGain: 0.05 }, callback: "Children from families in your transfer program are staying in school." }],
    risk: null,
    hints: { Satisfaction: "+++", Education: "+", Health: "+", Treasury: "--" }, affects: ["education", "infantMortality"],
  },
  carbon_standards: {
    id: "carbon_standards", sdgs: [13, 12], title: "Clean Industry Standards", category: "Energy",
    description: "Efficiency rules for factories, vehicles and buildings.",
    cost: { treasury: 6, politicalCapital: 12 }, mechanics: { satisfaction: -2 },
    immediate: { co2Intensity: -2, growthPP: -0.2 }, immediateLabels: [{ label: "Emissions", direction: "down" }, { label: "Industry costs", direction: "up" }],
    delayed: [{ label: "Efficiency gains", startsAfterTurns: 1, durationTurns: 4, modifiers: { co2Intensity: -1.2, renewableGain: 0.2 }, callback: "Efficiency standards you set are slowing emissions growth." }],
    risk: { chance: 0.2, description: "Industry lobbied hard against the rules.", mechanics: { politicalCapital: -6 } },
    hints: { Emissions: "+++", Growth: "-", "Political capital": "--" }, affects: ["co2", "renewable"],
  },
  urban_housing: {
    id: "urban_housing", sdgs: [11], title: "Affordable Urban Housing", category: "Infrastructure",
    description: "Serviced plots, public transit and upgrades for informal settlements.",
    cost: { treasury: 15, politicalCapital: 5 }, mechanics: { satisfaction: 6 },
    immediate: { unemploymentPP: -0.15, infantDecline: 0.5 }, immediateLabels: [{ label: "Urban living conditions", direction: "up" }, { label: "Construction jobs", direction: "up" }],
    delayed: [{ label: "Productive, connected cities", startsAfterTurns: 1, durationTurns: 3, modifiers: { growthPP: 0.25, electricityRate: 0.01 }, callback: "Neighborhoods built under your housing plan are now connected and productive." }],
    risk: { chance: 0.15, description: "Land disputes delayed several projects.", mechanics: { politicalCapital: -4 } },
    hints: { Satisfaction: "++", "Urban living": "++", Treasury: "--" }, affects: ["unemployment", "infantMortality", "gdpGrowth"],
  },
};

/** Always offered alongside a problem's four responses, so a player can never be locked out of a turn. */
export const FALLBACK_POLICY = "status_quo";

export interface ProblemDef {
  id: string;
  title: string;
  /** Severity 0..~1.5 from the current simulated state. Higher is more pressing. */
  score: (s: GameState) => number;
  describe: (s: GameState) => string;
  options: string[];
}

const m = (s: GameState, id: IndicatorId) => s.metrics[id];
const startOf = (s: GameState, id: IndicatorId) => s.realStart[id]?.value;
const fmt = (v: number | undefined, d = 1) => (v === undefined ? "unknown" : v.toFixed(d));
/** A problem can only be posed when the metrics it describes exist for this country. */
const has = (s: GameState, ...ids: IndicatorId[]) => ids.every((id) => s.metrics[id] !== undefined);

export const PROBLEMS: ProblemDef[] = [
  { id: "power_shortage", title: "Power Shortage", score: (s) => !has(s, "electricity") ? -1 : ((100 - (m(s, "electricity") ?? 100)) / 100) * 1.4,
    describe: (s) => `Only ${fmt(m(s, "electricity"), 0)}% of people have electricity. Factories face blackouts and villages remain dark.`,
    options: ["grid_expansion", "coal_power", "solar_program", "urban_housing"] },
  { id: "child_health", title: "Child Health Emergency", score: (s) => !has(s, "infantMortality") ? -1 : Math.min(1.4, (m(s, "infantMortality") ?? 0) / 40),
    describe: (s) => `${fmt(m(s, "infantMortality"), 0)} of every 1,000 babies die before their first birthday. Clinics are overwhelmed.`,
    options: ["vaccination", "health_clinics", "water_sanitation", "social_programs"] },
  { id: "jobs_crisis", title: "Jobs Crisis", score: (s) => !has(s, "unemployment") ? -1 : Math.max(0, ((m(s, "unemployment") ?? 0) - 3) / 7) + (s.lastGrowth < 2 ? 0.3 : 0),
    describe: (s) => `Unemployment stands at ${fmt(m(s, "unemployment"))}% and growth was ${s.lastGrowth.toFixed(1)}% last year. Young workers cannot find jobs.`,
    options: ["industrial_zones", "vocational", "agri_modernize", "export_zones"] },
  { id: "investment_drought", title: "Investors Stay Away", score: (s) => !has(s, "fdi") ? -1 : Math.max(0, (4 - (m(s, "fdi") ?? 4)) / 4),
    describe: (s) => `Foreign investment is only ${fmt(m(s, "fdi"))}% of GDP. Multinationals are choosing your neighbors.`,
    options: ["fdi_incentives", "export_zones", "digital_network", "tax_reform"] },
  { id: "skills_gap", title: "Skills Gap", score: (s) => !has(s, "education") ? -1 : Math.max(0, (105 - (m(s, "education") ?? 105)) / 40) + Math.max(0, (60 - (m(s, "femaleLabor") ?? 60)) / 60),
    describe: (s) => `School enrollment is ${fmt(m(s, "education"), 0)}% and many employers say they cannot find trained workers.`,
    options: ["primary_schools", "vocational", "girls_education", "digital_network"] },
  { id: "fiscal_squeeze", title: "Empty Treasury", score: (s) => (s.treasury < 30 ? (30 - s.treasury) / 20 : 0),
    describe: (s) => `The treasury is down to ${Math.round(s.treasury)}. Ministries are warning that payrolls may be missed.`,
    options: ["tax_reform", "austerity", "borrow_abroad", "fdi_incentives"] },
  { id: "emissions", title: "Smog Over the Cities", score: (s) => { if (!has(s, "co2", "renewable")) return -1; const a = startOf(s, "co2"), b = m(s, "co2"); return a && b ? Math.max(0, Math.log(b / a)) * 1.6 : 0; },
    describe: (s) => `Emissions per person have reached ${fmt(m(s, "co2"), 2)} tonnes and renewables are ${fmt(m(s, "renewable"), 0)}% of energy use.`,
    options: ["solar_program", "carbon_standards", "coal_power", "digital_network"] },
  { id: "urban_pressure", title: "Cities Bursting at the Seams", score: (s) => { if (!has(s, "urban")) return -1; const h = s.metricHistory; const prev = h[h.length - 2]?.metrics.urban; const now = m(s, "urban"); return prev !== undefined && now !== undefined ? Math.max(0, (now - prev) / 2) : 0.2; },
    describe: (s) => `${fmt(m(s, "urban"), 0)}% of people now live in cities. Slums are spreading faster than roads and pipes.`,
    options: ["urban_housing", "water_sanitation", "grid_expansion", "agri_modernize"] },
  { id: "unrest", title: "Public Discontent", score: (s) => (s.satisfaction < 45 ? (45 - s.satisfaction) / 15 : 0),
    describe: (s) => `Public satisfaction has fallen to ${Math.round(s.satisfaction)}. Protests are growing in the capital.`,
    options: ["social_programs", "urban_housing", "health_clinics", "borrow_abroad"] },
  { id: "digital_divide", title: "Falling Behind Online", score: (s) => { if (!has(s, "internet")) return -1; const world = s.setup.world[s.turn - 1]?.values.internet?.value; const here = m(s, "internet"); return world && here !== undefined && world > 2 ? Math.max(0, Math.min(1.2, (world - here) / world)) : 0; },
    describe: (s) => `${fmt(m(s, "internet"))}% of people use the internet, compared with ${fmt(s.setup.world[s.turn - 1]?.values.internet?.value)}% worldwide.`,
    options: ["digital_network", "vocational", "fdi_incentives", "primary_schools"] },
  { id: "rural_stagnation", title: "Rural Stagnation", score: (s) => !has(s, "agriculture") ? -1 : Math.max(0, ((m(s, "agriculture") ?? 0) - 12) / 25),
    describe: (s) => `Farming still produces ${fmt(m(s, "agriculture"), 0)}% of GDP, but yields are low and rural incomes are stagnant.`,
    options: ["agri_modernize", "grid_expansion", "water_sanitation", "export_zones"] },
];

export interface EventContext {
  worldGrowth: number | null;
  worldGrowthPrev: number | null;
  worldTradeChange: number | null;
  worldFdiChange: number | null;
  rentsChange: number | null;
  worldInternetChange: number | null;
  tradeExposure: number;
  fdiExposure: number;
  agriExposure: number;
  renewableShare: number;
}

export interface EventDef {
  id: string;
  title: string;
  weight: (c: EventContext) => number;
  /** Severity multiplier from country structure. */
  severity: (c: EventContext) => number;
  describe: (c: EventContext) => string;
  modifiers: Modifiers;
  mechanics: MechanicsDelta;
}

const dGrowth = (c: EventContext) => (c.worldGrowth !== null && c.worldGrowthPrev !== null ? c.worldGrowth - c.worldGrowthPrev : 0);

export const EVENTS: EventDef[] = [
  { id: "global_slowdown", title: "Global Slowdown", weight: (c) => Math.max(0, -dGrowth(c)) * 2 + ((c.worldGrowth ?? 3) < 2 ? 2.5 : 0), severity: (c) => 0.5 + c.tradeExposure,
    describe: (c) => `World GDP growth fell to ${(c.worldGrowth ?? 0).toFixed(1)}%. Export orders are drying up.`, modifiers: { growthPP: -1.2, fdiTarget: -0.8, unemploymentPP: 0.3 }, mechanics: { satisfaction: -4, treasury: -3 } },
  { id: "global_boom", title: "Global Boom", weight: (c) => Math.max(0, dGrowth(c)) * 1.5 + ((c.worldGrowth ?? 0) > 4 ? 1 : 0), severity: (c) => 0.5 + c.tradeExposure,
    describe: (c) => `World growth picked up to ${(c.worldGrowth ?? 0).toFixed(1)}%. Demand for your exports is rising.`, modifiers: { growthPP: 0.8, fdiTarget: 0.5 }, mechanics: { treasury: 3, satisfaction: 2 } },
  { id: "commodity_boom", title: "Commodity Boom", weight: (c) => Math.max(0, c.rentsChange ?? 0) * 2 * (0.4 + c.agriExposure), severity: (c) => 0.5 + c.agriExposure,
    describe: () => "Global prices for raw materials are climbing. Commodity earnings are pouring in.", modifiers: { growthPP: 0.6 }, mechanics: { treasury: 8 } },
  { id: "commodity_slump", title: "Commodity Slump", weight: (c) => Math.max(0, -(c.rentsChange ?? 0)) * 2 * (0.4 + c.agriExposure), severity: (c) => 0.5 + c.agriExposure,
    describe: () => "Global raw-material earnings are falling. Export revenue is shrinking.", modifiers: { growthPP: -0.6 }, mechanics: { treasury: -6, satisfaction: -2 } },
  { id: "drought", title: "Severe Drought", weight: (c) => 0.5 * c.agriExposure, severity: (c) => 0.4 + c.agriExposure,
    describe: () => "Rains failed across the main farming regions. Harvests are down sharply.", modifiers: { growthPP: -0.8, infantDecline: -0.8, urbanRate: 0.2 }, mechanics: { satisfaction: -5, treasury: -4 } },
  { id: "energy_shock", title: "Energy Price Shock", weight: () => 0.5, severity: (c) => 1.2 - c.renewableShare / 100,
    describe: () => "Imported fuel prices jumped. Transport and power costs are rising.", modifiers: { growthPP: -0.5, co2Intensity: -0.5 }, mechanics: { treasury: -5, satisfaction: -3 } },
  { id: "fdi_opportunity", title: "Investor Opportunity", weight: (c) => 0.4 + Math.max(0, c.worldFdiChange ?? 0) + c.fdiExposure * 0.3, severity: (c) => 0.6 + c.fdiExposure * 0.5,
    describe: () => "A major foreign manufacturer is scouting locations in your region.", modifiers: { fdiTarget: 1.5, growthPP: 0.4, unemploymentPP: -0.15 }, mechanics: { politicalCapital: 3 } },
  { id: "financial_turmoil", title: "Financial Turmoil", weight: (c) => 0.15 + Math.max(0, -dGrowth(c)) * 0.6 + c.fdiExposure * 0.3, severity: (c) => 0.5 + c.fdiExposure,
    describe: () => "Capital is fleeing emerging markets. Your currency is under pressure.", modifiers: { growthPP: -1.3, fdiTarget: -1.2, unemploymentPP: 0.35 }, mechanics: { treasury: -6, satisfaction: -4 } },
  { id: "trade_expansion", title: "Trade Expansion", weight: (c) => Math.max(0, c.worldTradeChange ?? 0) * 0.5, severity: (c) => 0.5 + c.tradeExposure,
    describe: () => "World trade is expanding and new markets are opening to your exporters.", modifiers: { tradeTarget: 6, growthPP: 0.5 }, mechanics: { treasury: 2 } },
  { id: "tech_boom", title: "Technology Wave", weight: (c) => Math.max(0, c.worldInternetChange ?? 0) * 0.25, severity: () => 1,
    describe: () => "New communications technology is spreading worldwide and getting cheaper.", modifiers: { internetRate: 0.08, growthPP: 0.2 }, mechanics: {} },
  { id: "migration_surge", title: "Migration to the Cities", weight: (c) => 0.3 + c.agriExposure * 0.4, severity: () => 1,
    describe: () => "Rural families are moving to the cities faster than housing can be built.", modifiers: { urbanRate: 0.4, unemploymentPP: 0.15 }, mechanics: { satisfaction: -3 } },
  { id: "calm", title: "A Quiet Stretch", weight: () => 0.8, severity: () => 0,
    describe: () => "No major outside shocks. Your government can focus on its own agenda.", modifiers: {}, mechanics: { politicalCapital: 2 } },
];

export const OBJECTIVES: Record<Objective, { title: string; description: string; weights: Record<"economy" | "health" | "education" | "infrastructure" | "sustainability", number> }> = {
  balanced: { title: "Balanced Development", description: "Advance the economy, health, education, infrastructure and sustainability together.", weights: { economy: 0.2, health: 0.2, education: 0.2, infrastructure: 0.2, sustainability: 0.2 } },
  growth: { title: "Economic Growth", description: "Maximize income, jobs and investment.", weights: { economy: 0.5, health: 0.1, education: 0.15, infrastructure: 0.2, sustainability: 0.05 } },
  quality: { title: "Quality of Life", description: "Longer, healthier lives, better schooling and decent jobs.", weights: { economy: 0.15, health: 0.4, education: 0.3, infrastructure: 0.15, sustainability: 0 } },
  green: { title: "Green Development", description: "Grow while cutting emissions and expanding renewables.", weights: { economy: 0.25, health: 0.1, education: 0.1, infrastructure: 0.15, sustainability: 0.4 } },
};
