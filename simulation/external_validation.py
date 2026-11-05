"""External test of the breakthrough twin on real pilot data (standard library only).

Data: U.S. EPA pilot study at a New Jersey groundwater utility (Haupert et al. 2023, AWWA Water Science 5(6): e1361;
dataset https://doi.org/10.23719/1529105). Two identical Calgon F400 columns (4.07 kg, EBCT about 3.5 min) were fed
the same well water ("pre-AS" before and "post-AS" after an air stripper); effluent was sampled 18 times over 392 days.
The data were measured, not simulated, and were not used to build or tune anything else in this repository.

Protocol (fixed after looking at the raw table, before any model was fitted to it):

E1  Forecast test with a design-curve prior.
    * The twin needs species-specific starting values. A utility would take them from a pilot, an RSSCT in site water
      or the previous bed. Here the sibling column plays that role: per-species Thomas curves are fitted to ALL data
      of the source column and transferred to the target column (time scaled by the flow ratio).
    * Directions: pre-AS -> post-AS and post-AS -> pre-AS. Cut-off days: 14, 28, 42 (data on or before the
      cut-off are "known"; later samples are the test set). Species: PFBA, PFBS, PFOA, PFOS; primary score on
      PFOA + PFOS (the regulated pair).
    * Methods: STATIC (prior unchanged), TWIN (default config: two shared bed-condition factors fitted to all four
      species, exactly the training code used in the app), TWIN_HYBRID (the PINN-style option), INDEPENDENT (same
      code, each species its own two factors), DATA_ONLY (per-species Thomas fit to the early data, no prior).
    * Model influent C0 = mean measured influent on or before the cut-off (known at that time).
    * Scores: test-set RMSE normalised by the species' mean influent; error of the day the curve crosses 50 % of C0
      and 4 ng/L, against a reference curve fitted to all target data (ORACLE, in-sample, the best this model
      family can do). EPA's own fitted PSDM curve is scored in-sample for context.
      Deviation, disclosed: the 4 ng/L part was replaced after the first run (see POST_HOC_NOTE below).
E2  Clean-water prior check. The app's synthetic "vendor curve" assumes clean-water capacities are wrong only by a
    factor shared across species. Using F400 batch isotherms measured by EPA in organic-free water (Abulikemu et al.
    2025, dataset https://doi.org/10.23719/1531709) the equilibrium (stoichiometric) breakthrough day
    q_e(C0)*M/(Q*C0) is compared with the observed 50 % day for each species. If the shared-factor assumption held,
    the four ratios observed/predicted would be equal.

Limitations that apply to every number produced here: one site, one carbon, two columns fed the same water,
14-day sampling, EBCT about 3.5 min (full-scale beds use 10-20 min), no intermediate sampling port, so the twin is
tested on outlet data only (in the app it learns from a mid-bed port).

Usage: python simulation/external_validation.py        (writes simulation/external_validation.json)
"""
from __future__ import annotations

import csv
import json
import math
import os
import sys
from typing import Callable, Dict, List, Optional, Tuple

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import pfas_sentinel_core as core  # noqa: E402

PILOT_FILE = os.path.join(HERE, "data", "haupert2023_f400_pilot.csv")
ISOTHERM_FILE = os.path.join(HERE, "data", "abulikemu2025_f400_freundlich.csv")
OUTPUT_FILE = os.path.join(HERE, "external_validation.json")

SPECIES = ["PFBA", "PFBS", "PFOA", "PFOS"]
PRIMARY = ["PFOA", "PFOS"]
COLUMNS = {
    "preAS": {"label": "pre-air-stripper column", "flowLpm": 2.15, "ebctMin": 3.45},
    "postAS": {"label": "post-air-stripper column", "flowLpm": 2.07, "ebctMin": 3.58},
}
MEDIA_MASS_G = 4070.0
CUTOFF_DAYS = [14, 28, 42]
DIRECTIONS = [("preAS", "postAS"), ("postAS", "preAS")]
DISPLAY_CASE = {"source": "preAS", "target": "postAS", "cutoff": 28}
TARGET_NG_L = 4.0
METHODS = ["STATIC", "TWIN", "TWIN_HYBRID", "INDEPENDENT", "DATA_ONLY"]
LOG_A_BOUNDS = (math.log(1e-3), math.log(5.0))
LOG_T50_BOUNDS = (math.log(0.05), math.log(5000.0))
START_T50 = [0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512]
START_A = [0.01, 0.03, 0.1, 0.3, 1.0]
CURVE_DAYS = list(range(0, 401, 4))

