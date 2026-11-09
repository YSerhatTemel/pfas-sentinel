"""Third external check: anion-exchange lead-lag columns of Smith et al. (2026) (standard library only).

Protocol: simulation/protocols/smith2026_aex_protocol.md (registered in commit 81c12c8 before the data were opened;
amendment A1 in commit 3f734ea, before any model was fitted). This script implements it without changes; the few
implementation choices the protocol leaves open are listed in IMPLEMENTATION_NOTES and in the output JSON.

Data: simulation/data/smith2026_aex_columns.csv (U.S. EPA ScienceHub doi:10.23719/1532427, U.S. public domain).
Four duplicate pairs of lead-lag trains of Purolite PFA694E gel resin fed a controlled influent (about 500 ng/L of each
PFAS) without (-NOM) or with (+NOM) 2 mg C/L Ohio River NOM. The lead-column effluent is the twin's mid-bed port
(z_p = 0.5 in Experiment 1, 0.6 in Experiment 2, by resin mass), the lag-column effluent its outlet (z = 1). Values are
C/C0 as published (C0 = 1 in the model, amendment A1); time is run time in days.

E6  Forecast the outlet from the port with a starting curve from the duplicate train (8 cases, 4 cut-offs).
E7  Can factors learned from PFBA and PFHxA carry the NOM effect to PFOA? (-NOM starting curve, +NOM target; 4 cases.)
E8  Does the front keep its shape between the port and the outlet? (Separate fits, no prior, no cut-off.)

Usage: python simulation/external_validation_aex.py   (writes simulation/external_validation_aex.json)
"""
from __future__ import annotations

import csv
import json
import math
import os
import statistics
import sys
from typing import Callable, Dict, List, Optional, Tuple

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import external_validation as ev  # noqa: E402
import pfas_sentinel_core as core  # noqa: E402

DATA_FILE = os.path.join(HERE, "data", "smith2026_aex_columns.csv")
OUTPUT_FILE = os.path.join(HERE, "external_validation_aex.json")
SPECIES = ["PFBA", "PFHXA", "PFBS", "PFOA", "PFNA"]
PRIMARY = "PFOA"
TRACERS = ["PFBA", "PFHXA"]
Z_PORT = {1: 0.5, 2: 0.6}
NOMS = ["-NOM", "+NOM"]
METHODS = ["STATIC", "TWIN", "INDEPENDENT", "MIDBED_ONLY", "STATIC_ASYM", "TWIN_ASYM", "STATIC_OUTLET_ASYM", "TWOPOINT_ASYM"]
SECONDARY_VARIANT_METHODS = ["TWIN", "TWIN_ASYM", "TWOPOINT_ASYM"]
CUTOFFS = ["K1", "K2", "K3", "K4"]
LEVELS = {"S1": 0.10, "S3": 0.50}
HORIZON_D = 3000
LATE_ALLOWED = 2

IMPLEMENTATION_NOTES = [
    "C0 = 1: values are C/C0 as published (amendment A1); RMSE is therefore already a fraction of C0.",
    "A curve fitted to one sampling point alone (STATIC_OUTLET_ASYM, TWOPOINT_ASYM, E8) needs at least 2 samples at that "
    "point; otherwise the method has no curve for that species and the species is left out of the pooled S2 score "
    "(PFOA, the primary species, has at least 26 samples at every point of every train).",
    "Pooled S2 uses only species for which every method has a curve and the case has test samples.",
    "Reference scatter: PFOA outlet samples of one replicate against the other replicate's outlet series linearly "
    "interpolated at the same run time (only inside the other series' time range), both directions pooled, per "
    "experiment and NOM condition; the decision rule uses the mean over the four conditions.",
    "Secondary variant (port + outlet samples up to the cut-off) is run for TWIN, TWIN_ASYM and TWOPOINT_ASYM.",
    "Crossings are searched on whole days up to 3000 days, then bisected (core.crossing_day); a forecast that never "
    "crosses in that window is reported as 3000 and classified as late.",
]

Series = List[Tuple[float, float]]
Train = Tuple[int, str, int]  # (experiment, nom, replicate)


