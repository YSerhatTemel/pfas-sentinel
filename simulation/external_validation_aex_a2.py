"""Repeat of E6-E8 with the authors' detailed data, and the correction rerun of E6-E8 (standard library only).

Protocol: simulation/protocols/smith2026_aex_protocol.md. Amendment A2 was registered in commit 1e0632f before the
detailed files were opened; amendment A3 (commit 9c29860) records what they contain and was committed before any model
was fitted to them. This script was committed before its first run. It imports the fits, methods, scores, summaries
and decision rules of external_validation_aex.py (as of commit e466b2f) instead of copying them; it adds only the
loading, the C0 rules of A2 and the time correction of A3.

CORRECTION  E6-E8 on the public workbook data (C/C0 as published, all samples) with the Experiment 2 run times
            corrected to the EBCT implied by the authors' run time (A3 9.3.2). Experiment 1 needs no correction.
REPEAT      E6-E8 on the detailed data (simulation/data/smith2026_aex_detailed.csv): ng/L divided by the measured
            influent of the train (A2 8.2), non-detects 0 ng/L, laboratory duplicates averaged, the samples the authors
            set to "na" absent, all samples of the eight trains.
The 4 ng/L items of A2 8.4 (S4, cut-off K0, model-free port lead) are not scorable: the files, the paper and the SI
give no value for the MRL (A3 9.3.4). They are not run.

The primary results remain those of external_validation_aex.py; this script reports, for each pre-registered verdict,
whether the correction and the repeat agree with them.

Usage: python simulation/external_validation_aex_a2.py   (writes simulation/external_validation_aex_a2.json)
"""
from __future__ import annotations

import csv
import json
import math
import os
import re
import sys
from typing import Dict, List, Optional, Tuple

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import external_validation as ev  # noqa: E402
import external_validation_aex as aex  # noqa: E402
import pfas_sentinel_core as core  # noqa: E402

DETAILED_FILE = os.path.join(HERE, "data", "smith2026_aex_detailed.csv")
PRIMARY_JSON = os.path.join(HERE, "external_validation_aex.json")
OUTPUT_FILE = os.path.join(HERE, "external_validation_aex_a2.json")
POINTS = ("influent", "lead", "lag")

IMPLEMENTATION_NOTES = [
    "Correction: the primary analyses (E6, E7, E8 on all samples) are rerun; the sensitivity run without the flagged "
    "outliers is not repeated. Experiment 2 run times are multiplied by EBCT from run time / EBCT used in A1, per train "
    "and bed (headers of smith2026_aex_detailed.csv and smith2026_aex_columns.csv).",
    "Repeat: a target's values at a cut-off are ng/L divided by the mean influent of that train and species on or before "
    "the cut-off; starting curves, E8 and the reference scatter use the mean of all influent samples of the train.",
    "Repeat: cut-offs K1, K2 and the E7 cut-off are the first port sample whose ng/L reaches the level times the mean "
    "influent on or before that sample's time. K3 and K4 are 1/3 and 1/2 of the train's record, as before.",
    "Repeat: influent non-detects (5 rows, Experiment 2 +NOM, one each of PFOS x2, PFBS, PFNA, PFOA) count as 0 ng/L in "
    "the influent means, as all non-detects do (A2 8.3.4).",
    "Repeat E6 uses the case-independent code of external_validation_aex.e6 (summary, reference scatter, verdict) with "
    "the case function below; repeat E7 mirrors external_validation_aex.e7 with the cut-off and C0 rule of A2.",
    "S4, K0 and the model-free 4 ng/L comparison (A2 8.4) are not run: no MRL value is given (A3 9.3.4).",
]

Series = List[Tuple[float, float]]
Train = Tuple[int, str, int]


# ---------------------------------------------------------------------------------------------
# loading
# ---------------------------------------------------------------------------------------------
def _ebct_lines(path: str, pattern: str, lead_group: int, train_group: int) -> Dict[Tuple[str, int, int], Dict[str, float]]:
    """EBCT (min) per (nom, experiment, replicate) from a CSV header: 'lead' for port samples, 'lag' (the whole
    train) for outlet samples."""
    out = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            m = re.match(pattern, line)
            if m:
                out[(m.group(1), int(m.group(2)), int(m.group(3)))] = {"lead": float(m.group(lead_group)),
                                                                       "lag": float(m.group(train_group))}
    assert len(out) == 8, (path, out)
    return out


