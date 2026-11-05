"""Second external check: full-scale lead-lag GAC with a mid-bed (halfway) port (standard library only).

Data: Crew, A. D. (2021) "Analysis of Granular Activated Carbon Removal Efficiency of Per- and Polyfluoroalkyl
Substances in Groundwater", Penn State professional master's paper, ScholarSphere doi:10.26207/qc55-h661,
CC BY-SA 4.0. Two full-scale lead-lag GAC trains of one water system (Treatment Sites 1 and 2, coconut AquaCarb
1230CX, 285 ft3 per vessel), sampled weekly at the lead vessel's HALFWAY port and BETWEEN the vessels.
The report gives the results only as charts. The charts are vector graphics, so the points were read from the
drawing coordinates, calibrated on the chart's own gridlines and tick labels (no reading by eye); see
simulation/data/crew2021_fullscale.csv and its header. Bed volumes were estimated by the author from total gallons
(+/- 10 %); influent was sampled monthly and is given only as averages in the text.

Protocol (written before the chart data were extracted or looked at):

E4  The app's core use case on a real full-scale lead vessel: learn from the halfway port (z = 0.5), forecast the
    lead-vessel outlet (between-vessels port, z = 1) through the travelling-wave scaling of the twin.
    * Species: PFHxA (fastest short-chain tracer measured here; PFBA was not measured), PFOA, PFOS. PFBS is left
      out because its site-2 influent average is ambiguous in the text (158 ng/L is given for both PFBS and PFHxS).
      Primary score on PFOA + PFOS.
    * Influent C0 = the author's stated averages: site 1 PFHxA 21, PFOA 11, PFOS 18 ng/L; site 2 PFHxA 22,
      PFOS 172, PFOA 14 ng/L (186 combined PFOA+PFOS minus 172 PFOS).
    * Site 2 data after the media replacement (about 14,500 bed volumes) belong to a new bed and are dropped.
    * Cut-offs: 1/3 and 1/2 of each site's bed-volume record. Training data: halfway-port samples on or before
      the cut-off. Test data: between-vessels samples after the cut-off.
    * Methods (all reuse external_validation.py; the twin settings are the app's, unchanged):
        STATIC       design curve from the OTHER site (all its halfway and between-vessel data), unchanged;
        TWIN         same design curve + two shared bed-condition factors learned from the halfway port;
        INDEPENDENT  same, but each species learns its own two factors;
        MIDBED_ONLY  per-species curve fitted to the halfway-port data alone (no design curve), mapped to z = 1;
        STATIC_ASYM, TWIN_ASYM  as STATIC and TWIN with the generalized-logistic (Richards) curve of E3.
    * Scores (reference-free): RMSE on the later between-vessels samples as % of C0, and the 4 ng/L crossing at the
      lead outlet against the observed sampling interval, only where that crossing was still in the future.
E5  Physics check of the travelling-wave scaling itself (no prior, no cut-off): per species, the curve fitted to
    all halfway-port data is mapped to z = 1 and compared with the between-vessels data; a fit to the
    between-vessels data alone is the in-sample reference.

Added after the E4/E5 results (post hoc, model-free, labelled as such in the output): the first halfway-port sample
at or above 4 ng/L compared with the observed 4 ng/L interval at the lead-vessel outlet.

Usage: python simulation/external_validation_fullscale.py   (writes simulation/external_validation_fullscale.json)
"""
from __future__ import annotations

import csv
import json
import math
import os
import sys
from typing import Callable, Dict, List, Tuple

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import external_validation as ev  # noqa: E402
import pfas_sentinel_core as core  # noqa: E402

DATA_FILE = os.path.join(HERE, "data", "crew2021_fullscale.csv")
OUTPUT_FILE = os.path.join(HERE, "external_validation_fullscale.json")
SPECIES = ["PFHXA", "PFOA", "PFOS"]
PRIMARY = ["PFOA", "PFOS"]
C0 = {1: {"PFHXA": 21.0, "PFOA": 11.0, "PFOS": 18.0}, 2: {"PFHXA": 22.0, "PFOA": 14.0, "PFOS": 172.0}}
REPLACEMENT_BV = {2: 14500.0}
CUTOFF_FRACTIONS = [1 / 3, 1 / 2]
METHODS = ["STATIC", "TWIN", "INDEPENDENT", "MIDBED_ONLY", "STATIC_ASYM", "TWIN_ASYM"]
TARGET_NG_L = 4.0
KBV = 1000.0  # time unit of the fits: thousands of bed volumes

