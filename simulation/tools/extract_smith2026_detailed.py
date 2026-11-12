"""Extract a processed subset of the authors' detailed Smith et al. (2026) column data (amendments A2 and A3).

Source (NOT stored in this repository and never to be shared or posted, at the authors' request): the compiled raw
data sent by Dr. L. Haupert (U.S. EPA) on 10 Nov 2026 as Smith-2026-all-data.zip, two workbooks:
    121RC_PFAS columns compiled data_2024-03-08_SS.xlsx   Experiment 1 (short beds, nominal EBCT 0.5 / 1.0 min)
    146RC_PFAS columns compiled data_2024-02-21_SS.xlsx   Experiment 2 (long beds, nominal EBCT 1.5 / 2.5 min)
Only the sheet ALL_DATA is read: the authors' compiled table, one row per sample with its train, sampling point
(c0 = influent, c1 = lead-column effluent, c2 = lag-column effluent), treatment, run time and the ng/L of each PFAS
("<MRL" = non-detect). Protocol: simulation/protocols/smith2026_aex_protocol.md (A2 registration, A3 what the files
contain). Standard library only. Usage:
    python -I simulation/tools/extract_smith2026_detailed.py <folder with the two workbooks> simulation/data/smith2026_aex_detailed.csv

Rules (A2 8.2-8.3 as made specific by A3):
  * Rows: sample type "Sample" of trains s1-s4 at c0, c1 and c2. Blanks, controls and other points are not extracted.
  * Species: PFBA, PFHxA, PFBS, PFOA, PFNA and PFOS, in ng/L as reported. "<MRL" -> 0 ng/L, nondetect = 1 (no MRL value
    is given in the files, the paper or the SI). "na" or empty -> no result (the authors set the values they judged
    outliers to "na").
  * Time: run time in days = the files' "Collection Experiment Time (days)", for every sample. The published bed
    volumes were computed from this run time and the actual EBCT; the files' own bed-volume columns use the nominal
    EBCT and are not used.
  * Repeat analyses (same train, point, species and run time) are averaged; nondetect = 1 only if all were.
  * Mapping check against simulation/data/smith2026_aex_columns.csv (the public workbook, amendment A1): each
    workbook sample must correspond to a raw run time under one constant factor per train and bed; the EBCT this
    implies is written to the header (the correction of amendment A3). For matched samples, raw ng/L divided by the
    authors' influent mean of that row is compared with the workbook's C/C0, for the assumed and the swapped
    train -> replicate mapping.
"""
import csv
import hashlib
import os
import re
import statistics
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
WORKBOOK_CSV = os.path.join(HERE, "..", "data", "smith2026_aex_columns.csv")
FILES = {1: "121RC_PFAS columns compiled data_2024-03-08_SS.xlsx", 2: "146RC_PFAS columns compiled data_2024-02-21_SS.xlsx"}
RUN_ID = {1: "RC121", 2: "RC146"}
ZIP_SHA256 = "2e35200625a9f140ee57d7691bfc5e14bc451fa7abff987e18e1dce497650716"  # as received; registered in A2
SPECIES = {"PFBA": "PFBA", "PFHxA": "PFHXA", "PFBS": "PFBS", "PFOA": "PFOA", "PFNA": "PFNA", "PFOS": "PFOS"}
TREATMENT = {"NOM": "+NOM", "noNOM": "-NOM"}
POINT = {"0": "influent", "1": "lead", "2": "lag"}
TRAIN = {1: ("+NOM", 1), 2: ("+NOM", 2), 3: ("-NOM", 1), 4: ("-NOM", 2)}  # verified by the mapping check below
RUN_TIME = "Collection Experiment Time (days)"
EXACT = 1e-4  # relative tolerance for "the same run time"

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "pr": "http://schemas.openxmlformats.org/package/2006/relationships"}