Point = Tuple[float, float, float]  # day, influent, effluent


# ---------------------------------------------------------------------------------------------
# data
# ---------------------------------------------------------------------------------------------
def _rows(path: str) -> List[Dict[str, str]]:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(line for line in f if not line.startswith("#")))


def load_pilot() -> Dict[str, Dict[str, List[Point]]]:
    out: Dict[str, Dict[str, List[Point]]] = {}
    for r in _rows(PILOT_FILE):
        out.setdefault(r["column"], {}).setdefault(r["species"], []).append(
            (float(r["day"]), float(r["influent_ng_L"]), float(r["effluent_ng_L"]))
        )
    for col in out.values():
        for pts in col.values():
            pts.sort()
    return out


def load_psdm() -> Dict[str, Dict[float, float]]:
    out: Dict[str, Dict[float, float]] = {}
    for r in _rows(PILOT_FILE):
        if r["column"] == "preAS":
            out.setdefault(r["species"], {})[float(r["day"])] = float(r["epa_psdm_ng_L"])
    return out


def load_isotherms() -> Dict[Tuple[str, str], Tuple[float, float]]:
    return {(r["species"], r["mesh"]): (float(r["K_ugg_Lng_1n"]), float(r["one_over_n"])) for r in _rows(ISOTHERM_FILE)}


def mean_influent(points: List[Point], until_day: Optional[float] = None) -> float:
    vals = [p[1] for p in points if until_day is None or p[0] <= until_day]
    return sum(vals) / len(vals)


# ---------------------------------------------------------------------------------------------
# Thomas-form curve fitting (Levenberg-Marquardt in log parameters, multi-start, deterministic)
# ---------------------------------------------------------------------------------------------
def thomas_fraction(a: float, t50: float, t: float) -> float:
    x = core.clamp(a * (t - t50), -35.0, 35.0)
    return 1.0 / (1.0 + math.exp(-x))


def _loss(la: float, lt: float, pts: List[Tuple[float, float]], c0: float) -> float:
    a, t50 = math.exp(la), math.exp(lt)
    return sum((thomas_fraction(a, t50, t) - y / c0) ** 2 for t, y in pts) / len(pts)


def _lm(pts: List[Tuple[float, float]], c0: float, la: float, lt: float, iters: int = 200) -> Tuple[float, float, float]:
    lam = 1e-2
    cur = _loss(la, lt, pts, c0)
    for _ in range(iters):
        a, t50 = math.exp(la), math.exp(lt)
        jtj = [[0.0, 0.0], [0.0, 0.0]]
        jtr = [0.0, 0.0]
        for t, y in pts:
            s = thomas_fraction(a, t50, t)
            g = s * (1 - s)
            r = s - y / c0
            j = (g * a * (t - t50), -g * a * t50)
            for i in range(2):
                jtr[i] += j[i] * r
                for k in range(2):
                    jtj[i][k] += j[i] * j[k]
        improved = False
        for _ in range(12):
            m = [[jtj[0][0] * (1 + lam) + 1e-12, jtj[0][1]], [jtj[1][0], jtj[1][1] * (1 + lam) + 1e-12]]
            det = m[0][0] * m[1][1] - m[0][1] * m[1][0]
            if abs(det) < 1e-300:
                lam *= 10
                continue
            d0 = (m[1][1] * jtr[0] - m[0][1] * jtr[1]) / det
            d1 = (-m[1][0] * jtr[0] + m[0][0] * jtr[1]) / det
            nla = core.clamp(la - d0, *LOG_A_BOUNDS)
            nlt = core.clamp(lt - d1, *LOG_T50_BOUNDS)
            new = _loss(nla, nlt, pts, c0)
            if new < cur:
                la, lt, cur = nla, nlt, new
                lam = max(lam / 3, 1e-9)
                improved = True
                break
            lam *= 4
        if not improved or cur < 1e-14:
            break
    return la, lt, cur


