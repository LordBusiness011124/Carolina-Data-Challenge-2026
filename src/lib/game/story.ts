// The chronicle: turns each completed turn into a short story. "Your story" narrates the player's
// simulated timeline; "What actually happened" narrates real World Bank data for the same two years.
// Real-history text states only what the data shows; it never invents real events or politics.
import { formatValue } from "../format";
import { INDICATORS, type IndicatorId } from "../worldbank/indicators";
import type { ResolvedValue } from "../worldbank/observations";
import { GOOD_EVENTS, POLICIES } from "./rules";
import { isBetter, roughlyEqual } from "./scoring";
import type { GameState, SimulatedMetrics } from "./types";

export type RealHistory = Partial<Record<IndicatorId, (ResolvedValue | null)[]>>;

export interface Chapter {
  turn: number;
  fromYear: number;
  toYear: number;
  title: string;
  decision: string;
  world: string;
  politics: { headline: string; story: string };
  yourResults: string;
  real: string | null;
  verdict: string | null;
  comparison: { id: IndicatorId; you: number; real: number; ahead: boolean }[];
  /** True when school enrollment is a gross rate, where values above 100% mean over-age pupils. */
  grossEnrollment: boolean;
}

/** Lower-case an indicator name for use mid-sentence, keeping acronyms such as GDP and CO2. */
export function inSentence(name: string): string {
  return /^[A-Z0-9]{2}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

const STORY_INDICATORS: IndicatorId[] = ["gdpPerCapita", "lifeExpectancy", "infantMortality", "electricity", "unemployment", "education", "co2"];

function change(id: IndicatorId, a: number | undefined | null, b: number | undefined | null): string | null {
  if (a == null || b == null) return null;
  const def = INDICATORS[id];
  const name = inSentence(def.shortName);
  if (id === "gdpPerCapita") {
    const pct = (b / a - 1) * 100;
    return Math.abs(pct) < 0.5 ? `${name} held at ${formatValue(id, b)}` : `${name} ${pct > 0 ? "grew" : "shrank"} ${Math.abs(pct).toFixed(0)}% to ${formatValue(id, b)}`;
  }
  const d = b - a;
  const tiny = Math.abs(d) < Math.max(0.05, Math.abs(a) * 0.004);
  if (tiny) return `${name} held at ${formatValue(id, b)}`;
  return `${name} ${d > 0 ? "rose" : "fell"} from ${formatValue(id, a)} to ${formatValue(id, b)}`;
}

function sentence(parts: (string | null)[]): string {
  const items = parts.filter((p): p is string => !!p);
  if (!items.length) return "";
  const text = items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

/** Build the chapter for a completed turn (1-based). `real` holds real values per turn year, as far as revealed. */
export function chapterFor(state: GameState, turn: number, real: RealHistory | null): Chapter | null {
  const decision = state.decisionHistory.find((d) => d.turn === turn);
  const event = state.eventHistory.find((e) => e.turn === turn);
  const politics = state.politicalHistory.find((p) => p.turn === turn);
  const before: SimulatedMetrics | undefined = state.metricHistory[turn - 1]?.metrics;
  const after: SimulatedMetrics | undefined = state.metricHistory[turn]?.metrics;
  if (!decision || !event || !politics || !before || !after) return null;
  const fromYear = state.startYear + (turn - 1) * 2;
  const toYear = fromYear + 2;

  const policy = POLICIES[decision.policyId];
  const decisionText = decision.policyId === "status_quo"
    ? `Facing "${decision.problemTitle}", you chose to stay the course and hold your political capital in reserve.`
    : `Facing "${decision.problemTitle}", you backed ${decision.policyTitle}. ${policy?.description ?? ""}`;
  const truth = policy?.harmful ? ` ${policy.truth || "It served you and your allies more than your people."}` : "";
  const greed = truth + (policy?.enrichment ? ` About $${Math.round(policy.enrichment)} million quietly found its way into your private accounts.` : "");
  const risk = decision.riskTriggered && policy?.risk ? ` It did not all go to plan: ${policy.risk.description.charAt(0).toLowerCase()}${policy.risk.description.slice(1)}` : "";

  const dice = event.dice[0] + event.dice[1];
  const good = GOOD_EVENTS.has(event.eventId);
  const luck = dice >= 9 ? (good ? ", so the boost was bigger than usual" : ", so it hit hard") : dice <= 5 ? (good ? ", so the boost was modest" : ", softening the blow") : "";
  const world = event.eventId === "calm" ? `${event.title}. ${event.description}` : `${event.title}. ${event.description} The fortune dice rolled ${dice}${luck}.`;

  const yours = sentence(STORY_INDICATORS.map((id) => change(id, before[id], after[id])));
  const realBefore = (id: IndicatorId) => real?.[id]?.[turn - 1]?.value;
  const realAfter = (id: IndicatorId) => real?.[id]?.[turn]?.value;
  const hasReal = real && STORY_INDICATORS.some((id) => realAfter(id) != null);
  const realText = hasReal ? sentence(STORY_INDICATORS.map((id) => change(id, realBefore(id), realAfter(id)))) : null;

  const comparison = STORY_INDICATORS.flatMap((id) => {
    const you = after[id], r = realAfter(id);
    if (you === undefined || r == null || roughlyEqual(you, r)) return [];
    const ahead = isBetter(id, you, r);
    return ahead === null ? [] : [{ id, you, real: r, ahead }];
  });
  const ahead = comparison.filter((c) => c.ahead).map((c) => inSentence(INDICATORS[c.id].shortName));
  const behind = comparison.filter((c) => !c.ahead).map((c) => inSentence(INDICATORS[c.id].shortName));
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const verdict = hasReal
    ? ahead.length && behind.length
      ? `By ${toYear} your ${state.countryName} is ahead of the real one on ${list(ahead)}, but behind on ${list(behind)}.`
      : ahead.length
        ? `By ${toYear} your ${state.countryName} is ahead of the real one on ${list(ahead)}.`
        : behind.length
          ? `By ${toYear} the real ${state.countryName} is ahead of yours on ${list(behind)}.`
          : `By ${toYear} your timeline and real history are neck and neck.`
    : null;

  return {
    turn,
    fromYear,
    toYear,
    title: `Chapter ${turn} · ${fromYear}–${toYear}: ${decision.problemTitle}`,
    decision: decisionText + greed + risk,
    world,
    politics: { headline: politics.headline, story: politics.story },
    yourResults: yours ? `By ${toYear}, in your ${state.countryName}: ${inSentence(yours)}` : "",
    real: realText ? `In the real ${state.countryName}, ${fromYear}–${toYear} (World Bank data): ${inSentence(realText)}` : null,
    verdict,
    comparison,
    grossEnrollment: state.setup.educationCode.endsWith("ENRR"),
  };
}