def load(exclude_outliers: bool = False) -> Dict[Train, Dict[str, Dict[str, Series]]]:
    out: Dict[Train, Dict[str, Dict[str, Series]]] = {}
    with open(DATA_FILE, encoding="utf-8") as f:
        for r in csv.DictReader(line for line in f if not line.startswith("#")):
            if r["species"] not in SPECIES or (exclude_outliers and r["outlier"] == "1"):
                continue
            key = (int(r["experiment"]), r["nom"], int(r["replicate"]))
            tr = out.setdefault(key, {"lead": {s: [] for s in SPECIES}, "lag": {s: [] for s in SPECIES}})
            tr[r["point"]][r["species"]].append((float(r["time_d"]), float(r["c_over_c0"])))
    for tr in out.values():
        for pt in tr.values():
            for s in pt:
                pt[s].sort()
    return out


def record_end(tr: Dict[str, Dict[str, Series]]) -> float:
    return max(t for pt in tr.values() for s in SPECIES for t, _ in pt[s])


def rmse(e: List[float]) -> float:
    return math.sqrt(sum(x * x for x in e) / max(1, len(e)))


def richards(g: Dict[str, float]) -> Callable[[float], float]:
    return lambda t: ev.richards_fraction(g["a"], g["t0"], g["nu"], t)


def richards_t50(g: Dict[str, float]) -> float:
    nu = g["nu"]
    return g["t0"] - math.log((2.0 ** nu - 1.0) / nu) / g["a"]


def crossing(fn: Callable[[float], float], level: float) -> float:
    return core.crossing_day(fn, level, HORIZON_D)


_DESIGN: Dict[Tuple, Dict[str, Dict]] = {}


def design(data, key: Train, tag: str) -> Dict[str, Dict]:
    """Starting curves from ALL data of a source train."""
    ck = (key, tag)
    if ck in _DESIGN:
        return _DESIGN[ck]
    tr = data[key]
    zp = Z_PORT[key[0]]
    out = {}
    for sp in SPECIES:
        joint = [(t, y, zp) for t, y in tr["lead"][sp]] + [(t, y, 1.0) for t, y in tr["lag"][sp]]
        out[sp] = {
            "sym": ev.fit_thomas(joint, 1.0),
            "asym": ev.fit_richards(joint, 1.0),
            "port": ev.fit_richards(tr["lead"][sp], 1.0) if len(tr["lead"][sp]) >= 2 else None,
            "outlet": ev.fit_richards(tr["lag"][sp], 1.0) if len(tr["lag"][sp]) >= 2 else None,
        }
    _DESIGN[ck] = out
    return out


def cutoff_time(tr, which: str) -> Optional[float]:
    if which in ("K1", "K2"):
        level = 0.10 if which == "K1" else 0.50
        return next((t for t, y in tr["lead"][PRIMARY] if y >= level), None)
    return (1 / 3 if which == "K3" else 1 / 2) * record_end(tr)


def classify_crossing(series: Series, fn: Callable[[float], float], level: float, cutoff: float) -> Optional[Dict]:
    """Forecast crossing vs the observed sampling interval; only where the crossing was still open at the cut-off."""
    b = ev.observed_bracket([(t, 0.0, y) for t, y in series], level)
    lo, hi = b["lastSampleBelow"], b["firstSampleAtOrAbove"]
    if lo is None or hi is None or hi <= cutoff:
        return None
    pred = crossing(fn, level)
    return {"intervalD": [ev.r4(lo), ev.r4(hi)], "forecastD": ev.r4(pred), "class": ev.classify(pred, lo, hi)}


