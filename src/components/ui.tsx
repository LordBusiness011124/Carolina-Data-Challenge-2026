"use client";
import { useEffect, useState, type ReactNode } from "react";
import { formatValue } from "@/lib/format";
import { INDICATORS, type IndicatorId } from "@/lib/worldbank/indicators";
import type { ResolvedValue } from "@/lib/worldbank/observations";

export function Button({ children, onClick, variant = "primary", disabled, className = "", type = "button" }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "outline"; disabled?: boolean; className?: string; type?: "button" | "submit" }) {
  const styles = {
    primary: "bg-brass text-ink hover:bg-[#e6bd62] font-semibold",
    outline: "border border-brass/60 text-brass hover:bg-brass/10",
    ghost: "text-muted hover:text-parchment hover:bg-white/5",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm tracking-wide transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}>
      {children}
    </button>
  );
}

export function Panel({ children, className = "", title, eyebrow, right }: { children: ReactNode; className?: string; title?: string; eyebrow?: string; right?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-line bg-panel/90 p-5 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.8)] ${className}`}>
      {(title || eyebrow) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass/80">{eyebrow}</p>}
            {title && <h2 className="font-display text-lg uppercase tracking-wide text-parchment">{title}</h2>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-rise my-8 w-full max-w-3xl rounded-xl border border-line bg-panel p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase tracking-wide">{title}</h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-muted hover:bg-white/5 hover:text-parchment" aria-label="Close">✕</button>
        </div>
        <div className="space-y-3 text-sm leading-relaxed text-parchment/85">{children}</div>
      </div>
    </div>
  );
}

/** A statistic card. Real values can be inspected for their World Bank code and observation year. */
export function StatCard({ id, value, real, simulated, previous }: { id: IndicatorId; value: number | undefined; real?: ResolvedValue; simulated?: boolean; previous?: number }) {
  const [open, setOpen] = useState(false);
  const def = INDICATORS[id];
  const delta = previous !== undefined && value !== undefined ? value - previous : null;
  const good = delta === null || def.higherIsBetter === null ? null : (delta > 0) === def.higherIsBetter;
  const moved = delta !== null && Math.abs(delta) > Math.abs(previous ?? 1) * 0.002;
  return (
    <button onClick={() => setOpen((o) => !o)} className="group w-full rounded-lg border border-line bg-panel-2/70 p-3 text-left transition hover:border-brass/50" aria-expanded={open}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted">{def.shortName}</span>
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${simulated ? "bg-sim/15 text-sim" : "bg-hist/15 text-hist"}`}>{simulated ? "Simulated" : "World Bank"}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-2xl tracking-wide text-parchment">{formatValue(id, value)}</span>
        {moved && delta !== null && <span className={`text-xs ${good === null ? "text-muted" : good ? "text-good" : "text-bad"}`}>{delta > 0 ? "▲" : "▼"}</span>}
      </div>
      {open && (
        <div className="mt-2 space-y-0.5 border-t border-line pt-2 font-mono text-[10px] leading-relaxed text-muted">
          <p>{def.name}</p>
          <p>Code: {real?.code ?? def.code}</p>
          {simulated ? (
            <p className="text-sim">Simulated by the game model. Not a World Bank observation.</p>
          ) : real ? (
            <>
              <p>Requested year: {real.requestedYear} · Observation year: {real.observationYear}</p>
              {real.isEstimated && <p className="text-hist">Nearest real observation used ({Math.abs(real.observationYear - real.requestedYear)} yr away).</p>}
              <p>Source: World Bank Indicators API</p>
            </>
          ) : (
            <p>No World Bank observation available.</p>
          )}
        </div>
      )}
    </button>
  );
}

export function Meter({ label, value, color, hint }: { label: string; value: number; color: string; hint?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="min-w-0" title={hint}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-parchment">{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v}%`, background: color }} />
      </div>
    </div>
  );
}

export const ATTRIBUTION = "Historical development data provided by the World Bank Indicators API.";
