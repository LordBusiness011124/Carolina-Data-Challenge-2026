// Regional board: a simple, comparable development index for the player and real rival countries.
// This is a game index for comparing countries, not the UN Human Development Index.
import type { IndicatorId } from "./indicators";

export const RIVAL_INDICATORS: IndicatorId[] = ["lifeExpectancy", "gdpPerCapita", "infantMortality", "electricity"];

export interface RivalsPackage {
  regionCode: string;
  regionName: string;
  turnYears: number[];
  rivals: { code: string; name: string; values: Partial<Record<IndicatorId, number | null>>[] }[];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Development index, 0 to 100: the mean of up to four components, each scaled 0 to 1.
 * Life expectancy 40 to 85 years; GDP per capita on a log scale from $300 to $60,000;
 * infant mortality on an inverted log scale from 150 to 2 per 1,000; electricity access 0 to 100%.
 * Needs at least three components, otherwise null.
 */
export function developmentIndex(v: Partial<Record<IndicatorId, number | null | undefined>>): number | null {
  const parts: number[] = [];
  if (v.lifeExpectancy != null) parts.push(clamp01((v.lifeExpectancy - 40) / 45));
  if (v.gdpPerCapita != null && v.gdpPerCapita > 0) parts.push(clamp01((Math.log(v.gdpPerCapita) - Math.log(300)) / (Math.log(60000) - Math.log(300))));
  if (v.infantMortality != null && v.infantMortality > 0) parts.push(clamp01(1 - (Math.log(v.infantMortality) - Math.log(2)) / (Math.log(150) - Math.log(2))));
  if (v.electricity != null) parts.push(clamp01(v.electricity / 100));
  return parts.length >= 3 ? (100 * parts.reduce((a, b) => a + b, 0)) / parts.length : null;
}

export interface Standing {
  code: string;
  name: string;
  index: number;
  isPlayer: boolean;
  /** The player's index is higher: this territory is under the player's development influence. */
  influenced: boolean;
}

/** Rank the player (simulated) against real rivals at one turn. Rivals without enough data are left off the board. */
export function regionalStandings(player: { code: string; name: string; index: number | null }, rivals: RivalsPackage, turnIndex: number): Standing[] {
  const rows: Standing[] = [];
  for (const r of rivals.rivals) {
    const index = developmentIndex(r.values[turnIndex] ?? {});
    if (index !== null) rows.push({ code: r.code, name: r.name, index, isPlayer: false, influenced: player.index !== null && player.index > index });
  }
  if (player.index !== null) rows.push({ code: player.code, name: player.name, index: player.index, isPlayer: true, influenced: false });
  return rows.sort((a, b) => b.index - a.index);
}