def _col(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_table(path, sheet, header_row):
    """Rows below header_row as dicts keyed by the header text."""
    z = zipfile.ZipFile(path)
    shared = ["".join(t.text or "" for t in si.iter("{%s}t" % NS["m"]))
              for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS)]
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels")).findall("pr:Relationship", NS)}
    s = next(s for s in ET.fromstring(z.read("xl/workbook.xml")).find("m:sheets", NS) if s.get("name") == sheet)
    target = rels[s.get("{%s}id" % NS["r"])].lstrip("/")
    target = target if target.startswith("xl/") else "xl/" + target
    header, out = None, []
    for row in ET.fromstring(z.read(target)).find("m:sheetData", NS).findall("m:row", NS):
        cells = {}
        for c in row.findall("m:c", NS):
            v = c.find("m:v", NS)
            if c.get("t") == "inlineStr":
                cells[_col(c.get("r"))] = "".join(x.text or "" for x in c.iter("{%s}t" % NS["m"]))
            elif v is not None:
                cells[_col(c.get("r"))] = shared[int(v.text)] if c.get("t") == "s" else (v.text or "")
        r = int(row.get("r"))
        if r == header_row:
            names = [cells[i].strip() for i in sorted(cells)]
            assert len(names) == len(set(names)), "duplicate header names in " + sheet
            header = {i: cells[i].strip() for i in cells}
        elif r > header_row:
            out.append({header[i]: v for i, v in cells.items() if i in header})
    return out


