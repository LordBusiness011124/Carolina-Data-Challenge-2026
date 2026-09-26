import type { IndicatorId } from "../worldbank/indicators";
import type { ResolvedValue } from "../worldbank/observations";
import type { StartPackage } from "../worldbank/package";

/** Simulated indicator values. Produced by the game model, never World Bank observations. */
export type SimulatedMetrics = Partial<Record<IndicatorId, number>>;

/** Per-year modifiers the simulation adds to its baseline. Keys are centralized here. */
export interface Modifiers {
  growthPP?: number; // GDP growth, percentage points per year
  electricityRate?: number; // extra share of the remaining access gap closed per year
  lifeGain?: number; // years of life expectancy per year
  infantDecline?: number; // extra % decline in infant mortality per year
  educationGain?: number; // enrollment points per year
  femaleLaborGain?: number; // participation points per year
  internetRate?: number; // extra adoption speed
  fdiTarget?: number; // points added to the FDI level the economy moves toward
  tradeTarget?: number; // points added to the trade level the economy moves toward
  co2Intensity?: number; // % change in emissions per person per year
  renewableGain?: number; // renewable share points per year
  unemploymentPP?: number; // unemployment points per year
  urbanRate?: number; // urbanization points per year
}
export type ModifierKey = keyof Modifiers;

export interface MechanicsDelta {
  treasury?: number;
  politicalCapital?: number;
  satisfaction?: number;
}

export interface ActiveEffect {
  id: string;
  label: string;
  source: string;
  sourceTurn: number;
  startsTurn: number;
  endsTurn: number;
  modifiers: Modifiers;
  callback?: string;
}

export type Objective = "balanced" | "growth" | "quality" | "green";
export type Difficulty = "easy" | "normal" | "hard";
export type Phase = "briefing" | "decision" | "consequence" | "reaction" | "finished";

export interface DecisionRecord {
  turn: number;
  year: number;
  problemId: string;
  problemTitle: string;
  policyId: string;
  policyTitle: string;
  riskTriggered: boolean;
}

export interface EventRecord {
  turn: number;
  year: number;
  eventId: string;
  title: string;
  description: string;
  severity: number;
  dice: [number, number];
}

/** A fictional political development (see politics.ts). Not real history. */
export interface PoliticalRecord {
  turn: number;
  year: number;
  id: string;
  headline: string;
  story: string;
  mechanics: MechanicsDelta;
}

export interface Outcome {
  policyTitle: string;
  mechanics: MechanicsDelta;
  immediate: { label: string; direction: "up" | "down" }[];
  scheduled: { label: string; startsYear: number }[];
  riskMessage: string | null;
}

export interface Reaction {
  eventId: string;
  title: string;
  description: string;
  severity: number;
  mechanics: MechanicsDelta;
  changes: { id: IndicatorId; before: number; after: number }[];
  callbacks: string[];
  crisis: string | null;
  /** Two seeded fortune dice (1-6 each). Their total scales how hard the event hits. */
  dice: [number, number];
  /** Political capital from leading the region, if earned this turn. */
  regionBonus: number;
  /** This turn's fictional political development. */
  political: PoliticalRecord;
}

export interface GameState {
  version: 1;
  seed: string;
  objective: Objective;
  difficulty: Difficulty;
  countryCode: string;
  countryName: string;
  startYear: number;
  currentYear: number;
  turn: number; // 1-based
  totalTurns: number;
  phase: Phase;
  setup: StartPackage;
  /** Real starting values from the World Bank, kept separate from simulated values. */
  realStart: Partial<Record<IndicatorId, ResolvedValue>>;
  metrics: SimulatedMetrics;
  metricHistory: { year: number; metrics: SimulatedMetrics }[];
  lastGrowth: number;
  treasury: number;
  politicalCapital: number;
  satisfaction: number;
  activeEffects: ActiveEffect[];
  decisionHistory: DecisionRecord[];
  eventHistory: EventRecord[];
  currentProblemId: string | null;
  recentProblems: string[];
  lastOutcome: Outcome | null;
  lastReaction: Reaction | null;
  pendingModifiers: Modifiers;
  politicalHistory: PoliticalRecord[];
  /** Money the leader has secretly pocketed through corrupt choices, in millions of US dollars. */
  personalWealth: number;
}
