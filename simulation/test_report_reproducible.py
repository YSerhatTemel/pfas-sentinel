"""Full reproducibility check of simulation/validation_report.json and reference_outputs.json.

Slow (about 5 minutes): it recomputes every synthetic number quoted in the README, including the decision
test of the PINN-style option. It runs in CI (PFAS_FULL_REPRO=1 in .github/workflows/deploy.yml) and is
skipped locally unless that variable is set.
"""
import json
import math
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
IGNORED_KEYS = {"runtimeSeconds"}


def compare(a, b, path="$", rel=1e-6, abs_tol=1e-9):
    """Return a list of differences between two JSON-like trees (numbers compared with a tolerance)."""
    diffs = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k in IGNORED_KEYS:
                continue
            if k not in a or k not in b:
                diffs.append(f"{path}.{k}: missing on one side")
                continue
            diffs.extend(compare(a[k], b[k], f"{path}.{k}", rel, abs_tol))
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            diffs.append(f"{path}: length {len(a)} != {len(b)}")
        else:
            for i, (x, y) in enumerate(zip(a, b)):
                diffs.extend(compare(x, y, f"{path}[{i}]", rel, abs_tol))
    elif isinstance(a, bool) or isinstance(b, bool) or not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        if a != b:
            diffs.append(f"{path}: {a!r} != {b!r}")
    elif not math.isclose(a, b, rel_tol=rel, abs_tol=abs_tol):
        diffs.append(f"{path}: {a!r} != {b!r}")
    return diffs


@unittest.skipUnless(os.environ.get("PFAS_FULL_REPRO") == "1", "slow full reproducibility check; set PFAS_FULL_REPRO=1 (always on in CI)")
class FullReportReproducibility(unittest.TestCase):
    def test_validation_report_and_fixture_reproduce(self):
        import validation_report

        report, reference = validation_report.build_report(quick=False, with_hybrid_ops=True)
        report = json.loads(json.dumps(report))
        reference = json.loads(json.dumps(reference))
        with open(os.path.join(HERE, "validation_report.json"), encoding="utf-8") as f:
            saved_report = json.load(f)
        with open(os.path.join(HERE, "reference_outputs.json"), encoding="utf-8") as f:
            saved_reference = json.load(f)
        diffs = compare(report, saved_report) + compare(reference, saved_reference, "$ref")
        self.assertEqual(diffs[:20], [], f"{len(diffs)} differences")


class CompareHelperTests(unittest.TestCase):
    def test_compare_tolerates_float_noise_but_not_changes(self):
        self.assertEqual(compare({"a": 1.0, "runtimeSeconds": 5}, {"a": 1.0 + 1e-12, "runtimeSeconds": 9}), [])
        self.assertEqual(len(compare({"a": [1, 2]}, {"a": [1, 3]})), 1)
        self.assertEqual(len(compare({"a": True}, {"a": False})), 1)


if __name__ == "__main__":
    unittest.main()