Series = List[Tuple[float, float]]  # (kBV, ng/L)


def load() -> Dict[int, Dict[str, Dict[str, Series]]]:
    out: Dict[int, Dict[str, Dict[str, Series]]] = {}
    with open(DATA_FILE, encoding="utf-8") as f:
        for r in csv.DictReader(line for line in f if not line.startswith("#")):
            site = int(r["site"])
            bv = max(0.0, float(r["bed_volumes"]))
            if bv > REPLACEMENT_BV.get(site, math.inf):
                continue
            out.setdefault(site, {}).setdefault(r["port"], {}).setdefault(r["species"], []).append((bv / KBV, float(r["ng_L"])))
    for site in out.values():
        for port in site.values():
            for sp in port:
                port[sp].sort()
    return out


def record_end(site_data: Dict[str, Dict[str, Series]]) -> float:
    return max(t for port in ("halfway", "between") for sp in SPECIES for t, _ in site_data[port][sp])


_DESIGN_CACHE: Dict[int, Dict[str, Dict]] = {}
DISPLAY_CASE = {"source": 2, "target": 1, "cutoffFraction": 0.5}


def design_curves(site_data: Dict[str, Dict[str, Series]], c0: Dict[str, float]) -> Dict[str, Dict]:
    key = id(site_data)
    if key in _DESIGN_CACHE:
        return _DESIGN_CACHE[key]
    curves = {}
    for sp in SPECIES:
        pts = [(t, y, 0.5) for t, y in site_data["halfway"][sp]] + [(t, y, 1.0) for t, y in site_data["between"][sp]]
        curves[sp] = {"sym": ev.fit_thomas(pts, c0[sp]), "asym": ev.fit_richards(pts, c0[sp])}
    _DESIGN_CACHE[key] = curves
    return curves


def midbed_lead(site_data: Dict[str, Dict[str, Series]]) -> Dict[str, Dict]:
    """Post-hoc, model-free (added after the E4 results): first halfway-port sample at or above 4 ng/L versus the
    observed 4 ng/L interval at the lead-vessel outlet."""
    out = {}
    for sp in SPECIES:
        half = next((t for t, y in site_data["halfway"][sp] if y >= TARGET_NG_L), None)
        b = ev.observed_bracket([(t, 0.0, y) for t, y in site_data["between"][sp]], TARGET_NG_L)
        hi = b["firstSampleAtOrAbove"]
        lo = b["lastSampleBelow"]
        out[sp] = {"halfwayFirst4NgLkBV": ev.r4(half) if half else None, "outletIntervalKBV": [ev.r4(lo) if lo is not None else None, ev.r4(hi) if hi else None],
                   "ratioToOutlet": ev.r4(half / hi) if half and hi else None}
    return out


def rmse(e: List[float]) -> float:
    return math.sqrt(sum(x * x for x in e) / max(1, len(e)))


