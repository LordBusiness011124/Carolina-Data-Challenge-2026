import unittest
from unittest.mock import patch
import server


class DataTests(unittest.TestCase):
    def test_damage_units_and_missing_values(self):
        self.assertEqual(server.damage_value("1.20B"), 1_200_000_000)
        self.assertEqual(server.damage_value("10K"), 10_000)
        self.assertEqual(server.damage_value("0.00K"), 0)
        self.assertIsNone(server.damage_value(None))
        self.assertIsNone(server.damage_value(""))
        self.assertIsNone(server.damage_value("unknown"))

    def test_distinct_storms_and_years_not_track_points(self):
        rows = [
            ("a", "A", 2018, "2018-09-14", 34, -78, 80, 1),
            ("a", "A", 2018, "2018-09-13", 34.1, -78, 70, 1),
            ("b", "B", 2018, "2018-10-14", 34, -78, 80, 1),
            ("c", "C", 2020, "2020-09-14", 34, -78, 45, 0),
            ("d", "D", 2026, "2026-09-14", 34, -78, 80, 1),
        ]
        result = server.summarize_tracks(rows, 34, -78, 2025)
        self.assertEqual(result["hurricaneCount"], 2)
        self.assertEqual(result["cycloneCount"], 3)
        self.assertAlmostEqual(result["annualObservedPercent"], 100 / 26)
        self.assertEqual(next(s for s in result["storms"] if s["id"] == "a")["date"], "2018-09-13")

    def test_remote_extratropical_and_missing_winds_excluded(self):
        rows = [
            ("a", "A", 2018, "2018-09-14", 40, -78, 80, 1),
            ("b", "B", 2018, "2018-09-14", 34, -78, 80, -4),
            ("c", "C", 2018, "2018-09-14", 34, -78, None, 1),
        ]
        self.assertEqual(server.summarize_tracks(rows, 34, -78, 2025)["hurricaneCount"], 0)

    def test_dateline_distance(self):
        self.assertLess(server.distance_km(0, 179.9, 0, -179.9), 23)
        self.assertEqual(server.distance_km(20, 30, 20, 30), 0)

    def test_noaa_uses_geographic_tab_and_keeps_unknown_damage(self):
        record = {"event_id": 1, "episode_id": 9, "event_type": "Tropical Storm", "state": "NORTH CAROLINA",
                  "begin_date_time_formatted": "09/14/2018 06:00", "cz_name": "COASTAL NEW HANOVER", "damage_property": None}
        with patch("server.get_json", side_effect=[{"max_date": 202606}, {"data": [record, record]}]) as request:
            result = server.storm_events({"state": "North Carolina", "county": "New Hanover"})
        payload = request.call_args_list[1].args[1]
        self.assertEqual(payload["activeTab"], 1)
        self.assertEqual(payload["countyList"], ["New Hanover"])
        self.assertEqual(payload["endDate"], "2025-12-31")
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["damageMissing"], 1)
        self.assertIsNone(result["reportedPropertyDamage"])

    def test_noaa_rejects_ignored_state_filter(self):
        with patch("server.get_json", side_effect=[{"max_date": 202606}, {"data": [{"event_id": 1, "state": "FLORIDA"}]}]):
            with self.assertRaises(ValueError):
                server.storm_events({"state": "North Carolina", "county": "New Hanover"})

    def test_missing_count_is_not_zero(self):
        self.assertIsNone(server.sum_known([20, None]))
        self.assertEqual(server.sum_known([20, 0]), 20)
        self.assertIsNone(server.nonnegative(-999999))

    def test_failed_provider_is_isolated(self):
        def broken():
            raise TimeoutError("upstream timeout")
        self.assertEqual(server.source_result(broken)["status"], "error")
        self.assertIsNone(server.source_result(lambda: None)["data"])

    def test_school_truncation_is_not_a_complete_count(self):
        with patch("server.arcgis", return_value={"exceededTransferLimit": True, "features": []}):
            with self.assertRaises(ValueError):
                server.schools({"fips": "37129"})

    def test_acs_combines_sexes_without_double_counting_subindustries(self):
        fixture = {"data": {"05000US37129": {
            "B01003": {"estimate": {"B01003001": 300}},
            "B14001": {"estimate": {"B14001004": 1, "B14001005": 2, "B14001006": 3, "B14001007": 4}},
            "C24030": {"estimate": {"C24030001": 100, "C24030021": 30, "C24030048": 20, "C24030022": 10}}
        }}, "tables": {"C24030": {"columns": {
            "C24030021": {"indent": 2, "name": "Education and health:"},
            "C24030022": {"indent": 3, "name": "Education"},
            "C24030048": {"indent": 2, "name": "Education and health:"}
        }}}, "release": {"name": "ACS fixture"}}
        with patch("server.get_json", return_value=fixture):
            result = server.community({"fips": "37129"})
        self.assertEqual(result["students"], 10)
        self.assertEqual(len(result["industries"]), 1)
        self.assertEqual(result["industries"][0]["share"], 50)


if __name__ == "__main__":
    unittest.main()