def fit_thomas(pts: List[Tuple[float, float]], c0: float) -> Dict[str, float]:
    best: Optional[Tuple[float, float, float]] = None
    for t50 in START_T50:
        for a in START_A:
            res = _lm(pts, c0, math.log(a), math.log(t50))
            if best is None or res[2] < best[2] - 1e-15:
                best = res
    assert best is not None
    return {"a": math.exp(best[0]), "t50": math.exp(best[1]), "loss": best[2]}


# ---------------------------------------------------------------------------------------------
# twin contexts: the app's model c = C0*sigma(k*q*M*z/Q - k*C0*t) with k = a/C0, q = t50*C0, M = Q = 1
# ---------------------------------------------------------------------------------------------
def context(a: float, t50: float, c0: float) -> Dict[str, float]:
    return {"C0": c0, "qn": 1.0, "M": 1.0, "k0": a / c0, "q0": t50 * c0}


def crossing(fn: Callable[[float], float], level: float) -> float:
    return core.crossing_day(fn, level, 1500)


def _rmse(errors: List[float]) -> float:
    return math.sqrt(sum(e * e for e in errors) / max(1, len(errors)))


def r4(x: float) -> float:
    return float(f"{x:.4g}")


POST_HOC_NOTE = (
    "The protocol scored the 4 ng/L crossing day against the ORACLE curve. After the first run that reference proved "
    "invalid: a symmetric curve fitted to all data puts PFOS above 4 ng/L at day 0, while the samples stay below "
    "4 ng/L until day 14. The comparison was therefore replaced, after seeing results, by a check against the observed "
    "sampling interval (last sample below 4 ng/L, first sample at or above), only where the crossing was still in the "
    "future at the cut-off. early = forecast on or before the last sample below; late = after the first sample above."
)


def classify(pred: float, lo: float, hi: float) -> str:
    if pred <= lo:
        return "early"
    if pred > hi:
        return "late"
    return "inside"


def observed_bracket(points: List[Point], level: float) -> Dict[str, Optional[float]]:
    below = [p[0] for p in points if p[2] < level]
    above = [p[0] for p in points if p[2] >= level]
    first_above = min(above) if above else None
    last_below_before = max([d for d in below if first_above is None or d < first_above], default=None)
    return {"lastSampleBelow": last_below_before, "firstSampleAtOrAbove": first_above}


# ---------------------------------------------------------------------------------------------
# E1
# ---------------------------------------------------------------------------------------------
def column_reference(points: Dict[str, List[Point]]) -> Dict[str, Dict[str, float]]:
    """Per-species Thomas fit to ALL data of one column (design-curve prior when it is the source,
    in-sample ORACLE reference when it is the target)."""
    ref = {}
    for sp in SPECIES:
        pts = points[sp]
        c0 = mean_influent(pts)
        fit = fit_thomas([(p[0], p[2]) for p in pts], c0)
        fit["C0"] = c0
        ref[sp] = fit
    return ref


