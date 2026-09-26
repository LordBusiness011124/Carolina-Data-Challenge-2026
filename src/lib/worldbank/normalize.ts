import { z } from "zod";

// The World Bank v2 API returns [pageMeta, rows] on success and [{ message: [...] }] on error.
export const PageMetaSchema = z.object({
  page: z.coerce.number(),
  pages: z.coerce.number(),
  per_page: z.coerce.number(),
  total: z.coerce.number(),
  lastupdated: z.string().nullish(),
});

export const RowSchema = z.object({
  indicator: z.object({ id: z.string(), value: z.string() }),
  country: z.object({ id: z.string(), value: z.string() }),
  countryiso3code: z.string().nullish(),
  date: z.string(),
  value: z.number().nullable(),
  obs_status: z.string().nullish(),
});

export const ErrorSchema = z.tuple([z.object({ message: z.array(z.object({ id: z.string(), key: z.string(), value: z.string() })) })]);

export interface Observation {
  countryCode: string;
  countryName: string;
  indicator: string;
  indicatorName: string;
  year: number;
  value: number;
  source: "World Bank";
  /** World Bank observation status flag, when provided (for example "E" for estimate). */
  obsStatus: string | null;
}

export interface ParsedPage {
  meta: z.infer<typeof PageMetaSchema>;
  observations: Observation[];
  /** Rows the API returned with a null value. These are dropped, never treated as zero. */
  nullRows: number;
}

export class WorldBankError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
    this.name = "WorldBankError";
  }
}

/** Validate and normalize one page of a World Bank indicator response. */
export function parsePage(json: unknown): ParsedPage {
  const error = ErrorSchema.safeParse(json);
  if (error.success) {
    const message = error.data[0].message.map((m) => m.value).join("; ");
    throw new WorldBankError("World Bank API returned an error", message);
  }
  if (!Array.isArray(json) || json.length < 1) throw new WorldBankError("Unexpected World Bank response shape");
  const meta = PageMetaSchema.parse(json[0]);
  const rows = json.length > 1 && Array.isArray(json[1]) ? z.array(RowSchema).parse(json[1]) : [];
  const observations: Observation[] = [];
  let nullRows = 0;
  for (const row of rows) {
    const year = Number(row.date);
    if (row.value === null || !Number.isFinite(row.value) || !Number.isInteger(year)) {
      nullRows++;
      continue;
    }
    observations.push({
      countryCode: row.countryiso3code || row.country.id,
      countryName: row.country.value,
      indicator: row.indicator.id,
      indicatorName: row.indicator.value,
      year,
      value: row.value,
      source: "World Bank",
      obsStatus: row.obs_status ? row.obs_status : null,
    });
  }
  return { meta, observations, nullRows };
}

/** Series keyed by indicator code, each sorted by year. */
export type SeriesMap = Record<string, { year: number; value: number; obsStatus: string | null }[]>;

export function toSeries(observations: Observation[]): SeriesMap {
  const series: SeriesMap = {};
  for (const o of observations) (series[o.indicator] ??= []).push({ year: o.year, value: o.value, obsStatus: o.obsStatus });
  for (const code of Object.keys(series)) series[code].sort((a, b) => a.year - b.year);
  return series;
}
