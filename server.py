"""Local data gateway. Public providers are fixed; no arbitrary URL proxying."""
import csv
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlencode, urlparse, parse_qs
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".cache"
CACHE.mkdir(exist_ok=True)
NOAA = "https://www.ncei.noaa.gov/access/storm-events-database"
TRACK_URL = "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.since1980.list.v04r01.csv"
NRI = "https://services.arcgis.com/HdtZMT2FmI4wPzTM/ArcGIS/rest/services/FEMA_National_Risk_Index/FeatureServer/0"
SCHOOLS = "https://services1.arcgis.com/Ua5sjt3LWTPigjyD/ArcGIS/rest/services/Public_School_Locations_Current/FeatureServer/0"
HEADERS = {"User-Agent": "HurricaneRiskExplorer/0.2 (public data research)", "Accept": "application/json"}
TRACK_LOCK = threading.Lock()
RADIUS_KM = 80.4672


def get_json(url, payload=None, ttl=86400):
    key = hashlib.sha256((url + json.dumps(payload, sort_keys=True)).encode()).hexdigest()
    path = CACHE / (key + ".json")
    if path.exists() and time.time() - path.stat().st_mtime < ttl:
        return json.loads(path.read_text())
    body = None if payload is None else json.dumps(payload).encode()
    request = Request(url, data=body, headers={**HEADERS, "Content-Type": "application/json"})
    with urlopen(request, timeout=45) as response:
        value = json.load(response)
    if isinstance(value, dict) and value.get("error"):
        raise ValueError("Provider returned an error")
    temporary = path.with_suffix(f".{threading.get_ident()}.tmp")
    temporary.write_text(json.dumps(value))
    temporary.replace(path)
    return value


def arcgis(url, **params):
    return get_json(url + "/query?" + urlencode({"f": "json", "returnGeometry": "false", **params}))


def finite(value):
    try:
        number = float(value)
        return number if math.isfinite(number) and number > -999 else None
    except (ValueError, TypeError):
        return None


def nonnegative(value):
    value = finite(value)
    return value if value is not None and value >= 0 else None


def distance_km(lat1, lon1, lat2, lon2):
    a, b = math.radians(lat1), math.radians(lat2)
    h = math.sin((b-a)/2)**2 + math.cos(a)*math.cos(b)*math.sin(math.radians(lon2-lon1)/2)**2
    return 6371.0088 * 2 * math.asin(min(1, math.sqrt(h)))


def ensure_tracks():
    database = CACHE / "tracks-v1.sqlite"
    with TRACK_LOCK:
        if database.exists() and time.time() - database.stat().st_mtime < 7 * 86400:
            return database
        archive = CACHE / "ibtracs.csv"
        if not archive.exists() or time.time() - archive.stat().st_mtime > 7 * 86400:
            temporary = CACHE / "ibtracs.download"
            with urlopen(Request(TRACK_URL, headers=HEADERS), timeout=180) as response, temporary.open("wb") as out:
                while chunk := response.read(1024 * 1024):
                    out.write(chunk)
            temporary.replace(archive)
        temporary_db = CACHE / "tracks-building.sqlite"
        temporary_db.unlink(missing_ok=True)
        connection = sqlite3.connect(temporary_db)
        try:
            connection.execute("CREATE TABLE points (sid TEXT, name TEXT, year INTEGER, time TEXT, lat REAL, lon REAL, wind REAL, category INTEGER)")
            latest = ""
            batch = []
            with archive.open(newline="") as source:
                for row in csv.DictReader(source):
                    timestamp = row["ISO_TIME"].strip()
                    if not timestamp[:4].isdigit() or int(timestamp[:4]) < 2000:
                        continue
                    latest = max(latest, timestamp)
                    lat, lon = finite(row["LAT"]), finite(row["LON"])
                    if lat is None or lon is None:
                        continue
                    batch.append((row["SID"].strip(), row["NAME"].strip(), int(timestamp[:4]), timestamp,
                                  lat, lon, nonnegative(row["USA_WIND"]), finite(row["USA_SSHS"])))
                    if len(batch) >= 5000:
                        connection.executemany("INSERT INTO points VALUES (?,?,?,?,?,?,?,?)", batch)
                        batch.clear()
            connection.executemany("INSERT INTO points VALUES (?,?,?,?,?,?,?,?)", batch)
            if not latest:
                raise ValueError("Empty cyclone archive")
            connection.execute("CREATE INDEX position ON points(lat, lon)")
            connection.execute("CREATE INDEX storm ON points(sid, time)")
            connection.execute("CREATE TABLE metadata (latest TEXT, retrieved TEXT)")
            connection.execute("INSERT INTO metadata VALUES (?,?)", (latest, dt.datetime.now(dt.timezone.utc).isoformat()))
            connection.commit()
        finally:
            connection.close()
        temporary_db.replace(database)
    return database