def run_case(data: Dict[str, Dict[str, List[Point]]], refs: Dict[str, Dict[str, Dict[str, float]]], source: str, target: str,
             cutoff: float, keep_curves: bool = False) -> Dict:
    tgt = data[target]
    flow_ratio = COLUMNS[source]["flowLpm"] / COLUMNS[target]["flowLpm"]
    c0_model = {sp: mean_influent(tgt[sp], cutoff) for sp in SPECIES}
    ctxs = {sp: context(refs[source][sp]["a"], refs[source][sp]["t50"] * flow_ratio, c0_model[sp]) for sp in SPECIES}
    obs = [{"sp": sp, "z": 1.0, "t": p[0], "y": p[2]} for sp in SPECIES for p in tgt[sp] if p[0] <= cutoff]
    assert all(o["t"] <= cutoff for o in obs)

    zeros = [0.0] * core.N_PARAMS
    curves: Dict[str, Dict[str, Callable[[float], float]]] = {m: {} for m in METHODS + ["ORACLE"]}
    learned: Dict[str, Dict] = {}

    cfg = dict(core.TWIN_CONFIG)
    tr = core.train_twin(None, SPECIES, obs, cfg, ctxs)
    theta = tr["theta"]
    learned["TWIN"] = {"kineticFactor": math.exp(theta[0]), "capacityFactor": math.exp(theta[1])}
    cfg_h = dict(core.TWIN_CONFIG)
    cfg_h.update(core.EXPERIMENTAL_HYBRID_CONFIG)
    theta_h = core.train_twin(None, SPECIES, obs, cfg_h, ctxs)["theta"]
    learned["INDEPENDENT"] = {}
    for sp in SPECIES:
        ctx = ctxs[sp]
        curves["STATIC"][sp] = lambda t, c=ctx: max(0.0, core.eval_twin(c, zeros, 1.0, t))
        curves["TWIN"][sp] = lambda t, c=ctx: max(0.0, core.eval_twin(c, theta, 1.0, t))
        curves["TWIN_HYBRID"][sp] = lambda t, c=ctx: max(0.0, core.eval_twin(c, theta_h, 1.0, t))
        obs_sp = [o for o in obs if o["sp"] == sp]
        th_i = core.train_twin(None, [sp], obs_sp, cfg, {sp: ctx})["theta"]
        learned["INDEPENDENT"][sp] = {"kineticFactor": math.exp(th_i[0]), "capacityFactor": math.exp(th_i[1])}
        curves["INDEPENDENT"][sp] = lambda t, c=ctx, th=th_i: max(0.0, core.eval_twin(c, th, 1.0, t))
        d = fit_thomas([(o["t"], o["y"]) for o in obs_sp], c0_model[sp])
        curves["DATA_ONLY"][sp] = lambda t, d=d, c0=c0_model[sp]: c0 * thomas_fraction(d["a"], d["t50"], t)
        o = refs[target][sp]
        curves["ORACLE"][sp] = lambda t, o=o: o["C0"] * thomas_fraction(o["a"], o["t50"], t)

    test_points = {sp: [p for p in tgt[sp] if p[0] > cutoff] for sp in SPECIES}
    c0_eval = {sp: mean_influent(tgt[sp]) for sp in SPECIES}
    out_methods: Dict[str, Dict] = {}
    for m in METHODS + ["ORACLE"]:
        per = {}
        pooled: List[float] = []
        for sp in SPECIES:
            fn = curves[m][sp]
            errs = [fn(p[0]) - p[2] for p in test_points[sp]]
            nerrs = [e / c0_eval[sp] for e in errs]
            if sp in PRIMARY:
                pooled.extend(nerrs)
            c0_line = c0_model[sp] if m != "ORACLE" else refs[target][sp]["C0"]
            per[sp] = {
                "testRmseNgL": r4(_rmse(errs)),
                "testNrmse": r4(_rmse(nerrs)),
                "day50": r4(crossing(fn, 0.5 * c0_line)),
                "day4NgL": r4(crossing(fn, TARGET_NG_L)),
            }
        out_methods[m] = {"species": per, "primaryTestNrmse": r4(_rmse(pooled))}

    for m in METHODS:
        for sp in SPECIES:
            row = out_methods[m]["species"][sp]
            ref_row = out_methods["ORACLE"]["species"][sp]
            row["day50Error"] = r4(row["day50"] - ref_row["day50"])
        out_methods[m]["primaryAbsDay50Error"] = r4(sum(abs(out_methods[m]["species"][sp]["day50Error"]) for sp in PRIMARY) / len(PRIMARY))

    # Post-hoc (added after the first run, see POST_HOC_NOTE): 4 ng/L forecasts are scored against the observed
    # sampling interval, only where the crossing had not yet been observed at the cut-off.
    brackets = {sp: observed_bracket(tgt[sp], TARGET_NG_L) for sp in SPECIES}
    genuine = [sp for sp in SPECIES if brackets[sp]["firstSampleAtOrAbove"] is not None and brackets[sp]["lastSampleBelow"] is not None
               and brackets[sp]["firstSampleAtOrAbove"] > cutoff]
    four = {}
    for sp in genuine:
        lo, hi = brackets[sp]["lastSampleBelow"], brackets[sp]["firstSampleAtOrAbove"]
        row = {m: classify(out_methods[m]["species"][sp]["day4NgL"], lo, hi) for m in METHODS}
        u = core.breach_uncertainty(None, theta, obs, cfg, sp, 1.0, TARGET_NG_L, ctxs)
        d4 = out_methods["TWIN"]["species"][sp]["day4NgL"]
        row["twinBandDays"] = r4(u["bandDays"])
        row["twinBandOverlapsInterval"] = (d4 + u["bandDays"] > lo) and (d4 - u["bandDays"] <= hi)
        four[sp] = row

    case = {
        "source": source,
        "target": target,
        "cutoffDay": cutoff,
        "trainingSamplesPerSpecies": len([p for p in tgt["PFOA"] if p[0] <= cutoff]),
        "testSamplesPerSpecies": len(test_points["PFOA"]),
        "modelC0NgL": {sp: r4(c0_model[sp]) for sp in SPECIES},
        "learned": {
            "TWIN": {k: r4(v) for k, v in learned["TWIN"].items()},
            "INDEPENDENT": {sp: {k: r4(v) for k, v in learned["INDEPENDENT"][sp].items()} for sp in SPECIES},
        },
        "methods": out_methods,
        "observed4NgLBracket": brackets,
        "postHoc4NgL": four,
    }
    if keep_curves:
        case["curves"] = {
            m: {sp: [r4(curves[m][sp](t)) for t in CURVE_DAYS] for sp in SPECIES} for m in ["STATIC", "TWIN", "DATA_ONLY", "ORACLE"]
        }
        case["curveDays"] = CURVE_DAYS
        case["observed"] = {sp: [{"day": p[0], "effluent": p[2], "influent": p[1], "known": p[0] <= cutoff} for p in tgt[sp]] for sp in SPECIES}
    return case


