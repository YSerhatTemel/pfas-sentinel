"""Tests for the full-scale external check (Crew 2021 data read from vector charts)."""
import json
import os
import unittest

import external_validation_fullscale as fs

HERE = os.path.dirname(os.path.abspath(__file__))

# Breakthrough bed volumes stated in the text of Crew (2021) vs the first non-zero charted point.
STATED = [
    (1, "halfway", "PFHXA", 3700), (1, "halfway", "PFOA", 4800), (1, "between", "PFHXA", 5600), (1, "between", "PFBS", 9000),
    (1, "after_lag", "PFOA", 20000), (1, "after_lag", "PFOS", 26000), (2, "halfway", "PFHXS", 2000), (2, "halfway", "PFOS", 2200),
    (2, "between", "PFHXA", 3300), (2, "after_lag", "PFOA", 12000), (2, "after_lag", "PFOS", 9600),
]


def raw_rows():
    import csv
    with open(fs.DATA_FILE, encoding="utf-8") as f:
        return list(csv.DictReader(line for line in f if not line.startswith("#")))


class FullScaleDataTests(unittest.TestCase):
    def test_extracted_series_are_complete(self):
        rows = raw_rows()
        counts = {}
        for r in rows:
            counts.setdefault((r["site"], r["port"]), set()).add(r["species"])
        self.assertEqual(len(counts), 6)
        for species in counts.values():
            self.assertEqual(len(species), 14)
        with open(fs.DATA_FILE, encoding="utf-8") as f:
            header = [line for line in f if line.startswith("#")]
        residual_lines = [h for h in header if "ng/L (y)" in h]
        self.assertEqual(len(residual_lines), 6)
        for h in residual_lines:
            y_res = float(h.split(":")[-1].split("ng/L")[0])
            self.assertLess(y_res, 0.05)

    def test_first_detections_match_author_statements(self):
        rows = raw_rows()
        for site, port, sp, stated in STATED:
            pts = sorted(float(r["bed_volumes"]) for r in rows if r["site"] == str(site) and r["port"] == port
                         and r["species"] == sp and float(r["ng_L"]) > 0.05)
            self.assertTrue(pts, (site, port, sp))
            self.assertLess(abs(pts[0] - stated), 1500, (site, port, sp, pts[0], stated))

    def test_site2_replacement_is_respected(self):
        data = fs.load()
        self.assertLessEqual(max(t for t, _ in data[2]["between"]["PFOS"]), fs.REPLACEMENT_BV[2] / fs.KBV)


@unittest.skipUnless(os.environ.get("PFAS_FULL_REPRO") == "1", "slow (about 2 min); set PFAS_FULL_REPRO=1 (always on in CI)")
class FullScaleReproducibility(unittest.TestCase):
    def test_report_reproduces_and_never_uses_later_samples(self):
        rep = json.loads(json.dumps(fs.run()))
        with open(fs.OUTPUT_FILE, encoding="utf-8") as f:
            saved = json.load(f)
        self.assertEqual(rep["summary"], saved["summary"])
        self.assertEqual(rep["postHocMidbedLead"], saved["postHocMidbedLead"])
        self.assertEqual(rep["scalingCheck"], saved["scalingCheck"])
        data = fs.load()
        for case in rep["cases"]:
            for sp in fs.SPECIES:
                expected = len([t for t, _ in data[case["target"]]["halfway"][sp] if t <= case["cutoffKBV"] + 1e-9])
                self.assertEqual(case["trainingSamples"][sp], expected)


if __name__ == "__main__":
    unittest.main()
