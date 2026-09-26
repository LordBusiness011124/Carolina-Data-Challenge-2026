# Coastwise · Hurricane Risk Explorer

A location-based hurricane assessment for Carolina Data Challenge 2026. Search a city or postal code worldwide to retrieve real storm history, then explore local exposure, school and workforce context where the sources cover that location.

## Run

Requires Node.js/npm and Python 3.10 or newer.

```sh
npm install
npm start
```

Open http://localhost:5174. Use `PORT=5175 npm start` if that port is occupied. The app needs its Python data server; opening index.html directly or using the old static server on port 5173 will not connect the data.

No API keys are required. The first lookup downloads NOAA's approximately 144 MB global cyclone CSV and builds a local SQLite index. Later lookups query that index. Keep internet access enabled for the other public providers and map tiles.

## Sources

| Data | Provider | Geography |
| --- | --- | --- |
| Storm event reports and reported property damage | [NOAA NCEI Storm Events](https://www.ncei.noaa.gov/access/storm-events-database/) | U.S. counties and associated forecast zones |
| Historical cyclone positions and winds | [NOAA IBTrACS v04r01](https://www.ncei.noaa.gov/products/international-best-track-archive) | Worldwide |
| Hurricane rating, building exposure, annual building loss | [FEMA NRI, archived Tetra Tech mirror](https://www.arcgis.com/home/item.html?id=25fc50110e364ca0a6f7050766587e30) | U.S. counties; mirror published February 2024 |
| Public-school locations | [NCES EDGE](https://services1.arcgis.com/Ua5sjt3LWTPigjyD/ArcGIS/rest/services/Public_School_Locations_Current/FeatureServer) | U.S. county coverage |
| Population, resident K–12 enrollment, industry employment | [Census ACS via Census Reporter](https://censusreporter.org/) | U.S. county coverage |
| Modeled temperature change | [Open-Meteo climate API](https://open-meteo.com/en/docs/climate-api) | Worldwide |
| Place lookup | [Open-Meteo / GeoNames](https://open-meteo.com/en/docs/geocoding-api) | Worldwide cities and postal codes |
| Map tiles | [OpenStreetMap](https://www.openstreetmap.org/copyright) | Worldwide |

The NOAA Storm Events dataset is queried directly, not represented by seed data. Its county query includes associated forecast zones. The frontend presents it separately from the 50-mile IBTrACS calculation.

## Methods and limits

- Distinct IBTrACS storm IDs with a qualifying recorded tropical center within 50 miles are counted. Tropical storms require USA wind at least 34 knots and a nonnegative USA category; hurricanes require at least 64 knots and category 1 or above. Missing wind/category observations and extratropical stages are excluded. Discrete observations can miss a passage between timestamps.
- Observed annual occurrence is years with at least one qualifying hurricane divided by complete years from 2000 through the last complete archive year. It is not a future probability forecast.
- FEMA exposure and expected annual loss are county-level model outputs, not predicted damage to the selected city. The mirrored dataset is archived, not the latest release.
- NOAA event IDs are deduplicated. Different zone reports are retained and must not be counted as separate hurricanes. Dollar totals use only known reported property damage, in nominal dollars; omitted losses and broader economic costs are not estimated.
- ACS K–12 counts describe resident students in public and private schools. NCES counts describe public-school facilities; these are different populations. Industry shares combine male/female ACS counts in disjoint top-level categories. ACS estimates have sampling uncertainty.
- Climate values compare MRI-AGCM3-2-S means for 2025–2034 and 2040–2049 with 1995–2014. This single HighResMIP model uses forcing close to RCP8.5. Temperature change is not a projected increase in hurricane probability.
- School closure duration, recovery time, and unemployment spikes require event-specific evidence. They are not fabricated or displayed as empty placeholder metrics.
- Outside U.S. county coverage, the app shows global storm and climate results, with explicit source coverage notes. It does not extrapolate U.S. school or workforce data internationally.

## Verification

```sh
npm test
```

Unit tests cover damage parsing, distinct storm/year counts, geographic filtering, the date line, missing data, ACS aggregation, and partial provider failures. Browser checks cover location selection, map rendering, desktop/mobile layouts, and source navigation.

The Python server binds to localhost and serves only allowlisted application assets and fixed provider routes. Responses are cached for up to 24 hours, or seven days for climate and the cyclone archive. Cache files, test screenshots, and local captures are gitignored.

Provider terms and rate limits still apply. Open-Meteo's free endpoint is intended for noncommercial use. For a public deployment, add shared caching, request limits, and a scheduled archive refresh.