def summarize(cases: List[Dict]) -> Dict:
    summary = {}
    for cutoff in CUTOFF_DAYS:
        rows = [c for c in cases if c["cutoffDay"] == cutoff]
        summary[str(cutoff)] = {
            m: {
                "meanPrimaryTestNrmse": r4(sum(c["methods"][m]["primaryTestNrmse"] for c in rows) / len(rows)),
                "meanPrimaryAbsDay50Error": r4(sum(c["methods"][m]["primaryAbsDay50Error"] for c in rows) / len(rows)),
            }
            for m in METHODS
        }
        summary[str(cutoff)]["ORACLE"] = {"meanPrimaryTestNrmse": r4(sum(c["methods"]["ORACLE"]["primaryTestNrmse"] for c in rows) / len(rows))}
    counts = {m: {"early": 0, "inside": 0, "late": 0} for m in METHODS}
    overlaps = 0
    total = 0
    for c in cases:
        for sp, row in c["postHoc4NgL"].items():
            total += 1
            overlaps += 1 if row["twinBandOverlapsInterval"] else 0
            for m in METHODS:
                counts[m][row[m]] += 1
    summary["postHoc4NgL"] = {"forecasts": total, "byMethod": counts, "twinBandOverlaps": overlaps, "note": POST_HOC_NOTE}
    return summary


# ---------------------------------------------------------------------------------------------
# context scores and E2
# ---------------------------------------------------------------------------------------------
def in_sample_scores(data: Dict[str, Dict[str, List[Point]]], refs: Dict[str, Dict[str, Dict[str, float]]]) -> Dict:
    psdm = load_psdm()
    out = {}
    for col in COLUMNS:
        per = {}
        for sp in SPECIES:
            pts = data[col][sp]
            c0 = mean_influent(pts)
            o = refs[col][sp]
            twin_err = [(o["C0"] * thomas_fraction(o["a"], o["t50"], p[0]) - p[2]) / c0 for p in pts]
            psdm_err = [(psdm[sp][p[0]] - p[2]) / c0 for p in pts]
            per[sp] = {"thomasNrmse": r4(_rmse(twin_err)), "epaPsdmNrmse": r4(_rmse(psdm_err)),
                       "thomasA": r4(o["a"]), "thomasDay50": r4(o["t50"])}
        out[col] = per
    rep = {}
    for sp in SPECIES:
        a = {p[0]: p[2] for p in data["preAS"][sp]}
        b = {p[0]: p[2] for p in data["postAS"][sp]}
        c0 = mean_influent(data["preAS"][sp])
        rep[sp] = r4(_rmse([(a[d] - b[d]) / c0 for d in sorted(a)]))
    out["columnToColumnNrmse"] = rep
    return out


