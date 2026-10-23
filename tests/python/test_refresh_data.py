"""Tests for scripts/refresh-data.py: run with  python3 -m unittest discover -s tests/python"""
import importlib.util
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("refresh", os.path.join(HERE, "..", "..", "scripts", "refresh-data.py"))
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)

PAGE = """
<html><body>
<h3>TNV Data - August 2026.xlsx</h3>
<a href="/sites/default/files/2026-09/TNV%20Data%20-%20August%202026.xlsx">Download</a>
<a href="/sites/default/files/2026-06/total_new_vacancies_may_2026.xlsx">Download</a>
<a href="/sites/default/files/2026-09/tnv_report_-_august_2026.xlsx">Report</a>
<a href="/sites/default/files/2026-09/tnv_report_-_august_2026.pdf">Download</a>
<a href="https://www.jobsandskills.gov.au/sites/default/files/2026-05/national_industry_trend.xlsx">National Industry Trend.xlsx</a>
<a href="/sites/default/files/2025-10/2025_Key_Findings_Report_downloadable_Charts_and_Tables_0.xlsx">Download</a>
<a href="/sites/default/files/2024-10/2024_osl_key_findings_report_-_figures_and_tables_downloadable.xlsx">Download</a>
</body></html>
"""
BASE = "https://www.jobsandskills.gov.au/data/total-new-vacancies"


class Dates(unittest.TestCase):
    def test_formats(self):
        d = refresh.date_of
        self.assertEqual(d("jsa_gen_ai_interactive_table_data_pack_20250903.xlsx"), "2025-09")
        self.assertEqual(d("internet_vacancies_anzsco_skill_level_states_and_territories_-_august_2026.xlsx"), "2026-08")
        self.assertEqual(d("employment_projections_-_may_2025_to_may_2035.xlsx"), "2035-05")
        self.assertEqual(d("TNV Data - August 2025_0 (1).xlsx"), "2025-08")
        self.assertEqual(d("2025_Key_Findings_Report_downloadable_Charts_and_Tables_0.xlsx"), "2025-01")
        self.assertEqual(d("2026-02"), "2026-02")
        self.assertEqual(d("May 2035"), "2035-05")
        self.assertIsNone(d("national_industry_trend.xlsx"))
        self.assertEqual(refresh.upload_folder("https://x/sites/default/files/2026-05/a.xlsx"), "2026-05")


class Candidates(unittest.TestCase):
    def test_newest_matching_spreadsheet_first(self):
        src = {"match": r"(total[ _-]*new[ _-]*vacanc|\btnv\b|tnv[ _-]*data)", "exclude": r"report|methodology"}
        c = refresh.candidates(PAGE, BASE, src)
        self.assertEqual([x["file"] for x in c], ["TNV Data - August 2026.xlsx", "total_new_vacancies_may_2026.xlsx"])
        self.assertTrue(c[0]["url"].startswith("https://www.jobsandskills.gov.au/sites/default/files/2026-09/"))
        self.assertEqual(c[0]["date"], "2026-08")

    def test_undated_file_uses_upload_folder(self):
        c = refresh.candidates(PAGE, BASE, {"match": r"national[ _-]*industry[ _-]*trend"})
        self.assertEqual(c[0]["date"], "2026-05")

    def test_picks_latest_year(self):
        c = refresh.candidates(PAGE, BASE, {"match": r"key[ _-]*findings.*(tables|charts|figures)"})
        self.assertEqual(c[0]["file"], "2025_Key_Findings_Report_downloadable_Charts_and_Tables_0.xlsx")


class Paths(unittest.TestCase):
    def test_get_path_and_period(self):
        doc = {"tnv": {"latest": "2026-05"}, "years": ["2024", "2025"], "source": {"horizon10": "May 2035"}}
        self.assertEqual(refresh.get_path(doc, "tnv.latest"), "2026-05")
        self.assertEqual(refresh.norm_period(refresh.get_path(doc, "years.-1")), "2025-01")
        self.assertEqual(refresh.norm_period(refresh.get_path(doc, "source.horizon10")), "2035-05")


if __name__ == "__main__":
    unittest.main()
