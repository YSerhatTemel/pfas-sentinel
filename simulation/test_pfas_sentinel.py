"""
Unit tests for the Python reference core (standard library only).

Run:  python -m unittest discover -s simulation -p "test_*.py"
"""

import inspect
import json
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pfas_sentinel_core as core  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
KKWWD = {
    "mediaType": "GAC",
    "flowRateMGD": 2.1,
    "mediaMassKg": 9100,
    "nomMgL": 2.1,
    "includeRollup": True,
    "C0": {"PFBA": 26.5, "PFBS": 31.0, "PFOA": 38.5, "PFOS": 44.0},
}


class TwinTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fit = core.fit_plant_twin(KKWWD)

    def test_gradient_matches_finite_differences(self):
        obs = [
            {"sp": sp, "z": 0.5, "t": p["day"], "y": p["observedMidBedPpt"]}
            for sp in core.SPECIES_ORDER
            for p in core.generate_observations(KKWWD)[sp]
            if p["split"] == "TRAIN"
        ]
        cfg = dict(core.TWIN_CONFIG)
        cfg.update({"useNetwork": True, "lambdaAdv": 0.5, "lambdaKin": 0.5})
        theta = [v + 0.1 * math.sin(i + 1) for i, v in enumerate(core.initial_params(True))]
        grad = [0.0] * core.N_PARAMS
        core.loss_and_grad(KKWWD, core.SPECIES_ORDER, theta, obs, cfg, grad)
        for p in range(core.N_PARAMS):
            h = 1e-6
            tp = list(theta)
            tm = list(theta)
            tp[p] += h
            tm[p] -= h
            fd = (core.loss_and_grad(KKWWD, core.SPECIES_ORDER, tp, obs, cfg)["total"] - core.loss_and_grad(KKWWD, core.SPECIES_ORDER, tm, obs, cfg)["total"]) / (2 * h)
            self.assertLessEqual(abs(fd - grad[p]), 1e-5 * max(1e-6, abs(fd) + abs(grad[p])) + 1e-10, msg=f"parameter {p}")

    def test_outputs_are_finite_and_loss_decreases(self):
        self.assertLess(self.fit["finalLoss"]["total"], self.fit["initialLoss"]["total"])
        for v in self.fit["theta"]:
            self.assertTrue(math.isfinite(v))
        for sp in core.SPECIES_ORDER:
            r = self.fit["species"][sp]
            for key in ("effluent4PptDay", "midBed4PptDay", "uncertaintyBandDays", "testRmsePpt"):
                self.assertTrue(math.isfinite(r[key]), key)
            self.assertLess(r["midBed4PptDay"], r["effluent4PptDay"])

    def test_chain_length_ordering(self):
        days = [self.fit["species"][sp]["effluent4PptDay"] for sp in core.SPECIES_ORDER]
        self.assertEqual(days, sorted(days))

    def test_beats_static_vendor_curve_for_pfoa_pfos(self):
        for sp in ("PFOA", "PFOS"):
            r = self.fit["species"][sp]
            self.assertLess(abs(r["effluent4PptDay"] - r["testbenchEffluent4PptDay"]), abs(r["staticEffluent4PptDay"] - r["testbenchEffluent4PptDay"]))

    def test_operational_mode_uses_no_future_data(self):
        f = core.fit_plant_twin(KKWWD, as_of_day=118)
        self.assertLessEqual(f["lastDataDay"], 118)

    def test_physics_only_model_satisfies_the_pde(self):
        res = core.pde_residual_rms(KKWWD, self.fit["theta"])
        self.assertLess(res["adv"], 1e-3)
        self.assertLess(res["kin"], 1e-3)


class SensorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cal = core.calibrate_edge_estimator()

    def test_true_condition_number_and_determinant(self):
        self.assertAlmostEqual(self.cal["conditionNumberS"], 1.6272, places=3)
        self.assertAlmostEqual(self.cal["determinantS"], 0.9395, places=3)

    def test_deconvolution_beats_diagonal_estimate(self):
        b = core.run_mixture_benchmark(self.cal, 120, 4242)
        self.assertLess(b["methods"]["full"]["mapePct"], b["methods"]["diagonal"]["mapePct"])

    def test_reference_matrix_recovery(self):
        mix = [8.0, 5.0, 3.0, 2.0]
        r = core.simulate_sensor(mix, core.REFERENCE_MATRIX, core.Mulberry32(7), {"noiseScale": 0.0})
        est = core.estimate_mixture(r, self.cal)
        for i, v in enumerate(est["estimatePpt"]):
            self.assertLess(abs(v - mix[i]) / mix[i], 0.1)

    def test_blind_estimator_signature(self):
        self.assertEqual(list(inspect.signature(core.estimate_mixture).parameters), ["reading", "cal"])


class FixtureTests(unittest.TestCase):
    def test_reference_outputs_are_current(self):
        with open(os.path.join(HERE, "reference_outputs.json"), encoding="utf-8") as fh:
            ref = json.load(fh)
        fit = core.fit_plant_twin(KKWWD)
        for sp in core.SPECIES_ORDER:
            self.assertAlmostEqual(fit["species"][sp]["effluent4PptDay"], ref["kkwwdValidation"][sp]["effluent4PptDay"], places=6)
        cal = core.calibrate_edge_estimator()
        self.assertAlmostEqual(cal["lambda"], ref["sensorCalibration"]["lambda"], places=9)


if __name__ == "__main__":
    unittest.main()
