"use client";
import { useCallback, useMemo, useState } from "react";
import { impactVsDoingNothing } from "@/lib/game/impact";
import { applyDecision, beginDecision, createGame, nextTurn, worldReaction } from "@/lib/game/simulation";
import type { RealHistory } from "@/lib/game/story";
import type { GameState } from "@/lib/game/types";
import type { StartPackage } from "@/lib/worldbank/package";
import type { RivalsPackage } from "@/lib/worldbank/rivals";
import { isRegionLeader, standingsFor } from "./Board";
import { HowItWorks } from "./HowItWorks";
import { CountryBriefing, Dashboard } from "./Play";
import { Reveal } from "./Reveal";
import { Landing, Setup, useCountries, type SetupChoice } from "./Setup";

type Screen = "landing" | "setup" | "briefing" | "play" | "reveal";

export default function Game() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [state, setState] = useState<GameState | null>(null);
  const [choice, setChoice] = useState<SetupChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [rivals, setRivals] = useState<RivalsPackage | null>(null);
  const [rivalsError, setRivalsError] = useState<string | null>(null);
  const [real, setReal] = useState<RealHistory | null>(null);
  const [realPending, setRealPending] = useState(false);
  const [realError, setRealError] = useState<string | null>(null);
  const { countries } = useCountries();

  function loadRivals(c: SetupChoice) {
    setRivals(null);
    setRivalsError(null);
    fetch(`/api/rivals?country=${c.country}&year=${c.year}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error))))
      .then((d: RivalsPackage) => setRivals(d))
      .catch((e) => setRivalsError(`${e.message ?? e} The board is unavailable; the game still works.`));
  }

  /** Real history for the turns played so far. The server never returns years beyond `upTo`. */
  const loadReal = useCallback((s: GameState, upTo: number) => {
    setRealPending(true);
    setRealError(null);
    fetch(`/api/history?country=${s.countryCode}&year=${s.startYear}&edu=${encodeURIComponent(s.setup.educationCode)}&upTo=${upTo}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error))))
      .then((d: { history: RealHistory }) => setReal(d.history))
      .catch((e) => setRealError(String(e.message ?? e)))
      .finally(() => setRealPending(false));
  }, []);

  async function start(c: SetupChoice) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/start?country=${c.country}&year=${c.year}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load World Bank data.");
      setChoice(c);
      setReal(null);
      setState(createGame(body as StartPackage, { seed: c.seed, objective: c.objective, difficulty: c.difficulty }));
      loadRivals(c);
      setScreen("briefing");
      window.scrollTo(0, 0);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : String(e)} Retry to try again.`);
    } finally {
      setBusy(false);
    }
  }

  const act = (fn: (s: GameState) => GameState) => {
    if (!state) return;
    const next = fn(state);
    setState(next);
    if (next.phase === "reaction") loadReal(next, next.turn);
    if (next.phase === "finished") setScreen("reveal");
    window.scrollTo(0, 0);
  };

  const regionLeader = (s: GameState) => isRegionLeader(standingsFor(s, rivals));
  const impact = useMemo(() => (state && state.metricHistory.length > 1 ? impactVsDoingNothing(state) : null), [state]);

  return (
    <>
      {screen === "landing" && <Landing onStart={() => setScreen("setup")} onHowItWorks={() => setHelp(true)} />}
      {screen === "setup" && <Setup onConfirm={start} onBack={() => setScreen("landing")} busy={busy} error={error} />}
      {screen === "briefing" && state && <CountryBriefing state={state} onBegin={() => setScreen("play")} />}
      {screen === "play" && state && (
        <Dashboard state={state} onHowItWorks={() => setHelp(true)} rivals={rivals} rivalsError={rivalsError} countries={countries ?? []} impact={impact}
          real={real} realPending={realPending} realError={realError} onRetryReal={() => loadReal(state, state.turn)}
          onBeginDecision={() => act(beginDecision)}
          onDecide={(id) => act((s) => applyDecision(s, id))}
          onReact={() => act((s) => worldReaction(s, { regionLeader: regionLeader(s) }))} onNext={() => act(nextTurn)} />
      )}
      {screen === "reveal" && state && (
        <Reveal state={state} rivals={rivals} realSoFar={real} onRestart={() => { setState(null); setScreen("setup"); }} onReplay={() => choice && start(choice)} />
      )}
      <HowItWorks open={help} onClose={() => setHelp(false)} />
    </>
  );
}
