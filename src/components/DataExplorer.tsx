"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { INDICATORS, INDICATOR_IDS, EDUCATION_CANDIDATES } from "@/lib/worldbank/indicators";
import { useCountries } from "./Setup";
import { ATTRIBUTION, Button, Panel } from "./ui";

type Verify = { requestUrl: string; country: string; indicator: string; metadata: { name: string; sourceOrganization: string } | null; start: number; end: number; count: number; missingYears: number[]; observations: { year: number; value: number; obsStatus: string | null }[] } | { error: string };
type Log = { requests: { url: string; at: string; fromCache: boolean; observations: number; ok: boolean; error?: string }[] };

const CODES = Array.from(new Set([...INDICATOR_IDS.filter((i) => i !== "education").map((i) => INDICATORS[i].code), ...EDUCATION_CANDIDATES.map((c) => c.code)]));

export default function DataExplorer() {
  const { countries } = useCountries();
  const [country, setCountry] = useState("VNM");
  const [indicator, setIndicator] = useState("SP.DYN.LE00.IN");
  const [start, setStart] = useState(1990);
  const [end, setEnd] = useState(2010);
  const [result, setResult] = useState<Verify | null>(null);
  const [log, setLog] = useState<Log | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    () =>
      fetch(`/api/verify?country=${country}&indicator=${indicator}&start=${start}&end=${end}`)
        .then((x) => x.json())
        .catch(() => ({ error: "Request failed" }))
        .then(async (r: Verify) => {
          setResult(r);
          setLog(await fetch("/api/requests").then((x) => x.json()).catch(() => null));
          setLoading(false);
        }),
    [country, indicator, start, end],
  );
  const run = () => {
    setLoading(true);
    load();
  };

  // Run one live request when the page opens.
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <Link href="/" className="text-sm text-muted hover:text-parchment">← Beat History</Link>
      <h1 className="mt-3 font-display text-4xl uppercase tracking-wide">Data source</h1>
      <p className="mt-2 text-parchment/80">Every historical value in the game is fetched programmatically from the <a className="text-brass underline" href="https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation" target="_blank" rel="noreferrer">World Bank Indicators API</a> (v2, JSON). Run a live request below.</p>
      <Panel className="mt-6" eyebrow="Live request" title="World Bank Indicators API">
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs text-muted">Country<select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-2 text-sm text-parchment">{(countries ?? [{ code: "VNM", name: "Viet Nam" }]).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}<option value="WLD">World (aggregate)</option></select></label>
          <label className="text-xs text-muted sm:col-span-2">Indicator<select value={indicator} onChange={(e) => setIndicator(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-2 text-sm text-parchment">{CODES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted">From<input type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-2 text-sm text-parchment" /></label>
            <label className="text-xs text-muted">To<input type="number" value={end} onChange={(e) => setEnd(Number(e.target.value))} className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-2 text-sm text-parchment" /></label>
          </div>
        </div>
        <Button className="mt-4" onClick={run} disabled={loading}>{loading ? "Requesting…" : "Run request"}</Button>
        {result && "error" in result && <p className="mt-4 text-bad">{result.error}</p>}
        {result && !("error" in result) && (
          <div className="mt-5 space-y-3 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div><dt className="text-xs uppercase tracking-wider text-muted">Indicator</dt><dd>{result.indicator} · {result.metadata?.name}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-muted">Requested period</dt><dd>{result.start} to {result.end}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-muted">Observations returned</dt><dd>{result.count}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-muted">Years without data</dt><dd>{result.missingYears.length ? result.missingYears.join(", ") : "None"}</dd></div>
            </dl>
            <p className="break-all rounded-md bg-ink p-3 font-mono text-xs text-sim">GET {result.requestUrl}</p>
            <div className="max-h-72 overflow-y-auto rounded-md border border-line">
              <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-panel-2 text-muted"><tr><th className="p-2">Year</th><th className="p-2">Value</th><th className="p-2">Status</th></tr></thead>
                <tbody>{result.observations.map((o) => <tr key={o.year} className="border-t border-line"><td className="p-2 font-mono">{o.year}</td><td className="p-2 font-mono">{o.value.toLocaleString("en-US", { maximumFractionDigits: 3 })}</td><td className="p-2">{o.obsStatus ?? ""}</td></tr>)}</tbody></table>
            </div>
          </div>
        )}
      </Panel>
      <Panel className="mt-6" eyebrow="This server" title="Recent API requests">
        <ul className="space-y-1 font-mono text-[11px]">
          {log?.requests.slice(0, 12).map((r, i) => <li key={i} className="break-all"><span className={r.ok ? "text-good" : "text-bad"}>{r.ok ? "OK" : "ERR"}</span> {r.fromCache ? "(cache)" : "(live)"} {r.observations} obs · {r.url}</li>)}
        </ul>
        <p className="mt-3 text-xs text-muted">Responses are cached on the server for 7 days so repeated games do not hammer the API.</p>
      </Panel>
      <p className="mt-6 text-xs text-muted">{ATTRIBUTION}</p>
    </main>
  );
}