def run_case(data, source: int, target: int, frac: float) -> Dict:
    tgt = data[target]
    c0 = C0[target]
    cutoff = frac * record_end(tgt)
    prior = design_curves(data[source], C0[source])
    obs = [{"sp": sp, "z": 0.5, "t": t, "y": y} for sp in SPECIES for t, y in tgt["halfway"][sp] if t <= cutoff]
    assert all(o["t"] <= cutoff for o in obs)
    ctxs = {sp: ev.context(prior[sp]["sym"]["a"], prior[sp]["sym"]["t50"], c0[sp]) for sp in SPECIES}
    cfg = dict(core.TWIN_CONFIG)
    zeros = [0.0] * core.N_PARAMS
    theta = core.train_twin(None, SPECIES, obs, cfg, ctxs)["theta"]
    pa = {sp: {"a": prior[sp]["asym"]["a"], "t0": prior[sp]["asym"]["t0"], "nu": prior[sp]["asym"]["nu"]} for sp in SPECIES}
    th_a = ev.train_shared_richards(pa, c0, obs, cfg)
    curves: Dict[str, Dict[str, Callable[[float], float]]] = {m: {} for m in METHODS}
    learned = {"TWIN": [math.exp(theta[0]), math.exp(theta[1])], "TWIN_ASYM": [math.exp(th_a[0]), math.exp(th_a[1])], "INDEPENDENT": {}}
    for sp in SPECIES:
        ctx = ctxs[sp]
        curves["STATIC"][sp] = lambda t, c=ctx: max(0.0, core.eval_twin(c, zeros, 1.0, t))
        curves["TWIN"][sp] = lambda t, c=ctx: max(0.0, core.eval_twin(c, theta, 1.0, t))
        obs_sp = [o for o in obs if o["sp"] == sp]
        th_i = core.train_twin(None, [sp], obs_sp, cfg, {sp: ctx})["theta"]
        learned["INDEPENDENT"][sp] = [math.exp(th_i[0]), math.exp(th_i[1])]
        curves["INDEPENDENT"][sp] = lambda t, c=ctx, th=th_i: max(0.0, core.eval_twin(c, th, 1.0, t))
        mid = ev.fit_thomas([(o["t"], o["y"], 0.5) for o in obs_sp], c0[sp])
        curves["MIDBED_ONLY"][sp] = lambda t, m=mid, cc=c0[sp]: cc * ev.thomas_fraction(m["a"], m["t50"], t)
        p = pa[sp]
        curves["STATIC_ASYM"][sp] = lambda t, p=p, cc=c0[sp]: cc * ev.richards_fraction(p["a"], p["t0"], p["nu"], t)
        curves["TWIN_ASYM"][sp] = lambda t, p=p, cc=c0[sp]: cc * ev.richards_fraction(
            p["a"] * math.exp(th_a[0]), p["t0"] * math.exp(th_a[1]), p["nu"], t)

    test = {sp: [(t, y) for t, y in tgt["between"][sp] if t > cutoff] for sp in SPECIES}
    methods = {}
    for m in METHODS:
        per = {}
        pooled: List[float] = []
        for sp in SPECIES:
            ne = [(curves[m][sp](t) - y) / c0[sp] for t, y in test[sp]]
            if sp in PRIMARY:
                pooled.extend(ne)
            per[sp] = {"testNrmse": ev.r4(rmse(ne)), "lead4NgLkBV": ev.r4(core.crossing_day(curves[m][sp], TARGET_NG_L, 1500))}
        methods[m] = {"species": per, "primaryTestNrmse": ev.r4(rmse(pooled))}
    four = {}
    for sp in SPECIES:
        b = ev.observed_bracket([(t, 0.0, y) for t, y in tgt["between"][sp]], TARGET_NG_L)
        lo, hi = b["lastSampleBelow"], b["firstSampleAtOrAbove"]
        if lo is None or hi is None or hi <= cutoff:
            continue
        row = {"intervalKBV": [ev.r4(lo), ev.r4(hi)]}
        row.update({m: ev.classify(methods[m]["species"][sp]["lead4NgLkBV"], lo, hi) for m in METHODS})
        four[sp] = row
    display = None
    if source == DISPLAY_CASE["source"] and target == DISPLAY_CASE["target"] and abs(frac - DISPLAY_CASE["cutoffFraction"]) < 1e-9:
        grid = [round(0.25 * i, 2) for i in range(int(4 * record_end(tgt)) + 2)]
        display = {
            "kBV": grid,
            "curves": {m: {sp: [ev.r4(curves[m][sp](t)) for t in grid] for sp in PRIMARY} for m in ("STATIC", "TWIN", "TWIN_ASYM")},
            "observed": {sp: {port: [[ev.r4(t), ev.r4(y)] for t, y in tgt[port][sp]] for port in ("halfway", "between")} for sp in PRIMARY},
        }
    return {
        "display": display,
        "source": source,
        "target": target,
        "cutoffKBV": ev.r4(cutoff),
        "cutoffFraction": ev.r4(frac),
        "trainingSamples": {sp: len([o for o in obs if o["sp"] == sp]) for sp in SPECIES},
        "testSamples": {sp: len(test[sp]) for sp in SPECIES},
        "learnedFactors": {
            "TWIN": [ev.r4(x) for x in learned["TWIN"]],
            "TWIN_ASYM": [ev.r4(x) for x in learned["TWIN_ASYM"]],
            "INDEPENDENT": {s: [ev.r4(x) for x in w] for s, w in learned["INDEPENDENT"].items()},
        },
        "methods": methods,
        "fourNgL": four,
    }


