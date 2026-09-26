import { getIndicator, getIndicatorMetadata, indicatorUrl } from "@/lib/worldbank/client";

// Live demonstration of a single World Bank Indicators API request, for the data transparency page.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const country = (params.get("country") ?? "VNM").toUpperCase();
  const indicator = params.get("indicator") ?? "SP.DYN.LE00.IN";
  const start = Number(params.get("start") ?? 1990);
  const end = Number(params.get("end") ?? 2010);
  if (!/^[A-Z]{3}$/.test(country) || !/^[A-Z0-9.]+$/i.test(indicator) || !(start >= 1960 && end <= 2030 && start <= end)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const [observations, metadata] = await Promise.all([getIndicator(country, indicator, start, end), getIndicatorMetadata(indicator).catch(() => null)]);
    const years = new Set(observations.map((o) => o.year));
    const missingYears = Array.from({ length: end - start + 1 }, (_, i) => start + i).filter((y) => !years.has(y));
    return Response.json({ requestUrl: indicatorUrl(country, [indicator], start, end), country, indicator, metadata, start, end, count: observations.length, missingYears, observations: observations.sort((a, b) => a.year - b.year) });
  } catch (error) {
    return Response.json({ error: "The World Bank API request failed. Please retry.", detail: String(error) }, { status: 502 });
  }
}
