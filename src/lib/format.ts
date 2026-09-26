import { INDICATORS, type IndicatorId } from "./worldbank/indicators";

export function formatValue(id: IndicatorId, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "No data";
  const def = INDICATORS[id];
  if (id === "population") {
    if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
    if (value >= 1e6) return (value / 1e6).toFixed(1) + "M";
    return Math.round(value).toLocaleString("en-US");
  }
  if (id === "gdpPerCapita") return "$" + Math.round(value).toLocaleString("en-US");
  if (def.unit === "%" || def.unit === "% of GDP") return value.toFixed(def.decimals) + "%";
  if (id === "lifeExpectancy") return value.toFixed(1) + " yrs";
  if (id === "co2") return value.toFixed(2) + " t";
  return value.toFixed(def.decimals);
}

export function signed(value: number, decimals = 0): string {
  const rounded = Number(value.toFixed(decimals));
  return (rounded > 0 ? "+" : rounded < 0 ? "−" : "±") + Math.abs(rounded).toFixed(decimals);
}