def clean_water_check(data: Dict[str, Dict[str, List[Point]]], refs: Dict[str, Dict[str, Dict[str, float]]]) -> Dict:
    iso = load_isotherms()
    q_lpd = COLUMNS["preAS"]["flowLpm"] * 1440.0
    out: Dict[str, Dict] = {}
    for mesh in ("200x325", "60x100"):
        rows = {}
        for sp in SPECIES:
            if (sp, mesh) not in iso:
                continue
            k, n = iso[(sp, mesh)]
            c0 = mean_influent(data["preAS"][sp])
            qe = k * c0 ** n  # ug/g
            day_cw = qe * 1000.0 * MEDIA_MASS_G / (q_lpd * c0)
            observed = 0.5 * (refs["preAS"][sp]["t50"] + refs["postAS"][sp]["t50"] * COLUMNS["postAS"]["flowLpm"] / COLUMNS["preAS"]["flowLpm"])
            rows[sp] = {"qeUgPerG": r4(qe), "cleanWaterDay50": r4(day_cw), "observedDay50": r4(observed), "ratioObservedToClean": r4(observed / day_cw)}
        ratios = [v["ratioObservedToClean"] for v in rows.values()]
        out[mesh] = {"species": rows, "ratioSpread": r4(max(ratios) / min(ratios)) if ratios else None}
    return out


def run(keep_display_curves: bool = True) -> Dict:
    data = load_pilot()
    refs = {col: column_reference(data[col]) for col in COLUMNS}
    cases = []
    for source, target in DIRECTIONS:
        for cutoff in CUTOFF_DAYS:
            keep = keep_display_curves and source == DISPLAY_CASE["source"] and target == DISPLAY_CASE["target"] and cutoff == DISPLAY_CASE["cutoff"]
            cases.append(run_case(data, refs, source, target, cutoff, keep))
    return {
        "dataset": {
            "publication": "Haupert et al. (2023) AWWA Water Science 5(6): e1361, doi:10.1002/aws2.1361",
            "data": "U.S. EPA ScienceHub doi:10.23719/1529105 (sheets Fig3_preAS, Fig3_postAS, Fig3_model)",
            "isotherms": "Abulikemu et al. (2025) Water Research 271: 122977; EPA ScienceHub doi:10.23719/1531709",
            "columns": COLUMNS,
            "mediaMassG": MEDIA_MASS_G,
            "samplingDays": [p[0] for p in data["preAS"]["PFOA"]],
            "meanInfluentNgL": {sp: r4(mean_influent(data["preAS"][sp])) for sp in SPECIES},
        },
        "protocol": {
            "cutoffDays": CUTOFF_DAYS,
            "directions": [list(d) for d in DIRECTIONS],
            "species": SPECIES,
            "primarySpecies": PRIMARY,
            "methods": METHODS,
            "displayCase": DISPLAY_CASE,
            "twinConfig": "TWIN_CONFIG (default) and TWIN_CONFIG + EXPERIMENTAL_HYBRID_CONFIG, unchanged from the app",
        },
        "inSample": in_sample_scores(data, refs),
        "cases": cases,
        "summary": summarize(cases),
        "cleanWaterPrior": clean_water_check(data, refs),
    }


def main() -> None:
    report = run()
    with open(OUTPUT_FILE, "w", encoding="utf-8", newline="\n") as f:
        json.dump(report, f, indent=1)
        f.write("\n")
    s = report["summary"]
    print("mean primary (PFOA+PFOS) test nRMSE | mean |day50 error| (days)")
    for cutoff in CUTOFF_DAYS:
        row = s[str(cutoff)]
        print(f"cut-off day {cutoff}: " + "; ".join(f"{m} {row[m]['meanPrimaryTestNrmse']} | {row[m]['meanPrimaryAbsDay50Error']}" for m in METHODS)
              + f"; ORACLE {row['ORACLE']['meanPrimaryTestNrmse']}")
    print("post-hoc 4 ng/L check:", {k: v for k, v in s["postHoc4NgL"].items() if k != "note"})
    for mesh, v in report["cleanWaterPrior"].items():
        print("clean-water prior", mesh, {sp: r["ratioObservedToClean"] for sp, r in v["species"].items()}, "spread", v["ratioSpread"])
    print("in-sample nRMSE thomas vs EPA PSDM:", {c: {sp: (v["thomasNrmse"], v["epaPsdmNrmse"]) for sp, v in report["inSample"][c].items()} for c in COLUMNS})
    print("column-to-column nRMSE:", report["inSample"]["columnToColumnNrmse"])
    print("wrote", OUTPUT_FILE)


if __name__ == "__main__":
    main()