def summarize_tracks(rows, lat, lon, end_year):
    storms = {}
    for sid, name, year, timestamp, plat, plon, wind, category in rows:
        if year > end_year or wind is None or wind < 34 or category is None or category < 0:
            continue
        distance = distance_km(lat, lon, plat, plon)
        if distance > RADIUS_KM:
            continue
        entry = storms.setdefault(sid, {"id": sid, "name": name, "year": year, "date": timestamp[:10],
            "distanceKm": distance, "windKnots": wind, "hurricane": False, "hurricaneYears": []})
        entry["distanceKm"] = min(entry["distanceKm"], distance)
        entry["windKnots"] = max(entry["windKnots"], wind)
        if timestamp[:10] < entry["date"]:
            entry["date"], entry["year"] = timestamp[:10], year
        if wind >= 64 and category >= 1:
            entry["hurricane"] = True
            if year not in entry["hurricaneYears"]:
                entry["hurricaneYears"].append(year)
    values = sorted(storms.values(), key=lambda value: value["date"], reverse=True)
    hurricane_years = sorted({y for storm in values for y in storm["hurricaneYears"]})
    years = end_year - 2000 + 1
    return {"storms": values, "hurricaneCount": sum(s["hurricane"] for s in values),
            "cycloneCount": len(values), "annualObservedPercent": 100 * len(hurricane_years) / years,
            "hurricaneYears": hurricane_years, "startYear": 2000, "endYear": end_year, "years": years}


def tracks(location):
    with sqlite3.connect(ensure_tracks()) as connection:
        latest, retrieved = connection.execute("SELECT * FROM metadata").fetchone()
        # Exclude the archive's incomplete latest year, even if the current year advances.
        end_year = min(dt.date.today().year - 1, int(latest[:4]) - (latest[5:10] != "12-31"))
        lat, lon = location["latitude"], location["longitude"]
        delta = math.degrees(RADIUS_KM / 6371.0088)
        lon_delta = min(180, delta / max(0.001, math.cos(math.radians(lat))))
        # Longitude filtering is applied geodesically below, including across the date line.
        rows = connection.execute("SELECT * FROM points WHERE lat BETWEEN ? AND ? AND year <= ?", (lat-delta, lat+delta, end_year)).fetchall()
        rows = [r for r in rows if abs((r[5] - lon + 180) % 360 - 180) <= lon_delta]
        result = summarize_tracks(rows, lat, lon, end_year)
        for storm in result["storms"][:16]:
            storm["track"] = [list(p) for p in connection.execute("SELECT lat,lon,wind FROM points WHERE sid=? ORDER BY time", (storm["id"],))]
        result.update({"retrieved": retrieved, "archiveThrough": latest, "radiusMiles": 50})
        return result


def county_risk(location):
    result = arcgis(NRI, geometry=f'{location["longitude"]},{location["latitude"]}',
                    geometryType="esriGeometryPoint", inSR=4326, spatialRel="esriSpatialRelIntersects",
                    outFields="COUNTY,STATE,STCOFIPS,HRCN_RISKR,HRCN_RISKS,HRCN_EXPB,HRCN_EALB,HRCN_AFREQ,POPULATION")
    features = result.get("features", [])
    if not features:
        return None
    row = features[0]["attributes"]
    return {"county": row["COUNTY"], "state": row["STATE"], "fips": row["STCOFIPS"],
            "rating": row["HRCN_RISKR"], "score": nonnegative(row["HRCN_RISKS"]),
            "buildingExposure": nonnegative(row["HRCN_EXPB"]), "annualBuildingLoss": nonnegative(row["HRCN_EALB"]),
            "annualFrequency": nonnegative(row["HRCN_AFREQ"]), "vintage": "Archived FEMA NRI mirror, published February 2024"}


