"""Tests for the A2 repeat and the E6-E8 correction rerun (Smith et al. 2026 detailed data, amendments A2-A3)."""
import json
import os
import unittest

import external_validation_aex as aex
import external_validation_aex_a2 as a2

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)


def saved():
    with open(a2.OUTPUT_FILE, encoding="utf-8") as f:
        return json.load(f)


class A2DataTests(unittest.TestCase):
    def test_header_records_source_hashes_and_sharing_condition(self):
        with open(a2.DETAILED_FILE, encoding="utf-8") as f:
            head = "".join(line for line in f if line.startswith("#"))
        self.assertIn("2e35200625a9f140ee57d7691bfc5e14bc451fa7abff987e18e1dce497650716", head)  # zip, registered in A2
        self.assertIn("must not be", head)
        self.assertIn("processed subset", head)
        self.assertIn("10.23719/1532427", head)

    def test_raw_files_are_kept_out_of_the_repository(self):
        with open(os.path.join(REPO, ".gitignore"), encoding="utf-8") as f:
            ignored = f.read().split()
        self.assertIn("Smith-2026-all-data/", ignored)
        self.assertIn("*.zip", ignored)
        for root, _, files in os.walk(os.path.join(HERE, "data")):
            self.assertFalse([n for n in files if n.lower().endswith((".xlsx", ".xls", ".zip"))], root)

    def test_eight_trains_with_influent_port_and_outlet(self):
        raw = a2.load_detailed()
        self.assertEqual(len(raw), 8)
        for key, tr in raw.items():
            for point in a2.POINTS:
                self.assertGreaterEqual(len(tr[point]["PFOA"]), 50, (key, point))

    def test_time_correction_only_in_experiment_2(self):
        a1, rt = a2.ebct_a1(), a2.ebct_from_run_time()
        for (nom, exp, rep), v in a1.items():
            for point in ("lead", "lag"):
                f = rt[(nom, exp, rep)][point] / v[point]
                if exp == 1:
                    self.assertAlmostEqual(f, 1.0, delta=1e-9)
                else:
                    self.assertTrue(0.98 < f < 1.02 and abs(f - 1.0) > 1e-3, (nom, exp, rep, point, f))

    def test_c0_known_uses_only_influent_on_or_before_t(self):
        tr = {"influent": {"PFOA": [(1.0, 400.0), (5.0, 600.0), (9.0, 1000.0)]}}
        self.assertEqual(a2.c0_known(tr, "PFOA", 0.5), 400.0)  # none yet: the first influent sample (A2 8.2)
        self.assertEqual(a2.c0_known(tr, "PFOA", 5.0), 500.0)
        self.assertEqual(a2.c0_known(tr, "PFOA", 8.9), 500.0)
        self.assertEqual(a2.c0_all(tr, "PFOA"), 2000.0 / 3)


class A2ReportTests(unittest.TestCase):
    def test_correction_leaves_experiment_1_unchanged(self):
        # Only Experiment 2 run times were corrected, so the Experiment 1 cases must equal the primary run.
        with open(aex.OUTPUT_FILE, encoding="utf-8") as f:
            primary = json.load(f)
        rep = saved()

        def exp1(cases):
            return {(tuple(c["source"]), tuple(c["target"]), c["cutoff"]): c for c in cases if c["target"][0] == 1}

        p, c = exp1(primary["E6"]["cases"]), exp1(rep["correction"]["E6"]["cases"])
        self.assertEqual(set(p), set(c))
        for k in p:
            self.assertEqual(p[k].get("methods"), c[k].get("methods"), k)

    def test_agreement_matches_verdicts(self):
        rep = saved()
        v = rep["verdicts"]
        for key, (a, b) in {"correctionVsPrimary": ("correction", "primary"), "repeatVsPrimary": ("repeat", "primary"),
                            "repeatVsCorrection": ("repeat", "correction")}.items():
            self.assertEqual(rep["agreement"][key], {k: v[a][k] == v[b][k] for k in v["primary"]})


@unittest.skipUnless(os.environ.get("PFAS_FULL_REPRO") == "1", "slow (about 25 minutes); set PFAS_FULL_REPRO=1 (always on in CI)")
class A2Reproducibility(unittest.TestCase):
    def test_report_reproduces_and_never_uses_later_samples(self):
        rep = json.loads(json.dumps(a2.run()))
        old = saved()
        self.assertEqual(rep["verdicts"], old["verdicts"])
        self.assertEqual(rep["agreement"], old["agreement"])
        for part in ("correction", "repeat"):
            for e in ("E7", "E8"):
                self.assertEqual(rep[part][e], old[part][e], (part, e))
            self.assertEqual(rep[part]["E6"]["summary"], old[part]["E6"]["summary"], part)
            self.assertEqual(rep[part]["E6"]["verdict"], old[part]["E6"]["verdict"], part)
        raw = a2.load_detailed()
        full = a2.full_record(raw)
        for case in rep["repeat"]["E6"]["cases"]:
            if "noCase" in case:
                continue
            tr = raw[tuple(case["target"])]
            cutoff = a2.repeat_cutoff(tr, full[tuple(case["target"])], case["cutoff"])
            self.assertAlmostEqual(cutoff, case["cutoffD"], delta=5e-4 * cutoff)
            for sp in aex.SPECIES:
                self.assertEqual(case["trainingSamples"][sp], len([t for t, _ in tr["lead"][sp] if t <= cutoff]))
                known = [y for t, y in tr["influent"][sp] if t <= cutoff]
                self.assertEqual(case["influentSamplesAtCutoff"][sp], len(known))
                if known:
                    self.assertAlmostEqual(case["c0AtCutoffNgL"][sp], sum(known) / len(known), delta=1e-3 * case["c0AtCutoffNgL"][sp])


if __name__ == "__main__":
    unittest.main()