def ebct_a1() -> Dict[Tuple[str, int, int], Dict[str, float]]:
    """EBCT used in amendment A1 (header of smith2026_aex_columns.csv): lead from data, train from SI Table S3."""
    return _ebct_lines(aex.DATA_FILE, r"#\s+([+-]NOM) experiment (\d) replicate (\d): train EBCT ([\d.]+) min .*lead EBCT "
                                      r"from data ([\d.]+) min", lead_group=5, train_group=4)


def ebct_from_run_time() -> Dict[Tuple[str, int, int], Dict[str, float]]:
    """EBCT implied by the authors' run time (header of smith2026_aex_detailed.csv, amendment A3)."""
    return _ebct_lines(DETAILED_FILE, r"#\s+EBCT from run time: ([+-]NOM) experiment (\d) replicate (\d): lead ([\d.]+) "
                                      r"min, train ([\d.]+) min", lead_group=4, train_group=5)


def load_corrected():
    """Workbook data as in the primary analysis, with Experiment 2 run times corrected (A3 9.3.2)."""
    data = aex.load()
    a1, rt = ebct_a1(), ebct_from_run_time()
    factors = {}
    for (exp, nom, rep), tr in data.items():
        if exp != 2:
            continue
        for point in ("lead", "lag"):
            f = rt[(nom, exp, rep)][point] / a1[(nom, exp, rep)][point]
            factors[f"{exp} {nom} rep{rep} {point}"] = ev.r4(f)
            for sp in tr[point]:
                tr[point][sp] = [(t * f, y) for t, y in tr[point][sp]]
    return data, factors


def load_detailed() -> Dict[Train, Dict[str, Dict[str, Series]]]:
    """Detailed data in ng/L: (exp, nom, rep) -> point -> species -> [(run time d, ng/L)], sorted."""
    out: Dict[Train, Dict[str, Dict[str, Series]]] = {}
    with open(DETAILED_FILE, encoding="utf-8") as f:
        for r in csv.DictReader(line for line in f if not line.startswith("#")):
            if r["species"] not in aex.SPECIES:
                continue
            key = (int(r["experiment"]), r["nom"], int(r["replicate"]))
            tr = out.setdefault(key, {p: {s: [] for s in aex.SPECIES} for p in POINTS})
            tr[r["point"]][r["species"]].append((float(r["time_d"]), float(r["ng_l"])))
    for tr in out.values():
        for pt in tr.values():
            for s in pt:
                pt[s].sort()
    return out


# ---------------------------------------------------------------------------------------------
# C0 rules of A2 (8.2)
# ---------------------------------------------------------------------------------------------
def c0_known(tr, sp: str, t: float) -> float:
    """Mean influent of the train on or before t; the train's first influent sample if there is none yet."""
    vals = [y for ti, y in tr["influent"][sp] if ti <= t]
    if not vals:
        vals = [tr["influent"][sp][0][1]]
    return sum(vals) / len(vals)


def c0_all(tr, sp: str) -> float:
    vals = [y for _, y in tr["influent"][sp]]
    return sum(vals) / len(vals)


def normalized(tr, c0: Dict[str, float]) -> Dict[str, Dict[str, Series]]:
    return {p: {sp: [(t, y / c0[sp]) for t, y in tr[p][sp]] for sp in aex.SPECIES} for p in ("lead", "lag")}


def full_record(raw) -> Dict[Train, Dict[str, Dict[str, Series]]]:
    """Every train as C/C0 with the mean of all its influent samples (starting curves, E8, reference scatter)."""
    return {k: normalized(tr, {sp: c0_all(tr, sp) for sp in aex.SPECIES}) for k, tr in raw.items()}


def first_port_at(tr, sp: str, level: float) -> Optional[float]:
    """First port sample whose ng/L reaches level x the mean influent on or before that sample's time."""
    return next((t for t, y in tr["lead"][sp] if y >= level * c0_known(tr, sp, t)), None)


def repeat_cutoff(tr, full_tr, which: str) -> Optional[float]:
    if which in ("K1", "K2"):
        return first_port_at(tr, aex.PRIMARY, 0.10 if which == "K1" else 0.50)
    return (1 / 3 if which == "K3" else 1 / 2) * aex.record_end(full_tr)


