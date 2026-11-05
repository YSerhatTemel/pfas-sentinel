"""
In-silico validation report for PFAS-Sentinel (Python 3.8+, standard library only).

Runs every number quoted in README.md and writes:
  simulation/validation_report.json  - full results
  simulation/reference_outputs.json  - fixture for the app's cross-language test

Usage:  python simulation/validation_report.py                    (a few minutes)
        python simulation/validation_report.py --with-hybrid-ops   (adds the slow decision test for the
                                                                    PINN-style hybrid, ~30 minutes)
        python simulation/validation_report.py --quick            (smaller samples, smoke test)

Everything here is synthetic: a hidden "virtual plant" generates the data, the twin and the sensor
estimator never see its parameters. These are TRL 2-3 model checks, not field results.
"""

import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pfas_sentinel_core as core  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
QUICK = "--quick" in sys.argv

SERVICE_LEAD_TIME_DAYS = 60  # mirrors src/data/ewsDecision.ts
EMERGENCY_LEAD_DAYS = 14

FACILITIES = {
    "kkwwd-maine": {"mediaType": "GAC", "flowRateMGD": 2.1, "mediaMassKg": 9100, "nomMgL": 2.1, "includeRollup": True,
                    "C0": {"PFBA": 26.5, "PFBS": 31.0, "PFOA": 38.5, "PFOS": 44.0}},
    "shwsd-colorado": {"mediaType": "IX", "flowRateMGD": 1.1, "mediaMassKg": 3800, "nomMgL": 1.3, "includeRollup": True,
                       "C0": {"PFBA": 29.0, "PFBS": 46.0, "PFOA": 52.0, "PFOS": 68.0}},
    "brabant-eu": {"mediaType": "HYBRID", "flowRateMGD": 3.4, "mediaMassKg": 14200, "nomMgL": 2.8, "includeRollup": True,
                   "C0": {"PFBA": 41.0, "PFBS": 49.0, "PFOA": 34.0, "PFOS": 39.0}},
}


def random_plants(seed: int, n: int):
    """Random but plausible single-vessel plants; redrawn until all outlet breaches fall in 120-1200 days."""
    rand = core.Mulberry32(seed)
    plants = []
    while len(plants) < n:
        media = core.MEDIA_ORDER[int(rand() * 3) % 3]
        mass_lo, mass_hi = {"GAC": (6000, 14000), "IX": (2500, 6000), "HYBRID": (9000, 16000)}[media]
        plant = {
            "mediaType": media,
            "flowRateMGD": core.round2(0.8 + 2.7 * rand()),
            "mediaMassKg": float(int(mass_lo + (mass_hi - mass_lo) * rand())),
            "nomMgL": core.round2(0.8 + 3.2 * rand()),
            "includeRollup": True,
            "C0": {sp: core.round1(15 + 55 * rand()) for sp in core.SPECIES_ORDER},
        }
        truth_days = [core.crossing_day(lambda t, sp=sp: core.truth_concentration(plant, sp, 1.0, t), core.TARGET_PPT) for sp in core.SPECIES_ORDER]
        if all(120 <= d <= 1200 for d in truth_days):
            plants.append(plant)
    return plants


def species_summary(fit):
    out = {}
    for sp in core.SPECIES_ORDER:
        r = fit["species"][sp]
        out[sp] = {k: r[k] for k in (
            "learnedKth", "learnedQ0", "priorKth", "priorQ0", "midBed4PptDay", "effluent4PptDay", "staticEffluent4PptDay",
            "testbenchEffluent4PptDay", "uncertaintyBandDays", "parametricSigmaDays", "modelFormSigmaDays",
            "trainRmsePpt", "testRmsePpt", "staticTestRmsePpt")}
    return out


def errors_for(fit, species=None):
    species = species or core.SPECIES_ORDER
    return [fit["species"][sp]["effluent4PptDay"] - fit["species"][sp]["testbenchEffluent4PptDay"] for sp in species]


def static_errors(plant, species=None):
    species = species or core.SPECIES_ORDER
    out = []
    for sp in species:
        st = core.crossing_day(lambda t, sp=sp: core.static_prior_concentration(plant, sp, 1.0, t), core.TARGET_PPT)
        tr = core.crossing_day(lambda t, sp=sp: core.truth_concentration(plant, sp, 1.0, t), core.TARGET_PPT)
        out.append(st - tr)
    return out


def stats(errs):
    abs_sorted = sorted(abs(e) for e in errs)
    return {
        "n": len(errs),
        "maeDays": sum(abs_sorted) / len(errs),
        "biasDays": sum(errs) / len(errs),
        "p90AbsDays": abs_sorted[int(math.floor(0.9 * (len(abs_sorted) - 1)))],
        "maxAbsDays": abs_sorted[-1],
    }


