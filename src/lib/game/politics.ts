// Fictional political storyline. These events are invented for the game, driven by the simulated
// situation (public mood, jobs, the treasury, your last policy) and a seeded draw. They are never
// presented as real history and never name real people or parties.
import { POLICIES } from "./rules";
import { rngFor, weightedPick } from "./rng";
import type { GameState, MechanicsDelta } from "./types";

export interface PoliticalEvent {
  id: string;
  headline: string;
  story: string;
  mechanics: MechanicsDelta;
}

/** An election is held every other turn (every four years). */
export const ELECTION_EVERY_TURNS = 2;

function election(s: GameState): PoliticalEvent {
  const mood = s.satisfaction;
  if (mood >= 55) {
    return { id: "election_landslide", headline: "Landslide re-election", story: `Voters across ${s.countryName} returned your government with a commanding majority. Parliament now moves quickly on your agenda.`, mechanics: { politicalCapital: 12, satisfaction: 2 } };
  }
  if (mood >= 42) {
    return { id: "election_narrow", headline: "Narrow election win", story: `A tense election night ended in a narrow victory. You keep your majority, but backbenchers want to be consulted more.`, mechanics: { politicalCapital: 2 } };
  }
  return { id: "election_coalition", headline: "Hung parliament: coalition government", story: `Your party lost its majority. You stay in office only by forming a coalition with a rival party, which will make big reforms harder.`, mechanics: { politicalCapital: -12, satisfaction: 3 } };
}

export function politicalEvent(s: GameState, lastPolicyId: string | null): PoliticalEvent {
  if (s.turn % ELECTION_EVERY_TURNS === 0) return election(s);
  const random = rngFor(s.seed, s.turn, "politics");
  const unemploymentUp = (() => {
    const h = s.metricHistory;
    const a = h[h.length - 2]?.metrics.unemployment, b = h[h.length - 1]?.metrics.unemployment;
    return a !== undefined && b !== undefined ? b - a : 0;
  })();
  const last = lastPolicyId ? POLICIES[lastPolicyId] : undefined;
  const popular = last && ["Healthcare", "Education", "Social"].includes(last.category) && lastPolicyId !== "status_quo";
  const options: { item: PoliticalEvent; weight: number }[] = [
    {
      item: { id: "protests", headline: "Street protests in the capital", story: `Tens of thousands marched through the capital demanding jobs and lower prices. The opposition is calling for early elections.`, mechanics: { satisfaction: -3, politicalCapital: -6 } },
      weight: Math.max(0, (50 - s.satisfaction) / 8) + Math.max(0, unemploymentUp * 2),
    },
    {
      item: { id: "strike", headline: "General strike called", story: `Trade unions staged a two-day general strike after job losses in factories and ports.`, mechanics: { satisfaction: -2, politicalCapital: -4, treasury: -2 } },
      weight: Math.max(0, ((s.metrics.unemployment ?? 4) - 6) / 4) + (lastPolicyId === "austerity" ? 1.5 : 0),
    },
    {
      item: { id: "coalition_demand", headline: "Allies demand a bigger say", story: `Regional leaders in your own party threaten to block the budget unless their provinces get more investment.`, mechanics: { politicalCapital: -5, treasury: -3 } },
      weight: 0.5,
    },
    {
      item: { id: "scandal", headline: "Procurement scandal", story: `A newspaper investigation uncovered inflated contracts at a public works agency. You fired the agency head, but trust took a hit.`, mechanics: { satisfaction: -4, politicalCapital: -5 } },
      weight: 0.35 + (s.treasury < 20 ? 0.3 : 0),
    },
    {
      item: { id: "popular_reform", headline: `${last?.title ?? "Your reform"} wins hearts`, story: `Families in towns and villages credit the ${last?.title.toLowerCase() ?? "reform"} for real improvements. Your approval is rising.`, mechanics: { satisfaction: 4, politicalCapital: 4 } },
      weight: popular ? 1.2 : 0,
    },
    {
      item: { id: "opposition_deal", headline: "Cross-party deal", story: `Moderates in the opposition agreed to back your development plan in exchange for a seat on the budget committee.`, mechanics: { politicalCapital: 6 } },
      weight: s.satisfaction > 55 ? 0.8 : 0.2,
    },
    {
      item: { id: "anticorruption", headline: "Anti-corruption drive", story: `A new anti-corruption commission you backed secured its first convictions. Investors and voters took note.`, mechanics: { satisfaction: 3, politicalCapital: 2 } },
      weight: 0.35,
    },
    {
      item: { id: "corruption_exposed", headline: "Leaked bank records", story: `Leaked documents show about $${Math.round(s.personalWealth)} million moving from public contracts into offshore accounts linked to the presidency. Parliament has opened an inquiry.`, mechanics: { satisfaction: -9, politicalCapital: -10 } },
      weight: s.personalWealth / 40,
    },
    {
      item: { id: "quiet_session", headline: "A quiet parliamentary session", story: `Parliament passed the budget with little drama. Your ministers can focus on delivery.`, mechanics: { politicalCapital: 2 } },
      weight: 0.6,
    },
  ];
  return weightedPick(options, random);
}