# ---------------------------------------------------------------------------------------------
# REPEAT: E6 case, E7
# ---------------------------------------------------------------------------------------------
def repeat_e6_case(raw, full, src: Train, tgt_key: Train, which: str, tag: str) -> Dict:
    """As external_validation_aex.e6_case, with the cut-off and C0 rules of A2."""
    tr = raw[tgt_key]
    zp = aex.Z_PORT[tgt_key[0]]
    cutoff = repeat_cutoff(tr, full[tgt_key], which)
    base = {"source": list(src), "target": list(tgt_key), "cutoff": which}
    if cutoff is None:
        return {**base, "noCase": "cut-off event does not occur in the target train"}
    c0 = {sp: c0_known(tr, sp, cutoff) for sp in aex.SPECIES}
    tgt = normalized(tr, c0)
    prior = aex.design(full, src, tag)
    obs = [{"sp": sp, "z": zp, "t": t, "y": y} for sp in aex.SPECIES for t, y in tgt["lead"][sp] if t <= cutoff]
    assert obs and all(o["t"] <= cutoff for o in obs)
    curves, learned = aex.fit_methods(prior, obs, zp)
    res = {**base, "cutoffD": ev.r4(cutoff), "c0AtCutoffNgL": {sp: ev.r4(c0[sp]) for sp in aex.SPECIES},
           "influentSamplesAtCutoff": {sp: len([1 for t, _ in tr["influent"][sp] if t <= cutoff]) for sp in aex.SPECIES},
           "trainingSamples": {sp: len([o for o in obs if o["sp"] == sp]) for sp in aex.SPECIES},
           "testSamples": {sp: len([1 for t, _ in tgt["lag"][sp] if t > cutoff]) for sp in aex.SPECIES},
           "learnedFactors": learned, "methods": aex.score(curves, aex.METHODS, tgt, cutoff)}
    obs2 = obs + [{"sp": sp, "z": 1.0, "t": t, "y": y} for sp in aex.SPECIES for t, y in tgt["lag"][sp] if t <= cutoff]
    curves2, learned2 = aex.fit_methods(prior, obs2, zp, with_outlet_obs=True)
    res["secondaryVariant"] = {"learnedFactors": {m: learned2[m] for m in aex.SECONDARY_VARIANT_METHODS},
                               "methods": aex.score(curves2, aex.SECONDARY_VARIANT_METHODS, tgt, cutoff)}
    return res


def repeat_e6(raw, full, tag: str) -> Dict:
    """external_validation_aex.e6 (cases, reference scatter on the full-record C/C0, summary, verdict) with the
    repeat's case function in place of its own."""
    original = aex.e6_case
    aex.e6_case = lambda _data, src, tgt_key, which, t: repeat_e6_case(raw, full, src, tgt_key, which, t)
    try:
        return aex.e6(full, tag)
    finally:
        aex.e6_case = original


def repeat_e7(raw, full, tag: str) -> Dict:
    """As external_validation_aex.e7, with the cut-off (PFHxA >= 0.90 of the influent known then) and C0 of A2."""
    cases = []
    for exp in (1, 2):
        zp = aex.Z_PORT[exp]
        for rep in (1, 2):
            src, tk = (exp, "-NOM", rep), (exp, "+NOM", rep)
            tr = raw[tk]
            cutoff = first_port_at(tr, "PFHXA", 0.90)
            if cutoff is None:
                cases.append({"source": list(src), "target": list(tk), "noCase": "PFHxA never reaches 0.90 at the port"})
                continue
            c0 = {sp: c0_known(tr, sp, cutoff) for sp in aex.SPECIES}
            tgt = normalized(tr, c0)
            prior = aex.design(full, src, tag)
            pa = {sp: {k: prior[sp]["asym"][k] for k in ("a", "t0", "nu")} for sp in aex.SPECIES}
            obs = [{"sp": sp, "z": zp, "t": t, "y": y} for sp in aex.TRACERS for t, y in tgt["lead"][sp] if t <= cutoff]
            th = ev.train_shared_richards({sp: pa[sp] for sp in aex.TRACERS}, {sp: 1.0 for sp in aex.TRACERS}, obs, dict(core.TWIN_CONFIG))
            p = pa[aex.PRIMARY]
            fns = {
                "STATIC_ASYM": lambda t, z: ev.richards_fraction(p["a"], p["t0"] * z, p["nu"], t),
                "TRACER_TWIN_ASYM": lambda t, z: ev.richards_fraction(p["a"] * math.exp(th[0]), p["t0"] * math.exp(th[1]) * z, p["nu"], t),
            }
            res = {"source": list(src), "target": list(tk), "cutoffD": ev.r4(cutoff),
                   "c0AtCutoffNgL": {sp: ev.r4(c0[sp]) for sp in aex.SPECIES},
                   "trainingSamples": {sp: len([o for o in obs if o["sp"] == sp]) for sp in aex.TRACERS},
                   "learnedFactors": [ev.r4(math.exp(th[0])), ev.r4(math.exp(th[1]))], "pfoa": {}}
            for point, z in (("port", zp), ("outlet", 1.0)):
                series = tgt["lead" if point == "port" else "lag"][aex.PRIMARY]
                row = {}
                for m, fn in fns.items():
                    c = aex.classify_crossing(series, lambda t, fn=fn, z=z: fn(t, z), 0.10, cutoff)
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


