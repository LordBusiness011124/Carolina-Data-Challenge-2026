import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parsePage, WorldBankError, type Observation } from "./normalize";

// World Bank Indicators API v2. No key required.
// Docs: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation
export const API_BASE = "https://api.worldbank.org/v2";
const PER_PAGE = 1000;
const TIMEOUT_MS = 25_000;
const RETRIES = 3;
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
const CACHE_DIR = path.join(process.cwd(), ".cache", "worldbank");

const memory = new Map<string, { at: number; value: unknown }>();

export interface RequestLogEntry {
  url: string;
  at: string;
  fromCache: boolean;
  observations: number;
  nullRows: number;
  pages: number;
  ok: boolean;
  error?: string;
}
const requestLog: RequestLogEntry[] = [];
export function recentRequests(): RequestLogEntry[] {
  return requestLog.slice(-50).reverse();
}
function log(entry: RequestLogEntry) {
  requestLog.push(entry);
  if (requestLog.length > 200) requestLog.shift();
}

async function cacheRead(key: string): Promise<unknown | undefined> {
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  try {
    const raw = JSON.parse(await readFile(path.join(CACHE_DIR, key + ".json"), "utf8"));
    if (Date.now() - raw.at < CACHE_TTL_MS) {
      memory.set(key, raw);
      return raw.value;
    }
  } catch {
    // Cache miss.
  }
  return undefined;
}
async function cacheWrite(key: string, value: unknown) {
  const entry = { at: Date.now(), value };
  memory.set(key, entry);
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path.join(CACHE_DIR, key + ".json"), JSON.stringify(entry));
  } catch {
    // A read-only file system still has the in-memory cache.
  }
}

async function fetchJson(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new WorldBankError(`World Bank API HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (error instanceof WorldBankError && !/HTTP 5\d\d/.test(error.message)) throw error;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new WorldBankError("World Bank API did not respond", String(lastError));
}

/** Build an indicator URL. Several codes from one source are batched with ";" (requires source=2 for WDI). */
export function indicatorUrl(country: string, codes: string[], start: number, end: number, page = 1): string {
  const params = new URLSearchParams({ format: "json", date: `${start}:${end}`, per_page: String(PER_PAGE), page: String(page) });
  if (codes.length > 1) params.set("source", "2");
  return `${API_BASE}/country/${country.split(";").map(encodeURIComponent).join(";")}/indicator/${codes.map(encodeURIComponent).join(";")}?${params}`;
}

/** Fetch every page of an indicator request, normalized, validated and cached. */
export async function getIndicators(country: string, codes: string[], start: number, end: number): Promise<Observation[]> {
  const first = indicatorUrl(country, codes, start, end, 1);
  const key = createHash("sha1").update(first).digest("hex");
  const cached = (await cacheRead(key)) as Observation[] | undefined;
  if (cached) {
    log({ url: first, at: new Date().toISOString(), fromCache: true, observations: cached.length, nullRows: 0, pages: 0, ok: true });
    return cached;
  }
  try {
    const page1 = parsePage(await fetchJson(first));
    const observations = [...page1.observations];
    let nullRows = page1.nullRows;
    for (let page = 2; page <= page1.meta.pages; page++) {
      const next = parsePage(await fetchJson(indicatorUrl(country, codes, start, end, page)));
      observations.push(...next.observations);
      nullRows += next.nullRows;
    }
    await cacheWrite(key, observations);
    log({ url: first, at: new Date().toISOString(), fromCache: false, observations: observations.length, nullRows, pages: page1.meta.pages, ok: true });
    return observations;
  } catch (error) {
    log({ url: first, at: new Date().toISOString(), fromCache: false, observations: 0, nullRows: 0, pages: 0, ok: false, error: String(error) });
    throw error;
  }
}

export async function getIndicator(country: string, code: string, start: number, end: number) {
  return getIndicators(country, [code], start, end);
}

/** Countries (aggregates such as regions are excluded). */
export interface WorldBankCountry {
  code: string;
  name: string;
  regionCode: string;
  regionName: string;
  incomeLevel: string;
  capital: string;
  latitude: number | null;
  longitude: number | null;
}

export async function getCountries(): Promise<WorldBankCountry[]> {
  const url = `${API_BASE}/country?format=json&per_page=400`;
  const key = createHash("sha1").update(url).digest("hex");
  const cached = await cacheRead(key);
  if (cached) return cached as never;
  type Row = { id: string; name: string; region: { id: string; value: string }; incomeLevel: { value: string }; capitalCity: string; latitude: string; longitude: string };
  const json = (await fetchJson(url)) as [unknown, Row[]];
  const num = (v: string) => (v && Number.isFinite(Number(v)) ? Number(v) : null);
  // Aggregates (regions, income groups) have region id "NA" and are not countries.
  const countries: WorldBankCountry[] = (json[1] ?? [])
    .filter((c) => c.region?.id && c.region.id !== "NA")
    .map((c) => ({ code: c.id, name: c.name, regionCode: c.region.id, regionName: c.region.value.trim(), incomeLevel: c.incomeLevel?.value ?? "", capital: c.capitalCity ?? "", latitude: num(c.latitude), longitude: num(c.longitude) }));
  await cacheWrite(key, countries);
  log({ url, at: new Date().toISOString(), fromCache: false, observations: countries.length, nullRows: 0, pages: 1, ok: true });
  return countries;
}

export async function getIndicatorMetadata(code: string): Promise<{ id: string; name: string; sourceNote: string; sourceOrganization: string } | null> {
  const url = `${API_BASE}/indicator/${encodeURIComponent(code)}?format=json`;
  const key = createHash("sha1").update(url).digest("hex");
  const cached = await cacheRead(key);
  if (cached) return cached as never;
  const json = (await fetchJson(url)) as [unknown, { id: string; name: string; sourceNote: string; sourceOrganization: string }[]];
  const meta = json?.[1]?.[0] ? { id: json[1][0].id, name: json[1][0].name, sourceNote: json[1][0].sourceNote, sourceOrganization: json[1][0].sourceOrganization } : null;
  await cacheWrite(key, meta);
  return meta;
}