def run_ablation(plants):
    variants = {
        "staticPrior": None,
        "independentPerSpecies": {"independent": True},
        "jointPhysics (default)": {},
        "jointHybridNN (experimental)": dict(core.EXPERIMENTAL_HYBRID_CONFIG),
        "jointHybridNN_noPDE": {"useNetwork": True},
    }
    out = {}
    for name, cfg in variants.items():
        errs_all, errs_c8, rmse = [], [], []
        for plant in plants:
            if cfg is None:
                e = static_errors(plant)
                errs_all += e
                errs_c8 += e[2:]
                continue
            if cfg.get("independent"):
                for sp in core.SPECIES_ORDER:
                    f = core.fit_plant_twin(plant, train_on=[sp])
                    e = f["species"][sp]["effluent4PptDay"] - f["species"][sp]["testbenchEffluent4PptDay"]
                    errs_all.append(e)
                    if sp in ("PFOA", "PFOS"):
                        errs_c8.append(e)
                    rmse.append(f["species"][sp]["testRmsePpt"])
                continue
            f = core.fit_plant_twin(plant, config=cfg)
            e = errors_for(f)
            errs_all += e
            errs_c8 += e[2:]
            rmse += [f["species"][sp]["testRmsePpt"] for sp in core.SPECIES_ORDER]
        out[name] = {"allSpecies": stats(errs_all), "pfoaPfos": stats(errs_c8), "meanTestRmsePpt": (sum(rmse) / len(rmse)) if rmse else None}
    return out


def uncertainty_cases(plants, config=None):
    cases = []
    for plant in plants:
        f = core.fit_plant_twin(plant, config=config)
        for sp in core.SPECIES_ORDER:
            r = f["species"][sp]
            d = max(0.0, r["effluent4PptDay"] - f["lastDataDay"])
            cases.append({"err": r["effluent4PptDay"] - r["testbenchEffluent4PptDay"], "sigmaP": r["parametricSigmaDays"], "d": d, "band": r["uncertaintyBandDays"]})
    return cases


def calibrate_discrepancy(cases, z=1.96):
    needed = []
    for c in cases:
        excess = max(0.0, (abs(c["err"]) - 0.5) / z)
        needed.append(math.sqrt(max(0.0, excess * excess - c["sigmaP"] ** 2)) / max(c["d"], 1.0))
    needed.sort()
    return needed[int(math.ceil(0.95 * len(needed))) - 1]


def coverage(cases, rho, z=1.96):
    hit = 0
    for c in cases:
        band = z * math.sqrt(c["sigmaP"] ** 2 + (rho * c["d"]) ** 2) + 0.5
        hit += abs(c["err"]) <= band
    return hit / len(cases)


def operational_decisions(plant, config=None):
    """Daily decision simulation: rotate when (forecast breach - band) - today <= service lead time."""
    truth_c8 = min(core.crossing_day(lambda t, sp=sp: core.truth_concentration(plant, sp, 1.0, t), core.TARGET_PPT) for sp in ("PFOA", "PFOS"))
    static_c8 = min(core.crossing_day(lambda t, sp=sp: core.static_prior_concentration(plant, sp, 1.0, t), core.TARGET_PPT) for sp in ("PFOA", "PFOS"))
    decision = None
    for d in [0] + core.OPERATIONAL_DAYS:
        f = core.fit_plant_twin(plant, as_of_day=d, config=config)
        conservative = min(f["species"][sp]["effluent4PptDay"] - f["species"][sp]["uncertaintyBandDays"] for sp in ("PFOA", "PFOS"))
        t_star = max(float(d), math.ceil(conservative - SERVICE_LEAD_TIME_DAYS))
        if t_star < d + 15:
            decision = t_star
            break
    static_decision = max(0.0, math.ceil(static_c8 - SERVICE_LEAD_TIME_DAYS))
    return {
        "truthBreachDay": truth_c8,
        "twinDecisionDay": decision,
        "twinMarginDays": None if decision is None else truth_c8 - decision,
        "staticDecisionDay": static_decision,
        "staticMarginDays": truth_c8 - static_decision,
    }