# ---------------------------------------------------------------------------------------------
# report
# ---------------------------------------------------------------------------------------------
def verdicts(e6: Dict, e7: Dict) -> Dict[str, bool]:
    return {"travellingWaveTwinPasses": e6["verdict"]["travellingWaveTwinPasses"],
            "twopointCountsAsFix": e6["verdict"]["twopointCountsAsFix"],
            "tracerClaimSupported": e7["verdict"]["tracerClaimSupported"]}


def run() -> Dict:
    with open(PRIMARY_JSON, encoding="utf-8") as f:
        primary = json.load(f)
    corrected, factors = load_corrected()
    raw = load_detailed()
    full = full_record(raw)
    e6c, e7c, e8c = aex.e6(corrected, "corrected"), aex.e7(corrected, "corrected"), aex.e8(corrected)
    e6r, e7r, e8r = repeat_e6(raw, full, "repeat"), repeat_e7(raw, full, "repeat"), aex.e8(full)
    v = {"primary": verdicts(primary["E6"], primary["E7"]), "correction": verdicts(e6c, e7c), "repeat": verdicts(e6r, e7r)}
    agree = {f"{a}Vs{b[0].upper()}{b[1:]}": {k: v[a][k] == v[b][k] for k in v["primary"]}
             for a, b in (("correction", "primary"), ("repeat", "primary"), ("repeat", "correction"))}
    return {
        "dataset": {
            "source": "Smith et al. (2026) Water Research 288:124685; detailed data shared by the authors (L. Haupert, "
                      "U.S. EPA) on 10 Nov 2026; processed subset simulation/data/smith2026_aex_detailed.csv",
            "trains": {f"{k[0]} {k[1]} rep{k[2]}": {
                "recordEndD": ev.r4(aex.record_end(full[k])),
                "samples": {p: {s: len(tr[p][s]) for s in aex.SPECIES} for p in POINTS},
                "meanInfluentNgL": {s: ev.r4(c0_all(tr, s)) for s in aex.SPECIES}} for k, tr in sorted(raw.items())},
        },
        "protocol": {"file": "simulation/protocols/smith2026_aex_protocol.md", "amendmentA2Commit": "1e0632f",
                     "amendmentA3Commit": "9c29860", "analysisCodeOf": "external_validation_aex.py at e466b2f",
                     "cutoffs": aex.CUTOFFS, "notScorable": "S4, K0 and the model-free 4 ng/L comparison (A2 8.4): no MRL "
                     "value in the files, the paper or the SI (A3 9.3.4)", "implementationNotes": IMPLEMENTATION_NOTES},
        "correction": {"note": "E6-E8 on the workbook data with Experiment 2 run times corrected (A3 9.3.2); labelled as a "
                               "correction, the primary results stay the registered ones",
                       "timeFactors": factors, "E6": e6c, "E7": e7c, "E8": e8c},
        "repeat": {"E6": e6r, "E7": e7r, "E8": e8r},
        "verdicts": v,
        "agreement": agree,
    }


def main() -> None:
    rep = run()
    with open(OUTPUT_FILE, "w", encoding="utf-8", newline="\n") as f:
        json.dump(rep, f, indent=1)
        f.write("\n")
    print(json.dumps({"verdicts": rep["verdicts"], "agreement": rep["agreement"],
                      "correctionK1": rep["correction"]["E6"]["summary"]["K1"], "repeatK1": rep["repeat"]["E6"]["summary"]["K1"],
                      "correctionE7": rep["correction"]["E7"]["counts"], "repeatE7": rep["repeat"]["E7"]["counts"],
                      "correctionE8": rep["correction"]["E8"]["medians"], "repeatE8": rep["repeat"]["E8"]["medians"]}, indent=1))


if __name__ == "__main__":
    main()
