"use client";
import { formatValue } from "@/lib/format";
import { chapterFor, type Chapter, type RealHistory } from "@/lib/game/story";
import type { GameState } from "@/lib/game/types";
import { INDICATORS } from "@/lib/worldbank/indicators";

export function ChapterView({ chapter, realPending, realError, onRetryReal }: { chapter: Chapter; realPending: boolean; realError: string | null; onRetryReal?: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-sim/40 bg-sim/[0.06] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sim">Your story · simulated</p>
          <p className="mt-2 text-sm leading-relaxed text-parchment/90">{chapter.decision}</p>
          <p className="mt-2 text-sm leading-relaxed text-parchment/80">{chapter.world}</p>
          {chapter.yourResults && <p className="mt-2 text-sm leading-relaxed text-parchment/90">{chapter.yourResults}</p>}
        </section>
        <section className="rounded-lg border border-hist/40 bg-hist/[0.06] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-hist">What actually happened · World Bank data</p>
          {chapter.real ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-parchment/90">{chapter.real}</p>
              {chapter.verdict && <p className="mt-3 border-t border-hist/20 pt-3 text-sm font-medium text-hist">{chapter.verdict}</p>}
            </>
          ) : realError ? (
            <div className="mt-2 text-sm"><p className="text-bad">{realError}</p>{onRetryReal && <button onClick={onRetryReal} className="mt-2 text-xs text-brass underline">Retry</button>}</div>
          ) : realPending ? (
            <p className="mt-2 animate-pulse text-sm text-muted">Opening the archives for {chapter.fromYear}–{chapter.toYear}…</p>
          ) : (
            <p className="mt-2 text-sm text-muted">The World Bank has no data for these years.</p>
          )}
        </section>
      </div>
      <section className="rounded-lg border border-mech/30 bg-mech/[0.05] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mech">Political news · fictional storyline</p>
        <p className="mt-1 font-display text-lg uppercase tracking-wide">{chapter.politics.headline}</p>
        <p className="text-sm text-parchment/85">{chapter.politics.story}</p>
      </section>
      {chapter.comparison.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {chapter.comparison.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md bg-panel-2/70 px-3 py-2 text-xs">
              <span className="text-muted">{INDICATORS[c.id].shortName}</span>
              <span className="font-mono"><span className="text-sim">{formatValue(c.id, c.you)}</span> vs <span className="text-hist">{formatValue(c.id, c.real)}</span> <span className={c.ahead ? "text-good" : "text-bad"}>{c.ahead ? "▲" : "▼"}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Chronicle({ state, real }: { state: GameState; real: RealHistory | null }) {
  const chapters = state.decisionHistory.map((d) => chapterFor(state, d.turn, real)).filter((c): c is Chapter => !!c);
  if (!chapters.length) return <p className="text-sm text-muted">Your story will be written here, one chapter per turn.</p>;
  return (
    <ol className="space-y-2">
      {chapters.slice().reverse().map((c, i) => (
        <li key={c.turn}>
          <details open={i === 0} className="group rounded-lg border border-line bg-panel-2/50 p-3">
            <summary className="cursor-pointer list-none font-display text-base uppercase tracking-wide text-parchment group-open:text-brass">{c.title}</summary>
            <div className="mt-2 space-y-1.5 text-sm leading-relaxed">
              <p className="text-parchment/85">{c.decision}</p>
              <p className="text-parchment/70">{c.world}</p>
              <p className="text-mech/90"><b>{c.politics.headline}.</b> {c.politics.story}</p>
              {c.yourResults && <p className="text-sim/90">{c.yourResults}</p>}
              {c.real && <p className="text-hist/90">{c.real}</p>}
              {c.verdict && <p className="font-medium text-parchment">{c.verdict}</p>}
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}
