"""Tests for the external check on measured EPA pilot data (python -m unittest discover -s simulation)."""
import json
import math
import os
import unittest

import external_validation as ev
import pfas_sentinel_core as core

HERE = os.path.dirname(os.path.abspath(__file__))


def _close(a, b, rel=2e-3):
    return abs(a - b) <= rel * max(1.0, abs(a), abs(b))


class ExternalDataTests(unittest.TestCase):
    def test_pilot_file_integrity(self):
        data = ev.load_pilot()
        self.assertEqual(sorted(data), ["postAS", "preAS"])
        days = [p[0] for p in data["preAS"]["PFOA"]]
        self.assertEqual(len(days), 18)
        self.assertEqual(days[0], 0.0)
        self.assertEqual(days[-1], 392.0)
        for col in data.values():
            self.assertEqual(len(col), 10)
            for sp in ev.SPECIES:
                self.assertEqual([p[0] for p in col[sp]], days)
        # Both columns share one influent series in the EPA file.
        for sp in ev.SPECIES:
            self.assertEqual([p[1] for p in data["preAS"][sp]], [p[1] for p in data["postAS"][sp]])

    def test_isotherm_units_reproduce_published_point(self):
        iso = ev.load_isotherms()
        k, n = iso[("PFBA", "200x325")]
        # Fig 4 of the EPA sheet: PFBA on F400 at c_e = 32.18 ng/L gives q_e = 0.484 ug/g.
        self.assertTrue(abs(k * 32.17577756 ** n - 0.4844) / 0.4844 < 0.2)


class ExternalProtocolTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report = ev.run()
        with open(os.path.join(HERE, "external_validation.json"), encoding="utf-8") as f:
            cls.saved = json.load(f)

    def test_report_is_reproducible(self):
        for cutoff in ev.CUTOFF_DAYS:
            for m in ev.METHODS:
                a = self.report["summary"][str(cutoff)][m]
                b = self.saved["summary"][str(cutoff)][m]
                self.assertTrue(_close(a["meanPrimaryTestNrmse"], b["meanPrimaryTestNrmse"]), (cutoff, m))
                self.assertTrue(_close(a["meanPrimaryAbsDay50Error"], b["meanPrimaryAbsDay50Error"]), (cutoff, m))
        self.assertEqual(self.report["summary"]["postHoc4NgL"]["byMethod"], self.saved["summary"]["postHoc4NgL"]["byMethod"])
        self.assertTrue(_close(self.report["cleanWaterPrior"]["200x325"]["ratioSpread"], self.saved["cleanWaterPrior"]["200x325"]["ratioSpread"]))

    def test_headline_numbers_quoted_in_readme(self):
        s = self.saved["summary"]
        self.assertEqual(round(s["14"]["TWIN"]["meanPrimaryAbsDay50Error"], 1), 8.5)
        self.assertEqual(round(s["14"]["INDEPENDENT"]["meanPrimaryAbsDay50Error"], 1), 41.7)
        self.assertEqual(s["postHoc4NgL"]["byMethod"]["TWIN"], {"early": 2, "inside": 3, "late": 4})
        self.assertEqual(round(self.saved["cleanWaterPrior"]["200x325"]["ratioSpread"] / 10) * 10, 640)

    def test_training_never_sees_later_samples(self):
        for case in self.report["cases"]:
            expected = len([d for d in self.report["dataset"]["samplingDays"] if d <= case["cutoffDay"]])
            self.assertEqual(case["trainingSamplesPerSpecies"], expected)
            self.assertEqual(case["trainingSamplesPerSpecies"] + case["testSamplesPerSpecies"], 18)

    def test_shared_factors_beat_independent_fits_on_real_data(self):
        s = self.report["summary"]
        for cutoff in ev.CUTOFF_DAYS:
            self.assertLess(s[str(cutoff)]["TWIN"]["meanPrimaryAbsDay50Error"], s[str(cutoff)]["INDEPENDENT"]["meanPrimaryAbsDay50Error"])
            self.assertLess(s[str(cutoff)]["TWIN"]["meanPrimaryAbsDay50Error"], s[str(cutoff)]["DATA_ONLY"]["meanPrimaryAbsDay50Error"])

    def test_context_mapping_matches_thomas_curve(self):
        ctx = ev.context(0.05, 60.0, 24.0)
        zeros = [0.0] * core.N_PARAMS
        for t in (0.0, 30.0, 60.0, 120.0):
            self.assertTrue(math.isclose(core.eval_twin(ctx, zeros, 1.0, t), 24.0 * ev.thomas_fraction(0.05, 60.0, t), rel_tol=1e-12))


if __name__ == "__main__":
    unittest.main()
