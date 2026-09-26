const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const number = value => value == null ? "Not reported" : Math.round(value).toLocaleString();
const money = value => value == null ? "Not reported" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
const decimal = value => value == null ? "Not reported" : value.toFixed(1);
const icon = name => '<i data-lucide="' + name + '"></i>';
const icons = () => window.lucide?.createIcons();
let assessment, selectedId, controller, map, schoolLayer, currentView = "overview";

function openView(view) {
  currentView = view;
  document.querySelectorAll(".view").forEach(section => section.hidden = section.id !== "view-" + view);
  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
    button.setAttribute("aria-pressed", String(button.dataset.view === view));
  });
  if (view === "overview") setTimeout(() => map?.invalidateSize(), 50);
}
document.querySelectorAll("[data-view], [data-open]").forEach(button =>
  button.addEventListener("click", () => openView(button.dataset.view || button.dataset.open))
);

async function api(path, signal) {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error("The data service could not finish this request. Please retry.");
  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result;
}

function resetRequest() {
  controller?.abort();
  controller = new AbortController();
  return controller;
}

$("#risk-form").addEventListener("submit", async event => {
  event.preventDefault();
  const request = resetRequest();
  const timeout = setTimeout(() => request.abort(), 20000);
  $("#location-choices").replaceChildren();
  $("#search-status").textContent = "Searching locations...";
  $("#loading").hidden = true;
  $("#dashboard").hidden = true;
  $("#error").hidden = true;
  $("#download").disabled = true;
  $("#refresh").disabled = true;
  try {
    const result = await api("/api/search?q=" + encodeURIComponent($("#location").value.trim()), request.signal);
    if (controller !== request) return;
    const places = (result.results || []).sort((a, b) =>
      Number(b.feature_code?.startsWith("PPL")) - Number(a.feature_code?.startsWith("PPL"))
    );
    if (!places.length) {
      $("#search-status").textContent = "No matches. Try adding a state or country.";
      return;
    }
    if (places.length === 1) {
      loadReport(places[0].id);
      return;
    }
    $("#search-status").textContent = "Choose the location you mean.";
    const label = document.createElement("label");
    label.textContent = "Matching locations";
    label.htmlFor = "matched-location";
    const select = document.createElement("select");
    select.id = "matched-location";
    select.add(new Option("Select a location", ""));
    for (const place of places) {
      select.add(new Option([...new Set([place.name, place.admin1, place.country].filter(Boolean))].join(", "), place.id));
    }
    select.addEventListener("change", () => {
      if (select.value) loadReport(select.value);
    });
    $("#location-choices").append(label, select);
    select.focus();
  } catch (error) {
    if (controller === request) $("#search-status").textContent = error.name === "AbortError" ? "Search timed out. Please retry." : error.message;
  } finally {
    clearTimeout(timeout);
  }
});

async function loadReport(id) {
  const request = resetRequest();
  const timeout = setTimeout(() => request.abort(), 240000);
  selectedId = id;
  assessment = null;
  $("#dashboard").hidden = true;
  $("#error").hidden = true;
  $("#loading").hidden = false;
  $("#download").disabled = true;
  $("#refresh").disabled = true;
  $("#search-status").textContent = "";
  $("#place-title").textContent = "Loading assessment";
  $("#place-subtitle").textContent = "NOAA · FEMA · NCES · Census · Open-Meteo";
  try {
    const data = await api("/api/report?id=" + encodeURIComponent(id), request.signal);
    if (controller !== request) return;
    assessment = data;
    render(data);
    const url = new URL(location.href);
    url.searchParams.set("location", id);
    history.replaceState(null, "", url);
    $("#download").disabled = false;
  } catch (error) {
    if (controller !== request) return;
    $("#place-title").textContent = "Assessment interrupted";
    $("#error").textContent = error.name === "AbortError"
      ? "This lookup took longer than expected. Retry with the refresh button."
      : error.message;
    $("#error").hidden = false;
  } finally {
    clearTimeout(timeout);
    if (controller === request) {
      $("#loading").hidden = true;
      $("#refresh").disabled = false;
    }
  }
}