def fit_methods(prior: Dict[str, Dict], obs: List[Dict], zp: float, with_outlet_obs: bool = False) -> Tuple[Dict, Dict]:
    """Outlet curves (z = 1) of every method from the starting curves and the training samples."""
    cfg = dict(core.TWIN_CONFIG)
    zeros = [0.0] * core.N_PARAMS
    c0 = {sp: 1.0 for sp in SPECIES}
    ctxs = {sp: ev.context(prior[sp]["sym"]["a"], prior[sp]["sym"]["t50"], 1.0) for sp in SPECIES}
    theta = core.train_twin(None, SPECIES, obs, cfg, ctxs)["theta"]
    pa = {sp: {k: prior[sp]["asym"][k] for k in ("a", "t0", "nu")} for sp in SPECIES}
    th_a = ev.train_shared_richards(pa, c0, obs, cfg)
    # TWOPOINT: port samples against the source port curves, outlet samples (secondary variant) against the source
    # outlet curves; z = 1 in both because each curve was fitted at its own sampling point.
    tp_priors, tp_c0, tp_obs = {}, {}, []
    for o in obs:
        g = prior[o["sp"]]["port" if o["z"] < 1 else "outlet"]
        if g is None:
            continue
        k = o["sp"] + ("@port" if o["z"] < 1 else "@outlet")
        tp_priors[k] = {x: g[x] for x in ("a", "t0", "nu")}
        tp_c0[k] = 1.0
        tp_obs.append({"sp": k, "t": o["t"], "y": o["y"]})
    th_tp = ev.train_shared_richards(tp_priors, tp_c0, tp_obs, cfg) if tp_obs else [0.0, 0.0]
    curves: Dict[str, Dict[str, Optional[Callable[[float], float]]]] = {m: {} for m in METHODS}
    learned = {"TWIN": [ev.r4(math.exp(theta[0])), ev.r4(math.exp(theta[1]))],
               "TWIN_ASYM": [ev.r4(math.exp(th_a[0])), ev.r4(math.exp(th_a[1]))],
               "TWOPOINT_ASYM": [ev.r4(math.exp(th_tp[0])), ev.r4(math.exp(th_tp[1]))], "INDEPENDENT": {}}
    for sp in SPECIES:
        ctx = ctxs[sp]
        curves["STATIC"][sp] = lambda t, c=ctx: max(0.0, core.eval_twin(c, zeros, 1.0, t))
        curves["TWIN"][sp] = lambda t, c=ctx: max(0.0, core.eval_twin(c, theta, 1.0, t))
        p = pa[sp]
        curves["STATIC_ASYM"][sp] = lambda t, p=p: ev.richards_fraction(p["a"], p["t0"], p["nu"], t)
        curves["TWIN_ASYM"][sp] = lambda t, p=p: ev.richards_fraction(p["a"] * math.exp(th_a[0]), p["t0"] * math.exp(th_a[1]), p["nu"], t)
        g = prior[sp]["outlet"]
        curves["STATIC_OUTLET_ASYM"][sp] = richards(g) if g else None
        curves["TWOPOINT_ASYM"][sp] = (lambda t, g=g: ev.richards_fraction(g["a"] * math.exp(th_tp[0]), g["t0"] * math.exp(th_tp[1]), g["nu"], t)) if g else None
        if with_outlet_obs:
            continue
        obs_sp = [o for o in obs if o["sp"] == sp]
        if obs_sp:
            th_i = core.train_twin(None, [sp], obs_sp, cfg, {sp: ctx})["theta"]
            learned["INDEPENDENT"][sp] = [ev.r4(math.exp(th_i[0])), ev.r4(math.exp(th_i[1]))]
            curves["INDEPENDENT"][sp] = lambda t, c=ctx, th=th_i: max(0.0, core.eval_twin(c, th, 1.0, t))
        else:
            curves["INDEPENDENT"][sp] = curves["STATIC"][sp]
        port_obs = [(o["t"], o["y"], zp) for o in obs_sp if o["z"] < 1]
        if len(port_obs) >= 2:
            mid = ev.fit_thomas(port_obs, 1.0)
            curves["MIDBED_ONLY"][sp] = lambda t, m=mid: ev.thomas_fraction(m["a"], m["t50"], t)
        else:
            curves["MIDBED_ONLY"][sp] = None
    return curves, learned


