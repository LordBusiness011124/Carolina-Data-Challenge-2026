"use client";
import { useMemo, useState } from "react";
import { geoArea, geoCentroid, geoDistance, geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import isoCountries from "i18n-iso-countries";
import atlas from "world-atlas/countries-110m.json";
import type { CountryConfig } from "@/lib/worldbank/package";

// Natural Earth shapes (world-atlas, public domain) keyed by ISO 3166 alpha-3, matching World Bank codes.
const NAME_OVERRIDES: Record<string, string> = { Kosovo: "XKX", Somaliland: "SOM", "N. Cyprus": "CYP" };
type Shape = Feature<Geometry, { name: string; code: string }>;
const topology = atlas as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const SHAPES: Shape[] = (feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name: string }>).features
  .map((f) => ({ ...f, properties: { name: f.properties.name, code: NAME_OVERRIDES[f.properties.name] ?? isoCountries.numericToAlpha3(String(f.id ?? "")) ?? "" } }))
  .filter((f) => f.properties.code && f.properties.code !== "ATA");
const SHAPE_CODES = new Set(SHAPES.map((s) => s.properties.code));

export function WorldMap({ countries, fill, selected, onSelect, focus, height = 420, dim = false, labelFor }: {
  countries: CountryConfig[];
  fill: (code: string) => string;
  selected?: string | null;
  onSelect?: (code: string) => void;
  /** Country codes to zoom to (for a regional board). */
  focus?: string[];
  height?: number;
  dim?: boolean;
  labelFor?: (code: string) => string | undefined;
}) {
  const width = 960;
  const [hover, setHover] = useState<string | null>(null);
  const known = useMemo(() => new Map(countries.map((c) => [c.code, c])), [countries]);
  const { path, projection } = useMemo(() => {
    const projection = geoNaturalEarth1();
    const targets = focus?.length ? SHAPES.filter((s) => focus.includes(s.properties.code)) : SHAPES;
    // Zoom to the region's larger countries (and the selected one) so scattered small islands,
    // some of which cross the date line, do not shrink the board.
    const home = targets.find((s) => s.properties.code === selected);
    const fitTo = !focus?.length
      ? targets
      : home
        ? // A local board: the player's country and its 12 nearest neighbors in the region.
          [...targets].sort((a, b) => geoDistance(geoCentroid(a), geoCentroid(home)) - geoDistance(geoCentroid(b), geoCentroid(home))).slice(0, 13)
        : [...targets].sort((a, b) => geoArea(b) - geoArea(a)).slice(0, 10);
    projection.fitExtent([[12, 12], [width - 12, height - 12]], { type: "FeatureCollection", features: fitTo.length ? fitTo : SHAPES } as FeatureCollection);
    return { path: geoPath(projection), projection };
  }, [focus, height, selected]);
  const markers = countries.filter((c) => !SHAPE_CODES.has(c.code) && c.latitude !== null && c.longitude !== null && (!focus?.length || focus.includes(c.code)));
  const hovered = hover ? known.get(hover) : undefined;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full select-none" role="img" aria-label="World map of countries">
        <defs>
          <pattern id="sea" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 7h14" stroke="rgba(212,168,75,0.05)" strokeWidth="1" /></pattern>
        </defs>
        <rect width={width} height={height} fill="url(#sea)" />
        {SHAPES.map((s) => {
          const code = s.properties.code;
          const playable = known.has(code);
          const isSelected = selected === code;
          return (
            <path
              key={code + s.properties.name}
              d={path(s) ?? ""}
              fill={playable ? fill(code) : "#1a212b"}
              stroke={isSelected ? "#f3d27a" : hover === code ? "#d4a84b" : "#0b0f14"}
              strokeWidth={isSelected ? 2 : 0.6}
              opacity={dim && !isSelected && !(focus ?? []).includes(code) ? 0.35 : 1}
              className={playable && onSelect ? "cursor-pointer transition-[fill] duration-300" : "transition-[fill] duration-300"}
              onMouseEnter={() => playable && setHover(code)}
              onMouseLeave={() => setHover(null)}
              onClick={() => playable && onSelect?.(code)}
            >
              <title>{known.get(code)?.name ?? s.properties.name}</title>
            </path>
          );
        })}
        {markers.map((c) => {
          const point = projection([c.longitude!, c.latitude!]);
          if (!point) return null;
          return (
            <circle key={c.code} cx={point[0]} cy={point[1]} r={selected === c.code ? 5 : 3} fill={fill(c.code)} stroke={selected === c.code ? "#f3d27a" : "#0b0f14"} strokeWidth={1}
              className={onSelect ? "cursor-pointer" : ""} onMouseEnter={() => setHover(c.code)} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(c.code)}>
              <title>{c.name}</title>
            </circle>
          );
        })}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-line bg-ink/90 px-3 py-1.5 text-xs">
          <span className="font-display text-sm uppercase tracking-wide">{hovered.name}</span>
          <span className="ml-2 text-muted">{labelFor?.(hovered.code) ?? hovered.regionName}</span>
        </div>
      )}
    </div>
  );
}
