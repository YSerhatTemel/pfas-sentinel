"""Tests for the third external check (Smith et al. 2026 anion-exchange columns, protocol E6-E8)."""
import csv
import json
import os
import unittest

import external_validation_aex as aex

HERE = os.path.dirname(os.path.abspath(__file__))


def raw_rows():
    with open(aex.DATA_FILE, encoding="utf-8") as f:
        return list(csv.DictReader(line for line in f if not line.startswith("#")))


class AexDataTests(unittest.TestCase):
    def test_eight_trains_with_both_points(self):
        data = aex.load()
        self.assertEqual(len(data), 8)
        for key, tr in data.items():
            for point in ("lead", "lag"):
                self.assertGreaterEqual(len(tr[point]["PFOA"]), 26, (key, point))

    def test_header_records_source_hash_and_licence(self):
        with open(aex.DATA_FILE, encoding="utf-8") as f:
            head = "".join(line for line in f if line.startswith("#"))
        self.assertIn("d19d9962c3d4e78076842d080cb208bdb783d99f4031b8c06ac166f86c0cb8bd", head)
        self.assertIn("public domain", head)
        self.assertIn("10.23719/1532427", head)

    def test_port_and_outlet_share_the_run_time_axis(self):
        # Both points of a train are sampled to the end of the run, so their last run times coincide.
        data = aex.load()
        for key, tr in data.items():
            last_lead = max(t for s in aex.SPECIES for t, _ in tr["lead"][s])
            last_lag = max(t for s in aex.SPECIES for t, _ in tr["lag"][s])
            self.assertAlmostEqual(last_lead, last_lag, delta=1e-6 * last_lag, msg=key)

    def test_outlier_flags_as_published(self):
        flagged = [r for r in raw_rows() if r["outlier"] == "1"]
        self.assertEqual(len(flagged), 19)  # 11 in sheet Fig1, 8 in sheet Fig2 (amendment A1)

    def test_port_positions_follow_resin_mass(self):
        self.assertEqual(aex.Z_PORT, {1: 0.5, 2: 0.6})


@unittest.skipUnless(os.environ.get("PFAS_FULL_REPRO") == "1", "slow (several minutes); set PFAS_FULL_REPRO=1 (always on in CI)")
class AexReproducibility(unittest.TestCase):
    def test_report_reproduces_and_never_uses_later_samples(self):
        rep = json.loads(json.dumps(aex.run()))
        with open(aex.OUTPUT_FILE, encoding="utf-8") as f:
            saved = json.load(f)
        for key in ("E7", "E8", "sensitivityWithoutFlaggedOutliers"):
            self.assertEqual(rep[key], saved[key], key)
        self.assertEqual(rep["E6"]["summary"], saved["E6"]["summary"])
        self.assertEqual(rep["E6"]["verdict"], saved["E6"]["verdict"])
        data = aex.load()
        for case in rep["E6"]["cases"]:
            if "noCase" in case:
                continue
            tgt = data[tuple(case["target"])]
            # The JSON stores the cut-off rounded to 4 significant digits, so recompute the exact one
            # (a sample taken on the cut-off day itself belongs to the training data).
            cutoff = aex.cutoff_time(tgt, case["cutoff"])
            self.assertAlmostEqual(cutoff, case["cutoffD"], delta=5e-4 * cutoff)
            for sp in aex.SPECIES:
                expected = len([t for t, _ in tgt["lead"][sp] if t <= cutoff])
                self.assertEqual(case["trainingSamples"][sp], expected, (case["target"], case["cutoff"], sp))
        for case in rep["E7"]["cases"]:
            self.assertEqual(set(case.get("trainingSamples", {})) - set(aex.TRACERS), set())


if __name__ == "__main__":
    unittest.main()