def score(curves, methods: List[str], tgt, cutoff: float) -> Dict:
    test = {sp: [(t, y) for t, y in tgt["lag"][sp] if t > cutoff] for sp in SPECIES}
    common = [sp for sp in SPECIES if test[sp] and all(curves[m].get(sp) for m in methods)]
    out = {}
    for m in methods:
        per = {}
        pooled: List[float] = []
        for sp in SPECIES:
            fn = curves[m].get(sp)
            if fn is None:
                per[sp] = None
                continue
            ne = [fn(t) - y for t, y in test[sp]]
            if sp in common:
                pooled.extend(ne)
            row = {"S2": ev.r4(rmse(ne)) if ne else None}
            for name, level in LEVELS.items():
                row[name] = classify_crossing(tgt["lag"][sp], fn, level, cutoff)
            per[sp] = row
        out[m] = {"species": per, "S2primary": per[PRIMARY]["S2"], "S2pooled": ev.r4(rmse(pooled)), "pooledSpecies": common}
    return out


def e6_case(data, src: Train, tgt_key: Train, which: str, tag: str) -> Dict:
    tgt = data[tgt_key]
    zp = Z_PORT[tgt_key[0]]
    cutoff = cutoff_time(tgt, which)
    base = {"source": list(src), "target": list(tgt_key), "cutoff": which}
    if cutoff is None:
        return {**base, "noCase": "cut-off event does not occur in the target train"}
    prior = design(data, src, tag)
    obs = [{"sp": sp, "z": zp, "t": t, "y": y} for sp in SPECIES for t, y in tgt["lead"][sp] if t <= cutoff]
    assert obs and all(o["t"] <= cutoff for o in obs)
    curves, learned = fit_methods(prior, obs, zp)
    res = {**base, "cutoffD": ev.r4(cutoff), "trainingSamples": {sp: len([o for o in obs if o["sp"] == sp]) for sp in SPECIES},
           "testSamples": {sp: len([1 for t, _ in tgt["lag"][sp] if t > cutoff]) for sp in SPECIES},
           "learnedFactors": learned, "methods": score(curves, METHODS, tgt, cutoff)}
    obs2 = obs + [{"sp": sp, "z": 1.0, "t": t, "y": y} for sp in SPECIES for t, y in tgt["lag"][sp] if t <= cutoff]
    curves2, learned2 = fit_methods(prior, obs2, zp, with_outlet_obs=True)
    res["secondaryVariant"] = {"learnedFactors": {m: learned2[m] for m in SECONDARY_VARIANT_METHODS},
                               "methods": score(curves2, SECONDARY_VARIANT_METHODS, tgt, cutoff)}
    return res


def reference_scatter(data) -> Dict:
    out = {}
    for exp in (1, 2):
        for nom in NOMS:
            a, b = data[(exp, nom, 1)]["lag"][PRIMARY], data[(exp, nom, 2)]["lag"][PRIMARY]
            diffs = []
            for s1, s2 in ((a, b), (b, a)):
                for t, y in s1:
                    if s2[0][0] <= t <= s2[-1][0]:
                        j = next(i for i in range(1, len(s2)) if s2[i][0] >= t) if t > s2[0][0] else 1
                        (t0, y0), (t1, y1) = s2[j - 1], s2[j]
                        yi = y0 if t1 == t0 else y0 + (y1 - y0) * (t - t0) / (t1 - t0)
                        diffs.append(yi - y)
            out[f"{exp}{nom}"] = ev.r4(rmse(diffs))
    out["mean"] = ev.r4(statistics.mean(v for k, v in out.items()))
    return out