def summarize_margins(margins):
    m = sorted(x for x in margins if x is not None)
    return {
        "n": len(m),
        "medianDays": m[len(m) // 2],
        "minDays": m[0],
        "maxDays": m[-1],
        "afterBreach": sum(1 for x in m if x < 0),
        "insideEmergency": sum(1 for x in m if x < EMERGENCY_LEAD_DAYS),
        "moreThan90DaysEarly": sum(1 for x in m if x > 90),
    }


def main():
    report, reference = build_report(QUICK, "--with-hybrid-ops" in sys.argv)
    with open(os.path.join(HERE, "validation_report.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    with open(os.path.join(HERE, "reference_outputs.json"), "w", encoding="utf-8") as fh:
        json.dump(reference, fh, indent=2)
    print("written validation_report.json and reference_outputs.json in", report["runtimeSeconds"], "s")


def build_report(quick: bool = False, with_hybrid_ops: bool = False):
    """Compute the full report and the parity fixture (used by main() and by the CI reproducibility test)."""
    t0 = time.time()
    n_plants = 6 if quick else 16
    n_ops = 4 if quick else 12
    report = {"generatedBy": "simulation/validation_report.py", "quick": quick, "twinConfig": core.TWIN_CONFIG}

    report["facilities"] = {}
    for fid, plant in FACILITIES.items():
        f = core.fit_plant_twin(plant)
        report["facilities"][fid] = {
            "plant": plant,
            "species": species_summary(f),
            "pdeResidualRms": core.pde_residual_rms(plant, f["theta"]),
            "r2All": f["r2All"],
        }
    print("facilities done", round(time.time() - t0, 1), "s")

    set_a = random_plants(1101, n_plants)
    set_b = random_plants(2202, n_plants)
    report["ablation"] = run_ablation(set_b)
    print("ablation done", round(time.time() - t0, 1), "s")

    cases_a = uncertainty_cases(set_a)
    cases_b = uncertainty_cases(set_b)
    rho = calibrate_discrepancy(cases_a)
    configured = core.TWIN_CONFIG["discrepancyPerDay"]
    report["uncertainty"] = {
        "nominal": 0.95,
        "calibratedDiscrepancyPerDay": rho,
        "configuredDiscrepancyPerDay": configured,
        "coverageCalibrationSet": coverage(cases_a, configured),
        "coverageHoldoutSet": coverage(cases_b, configured),
        "coverageHoldoutParametricOnly": coverage(cases_b, 0.0),
        "cases": len(cases_b),
    }
    print("uncertainty done", round(time.time() - t0, 1), "s", report["uncertainty"])

    ops = [operational_decisions(p) for p in set_b[:n_ops]] + [operational_decisions(p) for p in FACILITIES.values()]
    report["operational"] = {
        "plants": len(ops),
        "serviceLeadTimeDays": SERVICE_LEAD_TIME_DAYS,
        "decisions": ops,
        "twin": summarize_margins([o["twinMarginDays"] for o in ops]),
        "staticVendorCurve": summarize_margins([o["staticMarginDays"] for o in ops]),
    }
    print("operational done", round(time.time() - t0, 1), "s")

    cal = core.calibrate_edge_estimator()
    report["sensor"] = {
        "conditionNumberS": cal["conditionNumberS"],
        "determinantS": cal["determinantS"],
        "conditionNumberCalibrated": cal["conditionNumberCalibrated"],
        "lambda": cal["lambda"],
        "benchmark": {f"noise_x{k}": core.run_mixture_benchmark(cal, 200, 777, k) for k in (1, 2, 4)},
        "simulatedLodPpt": dict(zip(core.SPECIES_ORDER, core.simulated_lod_ppt(cal))),
    }
    hybrid_cfg = dict(core.EXPERIMENTAL_HYBRID_CONFIG)
    hybrid = {"config": hybrid_cfg, "coverageHoldoutSet": coverage(uncertainty_cases(set_b, hybrid_cfg), configured)}
    if with_hybrid_ops:
        hy_ops = [operational_decisions(p, hybrid_cfg) for p in set_b[:n_ops]] + [operational_decisions(p, hybrid_cfg) for p in FACILITIES.values()]
        hybrid["operational"] = summarize_margins([o["twinMarginDays"] for o in hy_ops])
    report["experimentalHybrid"] = hybrid
    print("hybrid done", round(time.time() - t0, 1), "s", hybrid)
    report["runtimeSeconds"] = round(time.time() - t0, 1)

    kk = FACILITIES["kkwwd-maine"]
    op = core.fit_plant_twin(kk, as_of_day=240)
    rnd = core.Mulberry32(12345)
    reference = {
        "prngSeed12345": [rnd() for _ in range(5)],
        "kkwwdValidation": species_summary(core.fit_plant_twin(kk)),
        "kkwwdOperationalDay240": {sp: {"effluent4PptDay": op["species"][sp]["effluent4PptDay"], "uncertaintyBandDays": op["species"][sp]["uncertaintyBandDays"]} for sp in core.SPECIES_ORDER},
        "sensorCalibration": {"conditionNumberS": cal["conditionNumberS"], "determinantS": cal["determinantS"],
                              "conditionNumberCalibrated": cal["conditionNumberCalibrated"], "lambda": cal["lambda"],
                              "sensitivityDiagonal": [cal["sensitivity"][g][g] for g in range(4)]},
        "sensorBenchmarkFullMapePct": report["sensor"]["benchmark"]["noise_x1"]["methods"]["full"]["mapePct"],
    }
    return report, reference


if __name__ == "__main__":
    main()