def number(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def a1_ebct():
    """EBCT (min) used in amendment A1 per (nom, experiment, replicate): lead from data, train from SI Table S3."""
    out = {}
    pat = re.compile(r"#\s+([+-]NOM) experiment (\d) replicate (\d): train EBCT ([\d.]+) min .*lead EBCT from data ([\d.]+) min")
    with open(WORKBOOK_CSV, encoding="utf-8") as f:
        for line in f:
            m = pat.match(line)
            if m:
                out[(m.group(1), int(m.group(2)), int(m.group(3)))] = {"lead": float(m.group(5)), "lag": float(m.group(4))}
    assert len(out) == 8, out
    return out


def workbook_samples():
    """Public workbook: (exp, nom, rep, point, SPECIES) -> list of (bed volumes, run time in A1, C/C0)."""
    out = defaultdict(list)
    with open(WORKBOOK_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(line for line in f if not line.startswith("#")):
            if r["species"] in SPECIES.values():
                key = (int(r["experiment"]), r["nom"], int(r["replicate"]), r["point"], r["species"])
                out[key].append((float(r["kbv"]) * 1000.0, float(r["time_d"]), float(r["c_over_c0"])))
    return out


def raw_rows(folder):
    """All in-scope rows of both workbooks, one entry per row and species (before averaging)."""
    rows, skipped, no_result, no_time = [], Counter(), Counter(), Counter()
    run_times = defaultdict(set)  # (exp, train, point) -> run times of all in-scope rows
    for exp, name in FILES.items():
        for r in read_table(os.path.join(folder, name), "ALL_DATA", 2):
            desc = (r.get("Experiment Description") or "").strip()
            m = re.fullmatch(RUN_ID[exp] + r"_s([1-4])c([012])", desc)
            if r.get("Sample Type", "").strip() != "Sample" or not m:
                skipped[f"{desc or '(none)'} [{r.get('Sample Type', '').strip()}]"] += 1
                continue
            train = int(m.group(1))
            nom, rep = TRAIN[train]
            assert TREATMENT[r["Treatment"].strip()] == nom, (desc, r["Treatment"])
            assert int(float(r["Train #"])) == train, desc
            point = POINT[m.group(2)]
            t = number(r.get(RUN_TIME))
            if t is None:
                no_time[(exp, point)] += 1
                continue
            run_times[(exp, train, point)].add(t)
            for col, sp in SPECIES.items():
                s = (r.get(col + "_ngL") or "").strip()
                if s == "<MRL":
                    val, nd = 0.0, 1
                else:
                    val, nd = number(s), 0
                    if val is None:
                        no_result[s or "(empty)"] += 1
                        continue
                rows.append({"experiment": exp, "train": train, "nom": nom, "replicate": rep, "point": point, "species": sp,
                             "time_d": t, "ng_l": val, "nondetect": nd, "c0_authors": number(r.get(f"Average of {col}_ngL"))})
    return rows, skipped, no_result, no_time, run_times


def time_match(wb, run_times, exp, nom, rep, point, train):
    """Constant factor f with workbook time = f x raw run time for this train and bed, the share of workbook samples
    matched under it, and the EBCT implied by the raw run time and the workbook bed volumes."""
    wbs = [x for (e, n, r, p, _), v in wb.items() if (e, n, r, p) == (exp, nom, rep, point) for x in v]
    raw_t = sorted(t for t in run_times[(exp, train, point)] if t > 0)
    f = Counter(round(tw / tr, 5) for _, tw, _ in wbs for tr in raw_t).most_common(1)[0][0]
    matched, ebct = 0, []
    for bv, tw, _ in wbs:
        hit = [tr for tr in raw_t if abs(tw - f * tr) <= EXACT * tw]
        if hit:
            matched += 1
            ebct.append(hit[0] * 1440.0 / bv)
    return f, matched, len(wbs), (statistics.median(ebct) if ebct else None)


def c_over_c0(wb, rows, exp, mapping, factors):
    """|raw ng/L / authors' influent mean - workbook C/C0| for workbook samples matched by run time."""
    diffs, missing = [], 0
    for (e, nom, rep, point, sp), samples in wb.items():
        if e != exp:
            continue
        cand = [x for x in rows if (x["experiment"], x["train"], x["point"], x["species"]) == (e, mapping[(nom, rep)], point, sp)
                and x["c0_authors"]]
        f = factors[(nom, rep, point)]
        for _, tw, cc0 in samples:
            same = [x["ng_l"] / x["c0_authors"] for x in cand if abs(tw - f * x["time_d"]) <= EXACT * tw]
            if same:
                diffs.append(min(abs(v - cc0) for v in same))
            else:
                missing += 1
    return diffs, missing


def main(folder, out_csv):
    shas = {name: hashlib.sha256(open(os.path.join(folder, name), "rb").read()).hexdigest() for name in FILES.values()}
    a1 = a1_ebct()
    wb = workbook_samples()
    rows, skipped, no_result, no_time, run_times = raw_rows(folder)
    identity = {v: k for k, v in TRAIN.items()}
    swapped = {(nom, rep): identity[(nom, 3 - rep)] for (nom, rep) in identity}

    # Mapping check (A2 8.3.5) and the EBCT implied by the authors' run time (A3).
    checks, ebct_lines = [], []
    for exp in FILES:
        factors = {}
        for nom in ("+NOM", "-NOM"):
            for rep in (1, 2):
                res = {}
                for point in ("lead", "lag"):
                    f, hit, tot, eb = time_match(wb, run_times, exp, nom, rep, point, identity[(nom, rep)])
                    assert hit == tot, f"workbook samples without a raw run time: {exp} {nom} {rep} {point} {hit}/{tot}"
                    factors[(nom, rep, point)] = f
                    res[point] = (f, hit, tot, eb)
                ebct_lines.append(
                    f"#   EBCT from run time: {nom} experiment {exp} replicate {rep}: lead {res['lead'][3]:.5f} min, "
                    f"train {res['lag'][3]:.5f} min (A1 used lead {a1[(nom, exp, rep)]['lead']}, train {a1[(nom, exp, rep)]['lag']}); "
                    f"A1 run time / authors' run time = {res['lead'][0]:.5f} (lead), {res['lag'][0]:.5f} (lag); workbook samples "
                    f"matched {res['lead'][1]}/{res['lead'][2]} (lead), {res['lag'][1]}/{res['lag'][2]} (lag)")
        d_id, miss_id = c_over_c0(wb, rows, exp, identity, factors)
        d_sw, _ = c_over_c0(wb, rows, exp, swapped, factors)
        ok_id, ok_sw = sum(1 for d in d_id if d <= 0.01), sum(1 for d in d_sw if d <= 0.01)
        checks.append(f"experiment {exp} ({RUN_ID[exp]}): C/C0 of {len(d_id)} matched samples (raw ng/L / authors' influent "
                      f"mean vs workbook): {ok_id} within 0.01, largest difference {max(d_id, default=float('nan')):.3g}; "
                      f"with replicates swapped {ok_sw} of {len(d_sw)} within 0.01; workbook samples with no raw result "
                      f"(\"na\") for that species: {miss_id}")
        print(checks[-1])
        assert ok_id > ok_sw, "train -> replicate mapping not confirmed"

    # Average repeat analyses of one sample (same train, point, species and run time).
    groups = defaultdict(list)
    for r in rows:
        groups[(r["experiment"], r["nom"], r["replicate"], r["point"], r["species"], round(r["time_d"], 6))].append(r)
    records = [{"experiment": e, "nom": n, "replicate": rp, "train": g[0]["train"], "point": p, "species": sp, "time_d": t,
                "ng_l": sum(x["ng_l"] for x in g) / len(g), "nondetect": int(all(x["nondetect"] for x in g)), "n_analyses": len(g)}
               for (e, n, rp, p, sp, t), g in groups.items()]
    records.sort(key=lambda r: (r["experiment"], r["nom"], r["replicate"], r["point"], r["species"], r["time_d"]))
    repeats = sum(1 for g in groups.values() if len(g) > 1)

    counts = Counter((r["experiment"], r["nom"], r["replicate"], r["point"]) for r in records if r["species"] == "PFOA")
    wb_counts = Counter({(e, n, rp, p): len(v) for (e, n, rp, p, s), v in wb.items() if s == "PFOA"})
    count_lines = [f"#   experiment {e} {n} replicate {rp} (train s{identity[(n, rp)]}): PFOA samples influent "
                   f"{counts[(e, n, rp, 'influent')]}, lead {counts[(e, n, rp, 'lead')]} (workbook {wb_counts[(e, n, rp, 'lead')]}), "
                   f"lag {counts[(e, n, rp, 'lag')]} (workbook {wb_counts[(e, n, rp, 'lag')]})"
                   for e in FILES for n in ("+NOM", "-NOM") for rp in (1, 2)]

    header = [
        "# Processed subset of the authors' detailed Smith et al. (2026) anion-exchange column data, used by",
        "#   simulation/external_validation_aex_a2.py (protocol simulation/protocols/smith2026_aex_protocol.md, amendments A2-A3).",
        "# Source: Smith, S. J., Wahman, D. G., ..., Haupert, L. M. (2026) Water Research 288: 124685,",
        "#   doi:10.1016/j.watres.2025.124685. Compiled raw data shared by Dr. L. Haupert (U.S. EPA) on 10 Nov 2026 as",
        f"#   Smith-2026-all-data.zip (sha256 {ZIP_SHA256}):",
    ] + [f"#   \"{name}\" sha256 {sha}" for name, sha in shas.items()] + [
        "# Sharing condition (the authors): this processed subset may be published; the raw compiled files must not be",
        "#   shared or posted, so they are not in this repository. The public dataset is EPA ScienceHub doi:10.23719/1532427.",
        "#   Changes: sheet ALL_DATA reduced to six PFAS at three sampling points, repeat analyses averaged",
        "#   (simulation/tools/extract_smith2026_detailed.py).",
        "# Columns: experiment (1 = short beds, file RC121; 2 = long beds, file RC146); nom (-NOM / +NOM); replicate; train",
        "#   (the authors' train number); point (influent = c0; lead = c1, lead-column effluent, the twin's mid-bed port;",
        "#   lag = c2, lag-column effluent, the train outlet); species; time_d = run time in days, the files' 'Collection",
        "#   Experiment Time (days)'; ng_l as reported; nondetect = 1 where reported as <MRL (set to 0 ng/L; the MRL value is",
        "#   not given in the files, the paper or the SI); n_analyses = repeat analyses averaged into this row.",
        f"# Repeat analyses: {repeats} rows are means of two analyses of one sample (lab duplicates, sample ID and ID + DUP).",
        "# Rows without a run time (left out): " + (", ".join(f"experiment {e} {p} {n}" for (e, p), n in sorted(no_time.items())) or "none") + ".",
        "# Species values without a result (\"na\" or empty; the authors set outliers to \"na\"): "
        + ", ".join(f"{k} {n}" for k, n in sorted(no_result.items())) + ".",
        "# Mapping check against the public workbook (smith2026_aex_columns.csv, amendment A1):",
    ] + ["#   " + c for c in checks] + ebct_lines + ["# Samples per train:"] + count_lines
    with open(out_csv, "w", encoding="utf-8", newline="") as f:
        f.write("\n".join(header) + "\n")
        w = csv.DictWriter(f, fieldnames=["experiment", "nom", "replicate", "train", "point", "species", "time_d", "ng_l",
                                          "nondetect", "n_analyses"], lineterminator="\n")
        w.writeheader()
        for r in records:
            w.writerow({**r, "time_d": f"{r['time_d']:.6g}", "ng_l": f"{r['ng_l']:.6g}"})
    print(f"wrote {len(records)} rows to {out_csv}")
    for line in header[header.index("# Mapping check against the public workbook (smith2026_aex_columns.csv, amendment A1):"):]:
        print(line[2:])
    print("not extracted (description [sample type]):", dict(sorted(skipped.items())))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1], sys.argv[2])