def e6(data, tag: str) -> Dict:
    cases = []
    for exp in (1, 2):
        for nom in NOMS:
            for s, t in ((1, 2), (2, 1)):
                for which in CUTOFFS:
                    cases.append(e6_case(data, (exp, nom, s), (exp, nom, t), which, tag))
    scatter = reference_scatter(data)
    summary = {}
    for which in CUTOFFS:
        rows = [c for c in cases if c["cutoff"] == which and "methods" in c]
        s = {"cases": len(rows), "noCase": len([c for c in cases if c["cutoff"] == which and "noCase" in c]), "byMethod": {}}
        for m in METHODS:
            vals = [c["methods"][m]["S2primary"] for c in rows if c["methods"][m]["S2primary"] is not None]
            entry = {"meanS2primary": ev.r4(statistics.mean(vals)) if vals else None,
                     "meanS2pooled": ev.r4(statistics.mean(c["methods"][m]["S2pooled"] for c in rows)) if rows else None}
            for name in LEVELS:
                cnt = {"early": 0, "inside": 0, "late": 0}
                for c in rows:
                    r = c["methods"][m]["species"][PRIMARY]
                    if r and r[name]:
                        cnt[r[name]["class"]] += 1
                entry[name] = cnt
            s["byMethod"][m] = entry
        summary[which] = s
    k1 = summary["K1"]["byMethod"]
    late = {m: k1[m]["S1"]["late"] for m in METHODS}
    open_n = sum(k1["TWIN_ASYM"]["S1"].values())
    s2_gap = None
    if k1["TWIN_ASYM"]["meanS2primary"] is not None and k1["STATIC_ASYM"]["meanS2primary"] is not None:
        s2_gap = ev.r4(k1["TWIN_ASYM"]["meanS2primary"] - k1["STATIC_ASYM"]["meanS2primary"])
    twin_pass = late["TWIN_ASYM"] <= LATE_ALLOWED and s2_gap is not None and s2_gap <= scatter["mean"]
    twopoint_fix = late["TWOPOINT_ASYM"] <= LATE_ALLOWED and late["TWOPOINT_ASYM"] < late["TWIN_ASYM"]
    verdict = {"openPfoaS1CasesAtK1": open_n, "lateAtK1": late, "twinAsymMinusStaticAsymMeanS2": s2_gap,
               "referenceScatterMean": scatter["mean"], "travellingWaveTwinPasses": twin_pass, "twopointCountsAsFix": twopoint_fix}
    return {"cases": cases, "referenceScatter": scatter, "summary": summary, "verdict": verdict}


def e7(data, tag: str) -> Dict:
    cases = []
    for exp in (1, 2):
        zp = Z_PORT[exp]
        for rep in (1, 2):
            src, tk = (exp, "-NOM", rep), (exp, "+NOM", rep)
            tgt = data[tk]
            cutoff = next((t for t, y in tgt["lead"]["PFHXA"] if y >= 0.90), None)
            if cutoff is None:
                cases.append({"source": list(src), "target": list(tk), "noCase": "PFHxA never reaches 0.90 at the port"})
                continue
            prior = design(data, src, tag)
            pa = {sp: {k: prior[sp]["asym"][k] for k in ("a", "t0", "nu")} for sp in SPECIES}
            obs = [{"sp": sp, "z": zp, "t": t, "y": y} for sp in TRACERS for t, y in tgt["lead"][sp] if t <= cutoff]
            th = ev.train_shared_richards({sp: pa[sp] for sp in TRACERS}, {sp: 1.0 for sp in TRACERS}, obs, dict(core.TWIN_CONFIG))
            p = pa[PRIMARY]
            fns = {
                "STATIC_ASYM": lambda t, z: ev.richards_fraction(p["a"], p["t0"] * z, p["nu"], t),
                "TRACER_TWIN_ASYM": lambda t, z: ev.richards_fraction(p["a"] * math.exp(th[0]), p["t0"] * math.exp(th[1]) * z, p["nu"], t),
            }
            res = {"source": list(src), "target": list(tk), "cutoffD": ev.r4(cutoff),
                   "trainingSamples": {sp: len([o for o in obs if o["sp"] == sp]) for sp in TRACERS},
                   "learnedFactors": [ev.r4(math.exp(th[0])), ev.r4(math.exp(th[1]))], "pfoa": {}}
            for point, z in (("port", zp), ("outlet", 1.0)):
                series = tgt["lead" if point == "port" else "lag"][PRIMARY]
                row = {}
                for m, fn in fns.items():
                    c = classify_crossing(series, lambda t, fn=fn, z=z: fn(t, z), 0.10, cutoff)
                    if c:
                        mid = 0.5 * (c["intervalD"][0] + c["intervalD"][1])
                        c["signedErrorPctOfMidpoint"] = ev.r4(100.0 * (c["forecastD"] - mid) / mid)
                    row[m] = c
                res["pfoa"][point] = row
            cases.append(res)
    counts = {}
    for m in ("STATIC_ASYM", "TRACER_TWIN_ASYM"):
        for point in ("port", "outlet"):
            cnt = {"early": 0, "inside": 0, "late": 0}
            for c in cases:
                r = c.get("pfoa", {}).get(point, {}).get(m)
                if r:
                    cnt[r["class"]] += 1
            counts[f"{m}@{point}"] = cnt
    out_t = counts["TRACER_TWIN_ASYM@outlet"]
    return {"cases": cases, "counts": counts,
            "verdict": {"tracerClaimSupported": out_t["inside"] + out_t["early"] >= 3,
                        "expectationStatedInAdvance": "both methods late for PFOA under +NOM; tracer factors near 1"}}