function metric(label, value, note, symbol) {
  return '<article class="metric"><div class="metric-label">' + esc(label) + icon(symbol) +
    '</div><strong>' + esc(value) + '</strong><small>' + esc(note) + '</small></article>';
}
function coverage(result, fallback) {
  return '<p class="coverage-note">' + esc(result?.status === "error" ? "This source could not be reached. Reload to retry." : fallback) + '</p>';
}

function render(data) {
  const { location: place } = data;
  const county = data.county.data, tracks = data.tracks.data, people = data.community.data, schools = data.schools.data, events = data.events.data, climate = data.climate.data;
  $("#place-title").textContent = place.name;
  $("#location").value = [place.name, place.region, place.country].filter(Boolean).join(", ");
  $("#place-subtitle").textContent = [place.region, place.country].filter(Boolean).join(", ") + (county ? " · " + county.county + " County context" : "");
  $("#dashboard").hidden = false;
  const rating = county?.rating;
  const tone = rating?.includes("High") ? "" : rating ? " low" : " neutral";
  $("#risk-banner").innerHTML = '<div class="risk-banner' + tone + '"><div class="risk-banner-main"><span class="risk-symbol">' +
    icon(rating ? "shield-alert" : "globe-2") + '</span><div><h2>' +
    esc(rating ? "Hurricane risk: " + rating : "Global cyclone assessment") + '</h2><p>' +
    esc(rating ? county.county + " County · FEMA relative risk rating · archived February 2024 layer"
      : "Historical cyclone proximity and local climate projections") +
    '</p></div></div><a href="#sources" id="banner-source">View methods ↗</a></div>';
  $("#banner-source").addEventListener("click", event => { event.preventDefault(); openView("sources"); });
  const values = [];
  if (tracks) {
    values.push(metric("Years with nearby hurricane", decimal(tracks.annualObservedPercent) + "%", tracks.hurricaneYears.length + " of " + tracks.years + " years · historical, not a forecast", "calendar-days"));
    values.push(metric("Nearby hurricanes", number(tracks.hurricaneCount), "Recorded centers within 50 mi · " + tracks.startYear + "–" + tracks.endYear, "tornado"));
  }
  if (county?.buildingExposure != null) {
    values.push(metric("Exposed building value", money(county.buildingExposure), "County-wide FEMA hurricane exposure", "building-2"));
    values.push(metric("Expected annual building loss", money(county.annualBuildingLoss), "County-wide FEMA modeled loss", "chart-no-axes-combined"));
  } else if (people) {
    values.push(metric("County population", number(people.population), people.release.name + " · resident estimate", "users"));
    values.push(metric("Employed county residents", number(people.workforce), "Civilian workforce, age 16+", "briefcase-business"));
  } else if (tracks) {
    values.push(metric("Nearby tropical cyclones", number(tracks.cycloneCount), "Includes tropical storms and hurricanes", "wind"));
    values.push(metric("Complete years analyzed", number(tracks.years), "NOAA global archive · " + tracks.startYear + "–" + tracks.endYear, "database"));
  }
  $("#metrics").innerHTML = values.join("");
  $("#map-description").textContent = place.latitude.toFixed(3) + "°, " + place.longitude.toFixed(3) + "° · Recorded storm-center tracks";
  $("#storm-window").textContent = tracks ? "NOAA IBTrACS · " + tracks.startYear + "–" + tracks.endYear : "Source connection interrupted";
  $("#recent-storms").innerHTML = tracks ? (tracks.storms.length ? tracks.storms.slice(0, 5).map(storm =>
    '<article class="storm-row"><span class="storm-icon' + (storm.hurricane ? " hot" : "") + '">' + icon("tornado") +
    '</span><div><h3>' + esc(storm.name.toLowerCase()) + ' <span class="muted">' + storm.year + '</span></h3><p>' +
    (storm.hurricane ? "Hurricane" : "Tropical storm") + ' · ' + Math.round(storm.windKnots * 1.15078) +
    ' mph nearby</p></div><div class="storm-distance">' + (storm.distanceKm / 1.609344).toFixed(1) +
    ' mi<small>nearest point</small></div></article>').join("") : '<p class="coverage-note">No qualifying recorded tropical-storm or hurricane centers within 50 miles during this period. This does not rule out storm impacts.</p>')
    : coverage(data.tracks, "Cyclone archive could not be loaded.");
  renderChart(tracks);
  $("#community-panels").hidden = !county;
  $("#community-geography").textContent = county ? county.county + " County · " + (people?.release.name || "NCES public schools") : "";
  $("#schools-content").innerHTML = people || schools
    ? '<div class="community-stats"><div><strong>' + number(people?.students) + '</strong><span>Resident K–12 students (ACS)</span></div><div><strong>' +
      number(schools?.count) + '</strong><span>Public school locations (NCES)</span></div></div><p class="subline">' +
      (people ? number(people.population) + ' county residents · ACS ' + esc(people.release.years) : "") +
      (schools ? '<br>School year ' + esc(schools.year) : "") +
      '</p><p class="footnote">Resident enrollment includes public and private schools. School counts describe facilities in the county. Closure duration is not estimated.</p>'
    : coverage(data.community, "Community statistics are outside this source's coverage.");
  const top = people?.industries.slice(0, 4) || [];
  $("#workforce-content").innerHTML = top.length ? top.map(sector =>
    '<div class="sector"><div class="sector-top"><span>' + esc(sector.name) + '</span><strong>' + sector.share.toFixed(1) +
    '%</strong></div><div class="sector-bar"><b style="width:' + Math.min(100, sector.share).toFixed(2) +
    '%"></b></div></div>').join("") + '<p class="footnote">' + number(people.workforce) + ' employed residents. Industry shares measure economic concentration, not predicted job losses.</p>'
    : coverage(data.community, "Workforce statistics are not in this dataset's geographic coverage.");
  $("#damage-content").innerHTML = events
    ? '<div class="damage-value">' + money(events.reportedPropertyDamage) + '</div><p class="subline">Reported property damage across ' + events.count +
      ' hurricane, tropical-storm, and surge reports<br>2000–' + events.endYear + ' · County / forecast zones · nominal dollars</p>' +
      (events.largest ? '<div class="event-highlight"><strong>Largest reported local loss</strong><p>' +
      esc(events.largest.type) + ' · ' + esc(events.largest.date.split(" ")[0]) + '<br>' + esc(events.largest.zone) +
      ' · ' + money(events.largest.propertyDamage) + '</p><a href="' + eventUrl(events.largest.id) + '" target="_blank" rel="noreferrer">NOAA event record ↗</a></div>' : "") +
      '<p class="footnote">' + events.damageMissing + ' reports lack a damage value. Reported losses are incomplete and are not the total economic cost.</p>'
    : coverage(data.events, "NOAA Storm Events covers U.S. reporting areas. Global cyclone history is shown above.");
  $("#climate-content").innerHTML = climate
    ? '<div class="climate-grid">' + climatePeriod("2025–2034", climate.near) + climatePeriod("2040–2049", climate.mid) +
      '</div><p class="subline">Change in mean air temperature vs. 1995–2014<br>MRI-AGCM3-2-S · HighResMIP, forcing close to RCP8.5</p><p class="footnote">Single-model climate context. Temperature change is not a percentage increase in hurricane risk.</p>'
    : coverage(data.climate, "Climate projections could not be retrieved for this location.");
  $("#history-description").textContent = tracks ? "Recorded tropical centers within 50 miles · " + tracks.startYear + "–" + tracks.endYear : "The global archive could not be loaded.";
  $("#track-records").innerHTML = tracks?.storms.length ? tracks.storms.map(storm =>
    '<tr><td>' + esc(storm.name) + '</td><td>' + esc(storm.date) + '</td><td>' + (storm.distanceKm / 1.609344).toFixed(1) +
    ' mi</td><td>' + Math.round(storm.windKnots * 1.15078) + ' mph</td><td>' + (storm.hurricane ? "Hurricane" : "Tropical storm") + '</td></tr>').join("")
    : '<tr><td colspan="5">' + (tracks ? "No qualifying nearby centers in the observation period." : "Source connection interrupted.") + '</td></tr>';
  $("#event-records").innerHTML = events?.records.length ? events.records.map(event =>
    '<tr><td>' + esc(event.date.split(" ")[0]) + '</td><td>' + esc(event.type) + '</td><td>' + esc(event.zone) + '</td><td>' +
    money(event.propertyDamage) + '</td><td><a href="' + eventUrl(event.id) + '" target="_blank" rel="noreferrer">Event ' + esc(event.id) + ' ↗</a></td></tr>').join("")
    : '<tr><td colspan="5">' + (events ? "No matching NOAA reports in the period." : "NOAA local reports are not included for this location.") + '</td></tr>';
  renderSources(data);
  $("#report-time").textContent = "Assessment assembled " + new Date(data.generatedAt).toLocaleString();
  $("#search-status").textContent = Object.values(data).some(value => value?.status === "error")
    ? "Some sources did not respond. Available results are shown; reload to retry." : "";
  icons();
  renderMap(data);
  openView(currentView);
}
function eventUrl(id) {
  return "https://www.ncei.noaa.gov/access/storm-events-database/event-details/" + encodeURIComponent(id);
}
function climatePeriod(label, value) {
  return '<div class="climate-period">' + label + '<strong class="climate-change">' + (value >= 0 ? "+" : "") +
    value.toFixed(1) + '°C</strong><small>10-year mean change</small></div>';
}
function renderChart(tracks) {
  if (!tracks) { $("#annual-chart").textContent = "Historical source could not be loaded."; return; }
  const years = Array.from({ length: tracks.years }, (_, i) => tracks.startYear + i);
  const counts = years.map(year => tracks.storms.filter(storm => storm.year === year).length);
  const max = Math.max(...counts, 1);
  $("#annual-chart").innerHTML = years.map((year, i) => '<div class="chart-column' + (tracks.hurricaneYears.includes(year) ? " has-hurricane" : "") +
    '" title="' + year + ': ' + counts[i] + ' nearby cyclones" role="img" aria-label="' + year + ': ' + counts[i] +
    ' nearby cyclones"><div class="bar" style="height:' + Math.max(4, counts[i] / max * 100) + '%"></div></div>').join("");
  $("#chart-end").textContent = tracks.endYear;
}
function renderMap(data) {
  if (map) { map.remove(); map = null; }
  if (!window.L) { $("#map").textContent = "Map library did not load. Refresh to retry."; return; }
  const place = data.location;
  map = L.map("map", { scrollWheelZoom: false }).setView([place.latitude, place.longitude], 8);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(map);
  L.circle([place.latitude, place.longitude], { radius: 80467.2, color: "#466c60", weight: 1.5, dashArray: "5 6", fillColor: "#93b4a5", fillOpacity: .07 }).addTo(map);
  const wrap = lon => place.longitude + ((lon - place.longitude + 180) % 360 + 360) % 360 - 180;
  for (const storm of data.tracks.data?.storms || []) {
    if (!storm.track) continue;
    const line = L.polyline(storm.track.map(point => [point[0], wrap(point[1])]), { color: storm.hurricane ? "#bd6549" : "#4b8c82", weight: 2, opacity: .75 });
    line.bindTooltip(esc(storm.name + " · " + storm.year)).addTo(map);
  }
  L.circleMarker([place.latitude, place.longitude], { radius: 6, color: "white", weight: 2, fillColor: "#254f3e", fillOpacity: 1 }).bindTooltip(esc(place.name)).addTo(map);
  schoolLayer = L.layerGroup();
  for (const school of data.schools.data?.locations || []) {
    if (Number.isFinite(school.latitude) && Number.isFinite(school.longitude))
      L.circleMarker([school.latitude, school.longitude], { radius: 3, color: "#8260a4", weight: 1, fillOpacity: .85 }).bindTooltip(esc(school.name)).addTo(schoolLayer);
  }
  $("#show-schools").disabled = !data.schools.data;
  if ($("#show-schools").checked && data.schools.data) schoolLayer.addTo(map);
  setTimeout(() => map?.invalidateSize(), 100);
}
$("#show-schools").addEventListener("change", event => {
  if (!map || !schoolLayer) return;
  if (event.target.checked) schoolLayer.addTo(map);
  else map.removeLayer(schoolLayer);
});
function renderSources(data) {
  const sources = [
    ["tracks", "NOAA IBTrACS v04r01", "Worldwide cyclone center positions. USA one-minute winds and category classify nearby tropical storms and hurricanes. Complete years: " + (data.tracks.data ? "2000–" + data.tracks.data.endYear + ". Archive through " + data.tracks.data.archiveThrough + "." : "Source not loaded."), "https://www.ncei.noaa.gov/products/international-best-track-archive"],
    ["events", "NOAA NCEI Storm Events", "Required project dataset. Live county / forecast-zone reports of hurricanes, tropical storms, and storm surge since 2000. Event IDs are deduplicated; reports are not unique hurricanes.", "https://www.ncei.noaa.gov/access/storm-events-database/"],
    ["county", "FEMA National Risk Index · archived mirror", "County-level hurricane risk, exposed building value, and annual building loss. Public Tetra Tech ArcGIS mirror published February 2024; not the latest FEMA release. FEMA ratings are relative national rankings.", "https://www.arcgis.com/home/item.html?id=25fc50110e364ca0a6f7050766587e30"],
    ["schools", "NCES EDGE public school locations", "Public school facilities in the matched county. School year: " + (data.schools.data?.year || "see provider") + ". Locations are not a forecast of closures.", "https://services1.arcgis.com/Ua5sjt3LWTPigjyD/ArcGIS/rest/services/Public_School_Locations_Current/FeatureServer"],
    ["community", "Census ACS via Census Reporter", (data.community.data?.release.name || "ACS 5-year estimates") + ". County resident population, K–12 enrollment (B14001), and industry of employed residents (C24030). Survey estimates, not a business census.", data.community.data?.url || "https://censusreporter.org/"],
    ["climate", "Open-Meteo / HighResMIP", "Bias-corrected MRI-AGCM3-2-S daily temperatures. Decadal changes against 1995–2014. Free noncommercial API; model projections do not measure hurricane probability.", "https://open-meteo.com/en/docs/climate-api"]
  ];
  $("#sources-content").innerHTML = sources.map(([key, name, description, url]) => {
    const status = data[key].status;
    return '<article class="source-row"><div><h3>' + esc(name) + '</h3><p>' + esc(description) + '</p><a href="' + esc(url) +
      '" target="_blank" rel="noreferrer">View source ↗</a></div><span class="source-state' + (status === "ok" ? "" : " warning") + '">' +
      (status === "ok" ? "Connected" : status === "error" ? "Retry needed" : "Outside coverage") + '</span></article>';
  }).join("");
}
$("#refresh").addEventListener("click", () => { if (selectedId) loadReport(selectedId); });
$("#download").addEventListener("click", () => {
  if (!assessment) return;
  const exportData = { ...assessment, methodology: $("#view-sources").innerText };
  const url = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "coastwise-" + assessment.location.id + ".json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
icons();
if (location.protocol === "file:") {
  $("#error").hidden = false;
  $("#error").textContent = "Open http://localhost:5174 to connect to the data server.";
} else {
  loadReport(new URLSearchParams(location.search).get("location") || "4499379");
}