def scaling_check(data) -> Dict:
    """E5: halfway-port fit mapped to z = 1 vs the between-vessels data (no prior, no cut-off)."""
    forms = (
        ("sym", ev.fit_thomas, lambda g, t: ev.thomas_fraction(g["a"], g["t50"], t)),
        ("asym", ev.fit_richards, lambda g, t: ev.richards_fraction(g["a"], g["t0"], g["nu"], t)),
    )
    out = {}
    for site, sd in data.items():
        per = {}
        for sp in SPECIES:
            c0 = C0[site][sp]
            half = [(t, y, 0.5) for t, y in sd["halfway"][sp]]
            betw = sd["between"][sp]
            row = {}
            for form, fit, frac in forms:
                g_half = fit(half, c0)
                g_betw = fit([(t, y) for t, y in betw], c0)
                row[form] = {
                    "mappedNrmse": ev.r4(rmse([(c0 * frac(g_half, t) - y) / c0 for t, y in betw])),
                    "inSampleNrmse": ev.r4(rmse([(c0 * frac(g_betw, t) - y) / c0 for t, y in betw])),
                }
                if form == "sym":
                    row[form]["outletT50FromHalfwayKBV"] = ev.r4(g_half["t50"])
                    row[form]["outletT50FromBetweenKBV"] = ev.r4(g_betw["t50"])
            per[sp] = row
        out[str(site)] = per
    return out


def summarize(cases: List[Dict]) -> Dict:
    s: Dict = {}
    for frac in CUTOFF_FRACTIONS:
        rows = [c for c in cases if abs(c["cutoffFraction"] - ev.r4(frac)) < 1e-9]
        s[f"{frac:.3f}"] = {m: ev.r4(sum(c["methods"][m]["primaryTestNrmse"] for c in rows) / len(rows)) for m in METHODS}
    counts = {m: {"early": 0, "inside": 0, "late": 0} for m in METHODS}
    total = 0
    for c in cases:
        for sp, row in c["fourNgL"].items():
            if sp not in PRIMARY:
                continue
            total += 1
            for m in METHODS:
                counts[m][row[m]] += 1
    s["fourNgLPrimary"] = {"forecasts": total, "byMethod": counts}
    return s


def run() -> Dict:
    data = load()
    cases = [run_case(data, src, tgt, frac) for src, tgt in ((1, 2), (2, 1)) for frac in CUTOFF_FRACTIONS]
    return {
        "dataset": {
            "source": "Crew (2021), Penn State ScholarSphere doi:10.26207/qc55-h661, CC BY-SA 4.0; points read from vector charts",
            "influentNgL": {str(k): v for k, v in C0.items()},
            "recordEndKBV": {str(s): ev.r4(record_end(d)) for s, d in data.items()},
            "samples": {str(s): {port: len(d[port]["PFOA"]) for port in ("halfway", "between")} for s, d in data.items()},
        },
        "protocol": {"species": SPECIES, "primary": PRIMARY, "cutoffFractions": CUTOFF_FRACTIONS, "methods": METHODS},
        "cases": cases,
        "summary": summarize(cases),
        "scalingCheck": scaling_check(data),
        "postHocMidbedLead": {str(s): midbed_lead(d) for s, d in data.items()},
    }


def main() -> None:
    rep = run()
    with open(OUTPUT_FILE, "w", encoding="utf-8", newline="\n") as f:
        json.dump(rep, f, indent=1)
        f.write("\n")
    print(json.dumps(rep["summary"], indent=1))
    for c in rep["cases"]:
        print(c["source"], "->", c["target"], "cutoff", c["cutoffKBV"], "kBV",
              {m: c["methods"][m]["primaryTestNrmse"] for m in METHODS}, "factors", c["learnedFactors"]["TWIN"], c["fourNgL"])
    print(json.dumps(rep["scalingCheck"], indent=1))


if __name__ == "__main__":
    main()