def e8(data) -> Dict:
    def enough(s: Series) -> bool:
        return sum(1 for _, y in s if y >= 0.5) >= 2 and sum(1 for _, y in s if 0.025 <= y <= 0.95) >= 4

    rows = []
    for key in sorted(data):
        tr = data[key]
        zp = Z_PORT[key[0]]
        for sp in SPECIES:
            if not (enough(tr["lead"][sp]) and enough(tr["lag"][sp])):
                continue
            gp, go = ev.fit_richards(tr["lead"][sp], 1.0), ev.fit_richards(tr["lag"][sp], 1.0)
            rows.append({"train": list(key), "species": sp, "R50": ev.r4(richards_t50(go) * zp / richards_t50(gp)),
                         "Ra": ev.r4(go["a"] / gp["a"]), "nuPort": ev.r4(gp["nu"]), "nuOutlet": ev.r4(go["nu"]),
                         "t50PortD": ev.r4(richards_t50(gp)), "t50OutletD": ev.r4(richards_t50(go))})
    medians = {}
    for sp in SPECIES:
        for nom in NOMS:
            sel = [r for r in rows if r["species"] == sp and r["train"][1] == nom]
            if sel:
                medians[f"{sp} {nom}"] = {"n": len(sel), "R50": ev.r4(statistics.median(r["R50"] for r in sel)),
                                          "Ra": ev.r4(statistics.median(r["Ra"] for r in sel))}
    return {"rows": rows, "medians": medians}


def run() -> Dict:
    primary = load()
    sens = load(exclude_outliers=True)
    e6p = e6(primary, "all")
    e6s = e6(sens, "noOutliers")
    return {
        "dataset": {
            "source": "Smith et al. (2026) Water Research 288:124685; EPA ScienceHub doi:10.23719/1532427 (U.S. public domain)",
            "trains": {f"{k[0]} {k[1]} rep{k[2]}": {"recordEndD": ev.r4(record_end(v)), "zPort": Z_PORT[k[0]],
                                                    "samples": {p: {s: len(v[p][s]) for s in SPECIES} for p in ("lead", "lag")}}
                       for k, v in sorted(primary.items())},
        },
        "protocol": {"file": "simulation/protocols/smith2026_aex_protocol.md", "registrationCommit": "81c12c8",
                     "amendmentA1Commit": "3f734ea", "species": SPECIES, "primary": PRIMARY, "methods": METHODS,
                     "cutoffs": CUTOFFS, "implementationNotes": IMPLEMENTATION_NOTES},
        "E6": e6p,
        "E7": e7(primary, "all"),
        "E8": e8(primary),
        "sensitivityWithoutFlaggedOutliers": {"E6summary": e6s["summary"], "E6verdict": e6s["verdict"],
                                              "E7": e7(sens, "noOutliers")["counts"], "E8medians": e8(sens)["medians"]},
    }


def main() -> None:
    rep = run()
    with open(OUTPUT_FILE, "w", encoding="utf-8", newline="\n") as f:
        json.dump(rep, f, indent=1)
        f.write("\n")
    print(json.dumps({"E6verdict": rep["E6"]["verdict"], "E6K1": rep["E6"]["summary"]["K1"], "E7": rep["E7"]["counts"],
                      "E7verdict": rep["E7"]["verdict"], "E8": rep["E8"]["medians"],
                      "sensitivity": rep["sensitivityWithoutFlaggedOutliers"]["E6verdict"]}, indent=1))


if __name__ == "__main__":
    main()