def damage_value(value):
    if value is None or str(value).strip() == "":
        return None
    value = str(value).strip().upper()
    multiplier = {"K": 1e3, "M": 1e6, "B": 1e9}.get(value[-1], 1)
    number = nonnegative(value[:-1] if multiplier != 1 else value)
    return None if number is None else number * multiplier


def storm_events(county):
    dates = get_json(NOAA + "/api/min-max-dates")
    end_year = min(dt.date.today().year - 1, int(dates["max_date"]) // 100 - (int(dates["max_date"]) % 100 != 12))
    payload = {"beginDate": "2000-01-01", "endDate": f"{end_year}-12-31", "activeTab": 1,
               "stateList": [county["state"]], "countyList": [county["county"]],
               "eventList": ["Hurricane", "Tropical Storm", "Storm Surge/Tide"]}
    result = get_json(NOAA + "/api/search-events", payload)
    if not isinstance(result.get("data"), list):
        raise ValueError("Unexpected NOAA response")
    # The NOAA API handles county-to-forecast-zone mapping; don't equate zones to a radius.
    rows = list({row["event_id"]: row for row in result["data"]}.values())
    if any(row["state"].casefold() != county["state"].casefold() for row in rows):
        raise ValueError("NOAA geographic filter could not be verified")
    records = [{"id": row["event_id"], "episodeId": row["episode_id"], "type": row["event_type"],
                "date": row["begin_date_time_formatted"], "zone": row["cz_name"],
                "propertyDamage": damage_value(row.get("damage_property"))} for row in rows]
    known = [r["propertyDamage"] for r in records if r["propertyDamage"] is not None]
    return {"records": records, "count": len(records), "reportedPropertyDamage": sum(known) if known else None,
            "damageMissing": len(records) - len(known), "endYear": end_year,
            "largest": max(records, key=lambda r: r["propertyDamage"] or 0) if known else None}


def schools(county):
    result = arcgis(SCHOOLS, where=f"CNTY='{county['fips']}'", outFields="NCESSCH,NAME,LAT,LON,SCHOOLYEAR", resultRecordCount=2000)
    if result.get("exceededTransferLimit"):
        raise ValueError("School response truncated")
    rows = [f["attributes"] for f in result.get("features", [])]
    return {"count": len(rows), "year": rows[0]["SCHOOLYEAR"] if rows else None,
            "locations": [{"name": r["NAME"], "latitude": r["LAT"], "longitude": r["LON"]} for r in rows]}


def sum_known(values):
    return sum(values) if all(v is not None for v in values) else None


def community(county):
    geo = "05000US" + county["fips"]
    url = "https://api.censusreporter.org/1.0/data/show/latest?" + urlencode({"table_ids": "B01003,C24030,B14001", "geo_ids": geo})
    response = get_json(url)
    data = response["data"][geo]
    industry = data["C24030"]["estimate"]
    total = nonnegative(industry.get("C24030001"))
    sectors = []
    # Combine male/female counts for disjoint top-level ACS industry groups.
    for key, column in response["tables"]["C24030"]["columns"].items():
        index = int(key[-3:])
        if column["indent"] != 2 or index >= 29:
            continue
        count = sum_known([nonnegative(industry.get(key)), nonnegative(industry.get(f"C24030{index+27:03d}"))])
        if count is not None and total:
            sectors.append({"name": column["name"].rstrip(":"), "count": count, "share": count / total * 100})
    school = data["B14001"]["estimate"]
    return {"population": nonnegative(data["B01003"]["estimate"].get("B01003001")),
            "students": sum_known([nonnegative(school.get(f"B14001{i:03d}")) for i in range(4, 8)]),
            "workforce": total, "industries": sorted(sectors, key=lambda x: x["share"], reverse=True),
            "release": response["release"], "url": url}


def climate(location):
    url = "https://climate-api.open-meteo.com/v1/climate?" + urlencode({
        "latitude": location["latitude"], "longitude": location["longitude"],
        "start_date": "1995-01-01", "end_date": "2049-12-31", "models": "MRI_AGCM3_2_S", "daily": "temperature_2m_mean"})
    daily = get_json(url, ttl=7*86400)["daily"]
    groups = {"baseline": [], "near": [], "mid": []}
    for date, value in zip(daily["time"], daily["temperature_2m_mean"]):
        if value is None:
            continue
        year = int(date[:4])
        group = "baseline" if 1995 <= year <= 2014 else "near" if 2025 <= year <= 2034 else "mid" if 2040 <= year <= 2049 else None
        if group:
            groups[group].append(value)
    if len(groups["baseline"]) < 7300 or min(len(groups["near"]), len(groups["mid"])) < 3650:
        raise ValueError("Incomplete climate projection")
    averages = {key: sum(values)/len(values) for key, values in groups.items()}
    return {"near": averages["near"] - averages["baseline"], "mid": averages["mid"] - averages["baseline"],
            "baseline": averages["baseline"], "model": "MRI-AGCM3-2-S", "url": url}


def source_result(function, *args):
    try:
        data = function(*args)
        return {"status": "ok" if data is not None else "unavailable", "data": data}
    except Exception as error:
        print(f"{function.__name__}: {type(error).__name__}: {error}", flush=True)
        return {"status": "error", "data": None, "message": "Source temporarily unavailable. Retry this location."}


def resolve_location(identifier):
    result = get_json("https://geocoding-api.open-meteo.com/v1/get?" + urlencode({"id": identifier, "language": "en"}))
    row = result["results"][0] if "results" in result else result
    return {"id": row["id"], "name": row["name"], "region": row.get("admin1", ""), "country": row.get("country", ""),
            "countryCode": row.get("country_code"), "latitude": row["latitude"], "longitude": row["longitude"]}


def report(identifier):
    location = resolve_location(identifier)
    with ThreadPoolExecutor(max_workers=6) as pool:
        track_job = pool.submit(source_result, tracks, location)
        climate_job = pool.submit(source_result, climate, location)
        county = source_result(county_risk, location) if location["countryCode"] in ("US", "PR", "VI", "GU", "AS", "MP") else {"status": "unavailable", "data": None}
        jobs = {}
        if county["data"]:
            for key, function in [("events", storm_events), ("schools", schools), ("community", community)]:
                jobs[key] = pool.submit(source_result, function, county["data"])
        result = {"location": location, "county": county, "tracks": track_job.result(), "climate": climate_job.result()}
        for key in ("events", "schools", "community"):
            result[key] = jobs[key].result() if key in jobs else {"status": "unavailable", "data": None}
    result["generatedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()
    return result


class Handler(BaseHTTPRequestHandler):
    def send(self, value, status=200, content_type="application/json"):
        content = json.dumps(value, allow_nan=False).encode() if content_type == "application/json" else value
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        try:
            self.wfile.write(content)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        request = urlparse(self.path)
        params = parse_qs(request.query)
        try:
            if request.path == "/api/search":
                query = params.get("q", [""])[0].strip()
                if not 2 <= len(query) <= 180:
                    return self.send({"error": "Enter a city, region, or postal code."}, 400)
                url = "https://geocoding-api.open-meteo.com/v1/search?" + urlencode({"name": query, "count": 12, "language": "en", "format": "json"})
                return self.send(get_json(url))
            if request.path == "/api/report":
                identifier = params.get("id", [""])[0]
                if not identifier.isdigit() or len(identifier) > 12:
                    return self.send({"error": "Select a matching location first."}, 400)
                return self.send(report(identifier))
            files = {"/": "index.html", "/index.html": "index.html", "/src/app.js": "src/app.js",
                     "/src/styles.css": "src/styles.css", "/vendor/leaflet.js": "node_modules/leaflet/dist/leaflet.js",
                     "/vendor/leaflet.css": "node_modules/leaflet/dist/leaflet.css",
                     "/vendor/lucide.js": "node_modules/lucide/dist/umd/lucide.js"}
            if request.path not in files:
                return self.send({"error": "Not found"}, 404)
            path = ROOT / files[request.path]
            content_type = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8"}[path.suffix]
            self.send(path.read_bytes(), content_type=content_type)
        except Exception as error:
            print(f"Request error: {error}", flush=True)
            self.send({"error": "Could not retrieve this location. Please retry."}, 502)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5174"))
    print(f"Hurricane Risk Explorer: http://localhost:{port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
