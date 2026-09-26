// Deterministic simulation engine. Pure functions: (state, choice, seed) -> new state.
// new value = previous simulated value + historical baseline trend + policy effects
//           + delayed policy effects + world event effects + interaction effects (clamped).
import { EDUCATION_CANDIDATES, INDICATOR_IDS, type IndicatorId } from "../worldbank/indicators";
import type { StartPackage } from "../worldbank/package";
import { CONSTANTS, EVENTS, FALLBACK_POLICY, POLICIES, PROBLEMS, type EventContext, type PolicyDef, type ProblemDef } from "./rules";
import { rngFor, weightedPick } from "./rng";
import type { ActiveEffect, Difficulty, GameState, MechanicsDelta, Modifiers, Objective, Reaction, SimulatedMetrics } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pick = <T>(v: T | null | undefined, fallback: T) => (v === null || v === undefined ? fallback : v);

/** Copy game state. The setup package is immutable, so it is shared instead of deep-copied (keeps AI rollouts fast). */
export function cloneState(s: GameState): GameState {
  const { setup, realStart, ...rest } = s;
  return { ...structuredClone(rest), setup, realStart };
}

export function createGame(setup: StartPackage, options: { seed: string; objective: Objective; difficulty: Difficulty }): GameState {
  const metrics: SimulatedMetrics = {};
  for (const id of INDICATOR_IDS) {
    const real = setup.start[id];
    if (real) metrics[id] = real.value;
  }
  const res = CONSTANTS.startResources[options.difficulty];
  const state: GameState = {
    version: 1,
    seed: options.seed,
    objective: options.objective,
    difficulty: options.difficulty,
    countryCode: setup.country.code,
    countryName: setup.country.name,
    startYear: setup.startYear,
    currentYear: setup.startYear,
    turn: 1,
    totalTurns: setup.turnYears.length - 1,
    phase: "briefing",
    setup,
    realStart: setup.start,
    metrics,
    metricHistory: [{ year: setup.startYear, metrics: { ...metrics } }],
    lastGrowth: pick(metrics.gdpGrowth, CONSTANTS.defaultGrowthAnchor),
    treasury: res.treasury,
    politicalCapital: res.politicalCapital,
    satisfaction: res.satisfaction,
    activeEffects: [],
    decisionHistory: [],
    eventHistory: [],
    currentProblemId: null,
    recentProblems: [],
    lastOutcome: null,
    lastReaction: null,
    pendingModifiers: {},
    advisorUses: CONSTANTS.advisorUses,
  };
  state.currentProblemId = chooseProblem(state).id;
  return state;
}

export function addModifiers(a: Modifiers, b: Modifiers, scale = 1): Modifiers {
  const out: Modifiers = { ...a };
  for (const [key, value] of Object.entries(b) as [keyof Modifiers, number][]) out[key] = (out[key] ?? 0) + value * scale;
  return out;
}

function applyMechanics(state: GameState, delta: MechanicsDelta, scale = 1) {
  state.treasury = clamp(state.treasury + (delta.treasury ?? 0) * scale, -40, 100);
  state.politicalCapital = clamp(state.politicalCapital + (delta.politicalCapital ?? 0) * scale, 0, 100);
  state.satisfaction = clamp(state.satisfaction + (delta.satisfaction ?? 0) * scale, 0, 100);
}

/** The most pressing national problem that was not posed in the last two turns. */
export function chooseProblem(state: GameState): ProblemDef {
  const random = rngFor(state.seed, state.turn, "problem");
  const scored = PROBLEMS.filter((p) => !state.recentProblems.slice(-2).includes(p.id)).map((p) => ({ p, score: p.score(state) + random() * 0.15 }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].p;
}

export function currentProblem(state: GameState): ProblemDef {
  return PROBLEMS.find((p) => p.id === state.currentProblemId) ?? chooseProblem(state);
}

export function policyOptions(state: GameState): PolicyDef[] {
  return [...currentProblem(state).options, FALLBACK_POLICY].map((id) => POLICIES[id]);
}

export function canAfford(state: GameState, policy: PolicyDef): boolean {
  return state.politicalCapital >= policy.cost.politicalCapital && (policy.cost.treasury === 0 || state.treasury - policy.cost.treasury >= -20);
}

export function beginDecision(state: GameState): GameState {
  if (state.phase !== "briefing") throw new Error("Not in briefing phase");
  return { ...state, phase: "decision" };
}

/** Phase 4: apply a policy. Immediate effects hit now; delayed effects are scheduled. */
export function applyDecision(prev: GameState, policyId: string): GameState {
  if (prev.phase !== "decision") throw new Error("Not in decision phase");
  const policy = POLICIES[policyId];
  const problem = currentProblem(prev);
  if (!policy || !(problem.options.includes(policyId) || policyId === FALLBACK_POLICY)) throw new Error("Policy not available this turn");
  if (!canAfford(prev, policy)) throw new Error("Not enough resources for this policy");
  const state: GameState = cloneState(prev);
  applyMechanics(state, { treasury: -policy.cost.treasury, politicalCapital: -policy.cost.politicalCapital });
  applyMechanics(state, policy.mechanics);
  // Effect strength: global scale x diminishing returns for repeats x seeded execution quality.
  const repeats = prev.decisionHistory.filter((d) => d.policyId === policyId).length;
  const [lo, hi] = CONSTANTS.executionRange;
  const execution = lo + (hi - lo) * rngFor(state.seed, state.turn, "execution:" + policy.id)();
  const strength = CONSTANTS.policyEffectScale * Math.pow(CONSTANTS.repeatDecay, repeats) * execution;
  state.pendingModifiers = addModifiers({ growthPP: -CONSTANTS.spendingDrag * policy.cost.treasury }, policy.immediate, strength);
  const scheduled: { label: string; startsYear: number }[] = [];
  for (const [i, d] of policy.delayed.entries()) {
    const effect: ActiveEffect = {
      id: `${policy.id}-${state.turn}-${i}`,
      label: d.label,
      source: policy.title,
      sourceTurn: state.turn,
      startsTurn: state.turn + d.startsAfterTurns,
      endsTurn: state.turn + d.startsAfterTurns + d.durationTurns - 1,
      modifiers: addModifiers({}, d.modifiers, strength),
      callback: d.callback,
    };
    state.activeEffects.push(effect);
    scheduled.push({ label: d.label, startsYear: state.startYear + (effect.startsTurn - 1) * 2 });
  }
  const riskRoll = rngFor(state.seed, state.turn, "risk:" + policy.id)();
  const riskTriggered = !!policy.risk && riskRoll < policy.risk.chance;
  if (riskTriggered && policy.risk) {
    if (policy.risk.mechanics) applyMechanics(state, policy.risk.mechanics);
    if (policy.risk.modifiers) state.pendingModifiers = addModifiers(state.pendingModifiers, policy.risk.modifiers);
  }
  state.decisionHistory.push({ turn: state.turn, year: state.currentYear, problemId: problem.id, problemTitle: problem.title, policyId, policyTitle: policy.title, riskTriggered });
  state.lastOutcome = {
    policyTitle: policy.title,
    mechanics: {
      treasury: -policy.cost.treasury + (policy.mechanics.treasury ?? 0) + (riskTriggered ? policy.risk?.mechanics?.treasury ?? 0 : 0),
      politicalCapital: -policy.cost.politicalCapital + (policy.mechanics.politicalCapital ?? 0) + (riskTriggered ? policy.risk?.mechanics?.politicalCapital ?? 0 : 0),
      satisfaction: (policy.mechanics.satisfaction ?? 0) + (riskTriggered ? policy.risk?.mechanics?.satisfaction ?? 0 : 0),
    },
    immediate: policy.immediateLabels,
    scheduled,
    riskMessage: riskTriggered ? policy.risk!.description : null,
  };
  state.phase = "consequence";
  return state;
}

export function eventContext(state: GameState): EventContext {
  const now = state.setup.world[state.turn]?.values; // conditions over the coming two years
  const before = state.setup.world[state.turn - 1]?.values;
  const diff = (key: "trade" | "fdi" | "resourceRents" | "internet") => (now?.[key] && before?.[key] ? now[key]!.value - before[key]!.value : null);
  return {
    worldGrowth: now?.growth?.value ?? null,
    worldGrowthPrev: before?.growth?.value ?? state.setup.worldReferenceGrowth,
    worldTradeChange: diff("trade"),
    worldFdiChange: diff("fdi"),
    rentsChange: diff("resourceRents"),
    worldInternetChange: diff("internet"),
    tradeExposure: clamp(pick(state.metrics.trade, 50) / 80, 0.3, 1.5),
    fdiExposure: clamp(pick(state.metrics.fdi, 2) / 5, 0, 1.5),
    agriExposure: clamp(pick(state.metrics.agriculture, 15) / 25, 0, 1.5),
    renewableShare: pick(state.metrics.renewable, 20),
  };
}

/** Two seeded fortune dice for this turn. */
export function rollDice(seed: string, turn: number): [number, number] {
  const r = rngFor(seed, turn, "dice");
  return [1 + Math.floor(r() * 6), 1 + Math.floor(r() * 6)];
}

/**
 * Phase 5: the world reacts, the economy runs for two years, and the turn's results are recorded.
 * `regionLeader` is true when the player leads at least half of the region's rivals on the board.
 */
export function worldReaction(prev: GameState, options: { regionLeader?: boolean } = {}): GameState {
  if (prev.phase !== "consequence") throw new Error("Not in consequence phase");
  const state: GameState = cloneState(prev);
  const context = eventContext(state);
  const random = rngFor(state.seed, state.turn, "event");
  const event = weightedPick(EVENTS.map((e) => ({ item: e, weight: e.weight(context) })), random);
  const dice = rollDice(state.seed, state.turn);
  const [lo, hi] = CONSTANTS.diceSeverityRange;
  const fortune = lo + ((dice[0] + dice[1] - 2) / 10) * (hi - lo);
  const severity = clamp(event.severity(context) * fortune, 0, 2.5);
  applyMechanics(state, event.mechanics, severity === 0 ? 1 : severity);

  const nextTurn = state.turn + 1;
  const active = state.activeEffects.filter((e) => e.startsTurn <= state.turn && e.endsTurn >= state.turn);
  let modifiers = addModifiers(state.pendingModifiers, event.modifiers, severity);
  for (const effect of active) modifiers = addModifiers(modifiers, effect.modifiers);
  const callbacks = active.filter((e) => e.startsTurn === state.turn && e.callback).map((e) => e.callback!.replace(/^/, `${yearsAgo(state, e.sourceTurn)} `));

  const before = { ...state.metrics };
  const worldGrowth = context.worldGrowth;
  let growth = state.lastGrowth;
  for (let y = 0; y < 2; y++) growth = stepYear(state, modifiers, worldGrowth, context.tradeExposure);
  const unemploymentChange = pick(state.metrics.unemployment, 0) - pick(before.unemployment, 0);

  // Mechanics respond to the economy.
  const anchor = growthAnchor(state.setup);
  state.treasury = clamp(state.treasury + CONSTANTS.revenuePerTurn[state.difficulty] + CONSTANTS.revenuePerGrowthPoint * (growth - anchor), -40, 100);
  const regionBonus = options.regionLeader ? CONSTANTS.regionLeaderBonus : 0;
  state.politicalCapital = clamp(state.politicalCapital + regionBonus + (state.satisfaction < CONSTANTS.lowSatisfaction ? CONSTANTS.politicalRegenLowSatisfaction : CONSTANTS.politicalRegen), 0, 100);
  state.satisfaction = clamp(
    state.satisfaction + CONSTANTS.satisfactionPerGrowthPoint * (growth - anchor) + CONSTANTS.satisfactionPerUnemploymentPoint * unemploymentChange + (50 - state.satisfaction) * CONSTANTS.satisfactionReversion,
    0, 100,
  );
  let crisis: string | null = null;
  if (state.treasury < 0) {
    crisis = "The treasury ran dry. Emergency borrowing kept the government running, but public anger rose.";
    state.treasury = 5;
    state.satisfaction = clamp(state.satisfaction + CONSTANTS.debtCrisisSatisfaction, 0, 100);
    state.politicalCapital = clamp(state.politicalCapital - 8, 0, 100);
  }

  state.currentYear += 2;
  state.metricHistory.push({ year: state.currentYear, metrics: { ...state.metrics } });
  state.eventHistory.push({ turn: state.turn, year: state.currentYear - 2, eventId: event.id, title: event.title, description: event.describe(context), severity });
  state.lastReaction = {
    eventId: event.id,
    title: event.title,
    description: event.describe(context),
    severity,
    mechanics: event.mechanics,
    changes: (["gdpPerCapita", "gdpGrowth", "lifeExpectancy", "infantMortality", "electricity", "unemployment", "co2", "education"] as IndicatorId[])
      .filter((id) => before[id] !== undefined && state.metrics[id] !== undefined)
      .map((id) => ({ id, before: before[id]!, after: state.metrics[id]! })),
    callbacks,
    crisis,
    dice,
    regionBonus,
  } satisfies Reaction;
  state.pendingModifiers = {};
  state.activeEffects = state.activeEffects.filter((e) => e.endsTurn >= nextTurn);
  state.phase = "reaction";
  return state;
}

function yearsAgo(state: GameState, sourceTurn: number): string {
  const years = (state.turn - sourceTurn) * 2;
  return years <= 0 ? "Now:" : `${years} years on:`;
}

/** Phase 1 of the next turn, or the end of the game. */
export function nextTurn(prev: GameState): GameState {
  if (prev.phase !== "reaction") throw new Error("Not in reaction phase");
  const state: GameState = cloneState(prev);
  if (state.turn >= state.totalTurns) {
    state.phase = "finished";
    return state;
  }
  state.recentProblems.push(state.currentProblemId ?? "");
  state.turn += 1;
  state.phase = "briefing";
  state.currentProblemId = chooseProblem(state).id;
  return state;
}

export function growthAnchor(setup: StartPackage): number {
  return clamp(pick(setup.baselines.growthAvg, CONSTANTS.defaultGrowthAnchor), CONSTANTS.growthAnchorRange[0], CONSTANTS.growthAnchorRange[1]);
}

/** Advance one simulated year. Mutates state.metrics and returns that year's GDP growth. */
export function stepYear(state: GameState, mod: Modifiers, worldGrowth: number | null, tradeExposure: number): number {
  const m = state.metrics;
  const b = state.setup.baselines;
  const s0 = state.metricHistory[0].metrics;
  const anchor = growthAnchor(state.setup);
  const worldRef = state.setup.worldReferenceGrowth;
  const worldShock = worldGrowth !== null && worldRef !== null ? (worldGrowth - worldRef) * CONSTANTS.worldGrowthPassThrough * tradeExposure : 0;

  // GDP growth: mean-reverts toward the pre-start average, moved by world conditions and modifiers.
  let growth = 0.5 * state.lastGrowth + 0.5 * anchor + worldShock + (mod.growthPP ?? 0);
  if (state.treasury < CONSTANTS.lowTreasury) growth += CONSTANTS.growthPenaltyLowTreasury;
  if (state.satisfaction < CONSTANTS.lowSatisfaction) growth += CONSTANTS.growthPenaltyLowSatisfaction;
  growth = clamp(growth, -10, 14);
  state.lastGrowth = growth;
  m.gdpGrowth = growth;

  const popGrowth = m.popGrowth !== undefined ? clamp(m.popGrowth + clamp(pick(b.popGrowthSlope, -0.03), -0.1, 0.03), -1, 4) : 1;
  if (m.popGrowth !== undefined) m.popGrowth = popGrowth;
  if (m.population !== undefined) m.population = m.population * (1 + popGrowth / 100);
  if (m.gdpPerCapita !== undefined) m.gdpPerCapita = m.gdpPerCapita * (1 + (growth - popGrowth) / 100);

  if (m.urban !== undefined) {
    const slope = clamp(pick(b.urbanSlope, 0.4), 0, 1.2);
    const room = s0.urban !== undefined && s0.urban < 95 ? (95 - m.urban) / (95 - s0.urban) : 0;
    m.urban = clamp(m.urban + slope * room + (mod.urbanRate ?? 0) + 0.03 * (growth - anchor), 0, 95);
  }
  if (m.lifeExpectancy !== undefined) {
    const slope = clamp(pick(b.lifeSlope, 0.3), 0, 0.45);
    const ceiling = CONSTANTS.lifeExpectancyCeiling;
    const room = s0.lifeExpectancy !== undefined && s0.lifeExpectancy < ceiling ? (ceiling - m.lifeExpectancy) / (ceiling - s0.lifeExpectancy) : 0;
    m.lifeExpectancy = clamp(m.lifeExpectancy + slope * room + (mod.lifeGain ?? 0) + 0.01 * (growth - anchor), 30, ceiling);
  }
  if (m.infantMortality !== undefined) {
    const decline = CONSTANTS.trendPersistence * clamp(pick(b.infantDeclinePct, 3), 1, 6) + 1 + (mod.infantDecline ?? 0) + 0.1 * (growth - anchor);
    m.infantMortality = clamp(m.infantMortality * (1 - decline / 100), 1.5, 250);
  }
  if (m.electricity !== undefined) {
    const k = clamp(pick(b.electricityGapClosure, CONSTANTS.defaultElectricityGapClosure), 0.01, 0.12) + (mod.electricityRate ?? 0);
    m.electricity = clamp(m.electricity + clamp(k, 0, 0.5) * (100 - m.electricity), 0, 100);
  }
  if (m.internet !== undefined) {
    const k = CONSTANTS.internetBaseRate + (mod.internetRate ?? 0);
    m.internet = clamp(m.internet + k * (m.internet + 0.3) * (1 - m.internet / 100), 0, 98);
  }
  if (m.fdi !== undefined) {
    const target = pick(b.fdiAvg, m.fdi) + (mod.fdiTarget ?? 0);
    m.fdi = clamp(m.fdi + CONSTANTS.fdiAdjustment * (target - m.fdi), -5, 25);
  }
  if (m.trade !== undefined) {
    const target = pick(b.tradeAvg, m.trade) + (mod.tradeTarget ?? 0) + 0.3 * (growth - anchor);
    m.trade = clamp(m.trade + CONSTANTS.tradeAdjustment * (target - m.trade), 5, 250);
  }
  let renewableChange = 0;
  if (m.renewable !== undefined) {
    const drift = -CONSTANTS.renewableDriftRate * Math.max(0, m.renewable - CONSTANTS.renewableDriftLevel);
    renewableChange = CONSTANTS.trendPersistence * clamp(pick(b.renewableSlope, 0), -2, 0.5) + drift + (mod.renewableGain ?? 0);
    m.renewable = clamp(m.renewable + renewableChange, 0, 98);
  }
  if (m.co2 !== undefined) {
    const change = CONSTANTS.co2IncomeElasticity * (growth - popGrowth) + (m.co2 < 3 ? CONSTANTS.co2TransitionGrowth : 0) + (mod.co2Intensity ?? 0) - 0.5 * renewableChange;
    m.co2 = clamp(m.co2 * (1 + clamp(change, -15, 20) / 100), 0.02, 40);
  }
  if (m.unemployment !== undefined) m.unemployment = clamp(m.unemployment - 0.12 * (growth - anchor) + (mod.unemploymentPP ?? 0), 1, 35);
  if (m.femaleLabor !== undefined) m.femaleLabor = clamp(m.femaleLabor + clamp(pick(b.femaleLaborSlope, 0), -0.5, 0.5) + (mod.femaleLaborGain ?? 0), 5, 90);
  if (m.education !== undefined) {
    const cap = EDUCATION_CANDIDATES.find((c) => c.code === state.setup.educationCode)?.cap ?? 110;
    // Progress means moving toward full, on-time enrollment (100%). Above 100%, gross enrollment
    // falls as over-age and repeating pupils decline, so progress moves it down toward 100.
    const progress = Math.max(0, clamp(pick(b.educationSlope, 0.3), -1, 2)) + (mod.educationGain ?? 0);
    const next = m.education < 100 ? Math.min(100, m.education + progress) : Math.max(100, m.education - progress * 0.6);
    m.education = clamp(next, 0, cap);
  }
  if (m.agriculture !== undefined) m.agriculture = clamp(m.agriculture * (1 - 0.004 * Math.max(0, growth)), 1, 80);
  if (m.industry !== undefined) m.industry = clamp(m.industry + 0.05 * (growth - anchor), 5, 70);
  return growth;
}

/** Plain-language world and domestic briefing for the current turn. Uses world data up to this year only. */
export function briefing(state: GameState): { global: string[]; domestic: string[] } {
  const now = state.setup.world[state.turn - 1]?.values;
  const before = state.turn > 1 ? state.setup.world[state.turn - 2]?.values : undefined;
  const global: string[] = [];
  const g = now?.growth?.value;
  const gPrev = before?.growth?.value ?? state.setup.worldReferenceGrowth ?? undefined;
  if (g !== undefined) {
    const trend = gPrev === undefined ? "" : g - gPrev > 0.8 ? " and accelerating" : g - gPrev < -0.8 ? ", down sharply" : ", roughly steady";
    global.push(`World economic growth is ${g.toFixed(1)}%${trend}.`);
  }
  const rg = now?.regionGrowth?.value;
  if (rg !== undefined) global.push(`Your region, ${state.setup.country.regionName}, is growing ${rg.toFixed(1)}%.`);
  const tr = now?.trade?.value, trPrev = before?.trade?.value;
  if (tr !== undefined && trPrev !== undefined) global.push(tr - trPrev > 1 ? "Global trade is expanding." : tr - trPrev < -1 ? "Global trade is contracting." : "Global trade is stable.");
  const fdi = now?.fdi?.value, fdiPrev = before?.fdi?.value;
  if (fdi !== undefined && fdiPrev !== undefined) global.push(fdi > fdiPrev + 0.3 ? "Foreign investment flows worldwide are rising." : fdi < fdiPrev - 0.3 ? "Foreign investment flows worldwide are falling." : "Foreign investment flows are steady.");
  const rents = now?.resourceRents?.value, rentsPrev = before?.resourceRents?.value;
  if (rents !== undefined && rentsPrev !== undefined && Math.abs(rents - rentsPrev) > 0.3) global.push(rents > rentsPrev ? "Raw-material earnings are climbing worldwide." : "Raw-material earnings are falling worldwide.");
  const net = now?.internet?.value;
  if (net !== undefined && net > 1) global.push(`${net.toFixed(0)}% of the world's people now use the internet.`);

  const domestic: string[] = [];
  const h = state.metricHistory;
  const cur = h[h.length - 1].metrics, prev = h.length > 1 ? h[h.length - 2].metrics : undefined;
  const say = (id: IndicatorId, up: string, down: string, flat: string, threshold: number) => {
    if (!prev || cur[id] === undefined || prev[id] === undefined) return;
    const d = cur[id]! - prev[id]!;
    domestic.push(d > threshold ? up : d < -threshold ? down : flat);
  };
  if (!prev) {
    domestic.push(`Growth was ${pick(cur.gdpGrowth, 0).toFixed(1)}% last year.`);
    if (cur.electricity !== undefined) domestic.push(`${cur.electricity.toFixed(0)}% of people have electricity.`);
    if (cur.urban !== undefined) domestic.push(`${cur.urban.toFixed(0)}% of people live in cities.`);
  } else {
    domestic.push(`The economy grew ${state.lastGrowth.toFixed(1)}% last year.`);
    say("urban", "Urbanization is accelerating.", "People are returning to the countryside.", "Urbanization continues at a steady pace.", 1.5);
    say("electricity", "Electricity access is expanding quickly.", "Electricity access has slipped.", "Electricity access is improving slowly.", 4);
    say("unemployment", "Unemployment has risen.", "Employment has improved.", "The job market is steady.", 0.3);
    say("infantMortality", "Child mortality has worsened.", "Child mortality keeps falling.", "Child health is roughly unchanged.", 1);
  }
  return { global, domestic };
}
