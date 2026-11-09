"""Extract the per-sample PFAS breakthrough data of Smith et al. (2026) from the EPA ScienceHub workbook.

Source workbook (not stored in this repository): "Smith_SciHub_AEX_gel_columns_pilots (July 2025).xlsx",
U.S. EPA ScienceHub, doi:10.23719/1532427 (U.S. public domain, ScienceHub licence). Usage:
    python -I simulation/tools/extract_smith2026_workbook.py <xlsx> simulation/data/smith2026_aex_columns.csv

Only the sheets "Fig1" (PFCAs) and "Fig2" (PFSAs and GenX) are read. They hold every sample plotted in the paper's
Figures 1 and 2 as numbers (not digitized): anion, nominal EBCT, NOM condition and replicate, bed volumes treated
(x1000, per bed of that EBCT) and C/C0, plus the authors' outlier flag. The lead-column effluent is the 0.5- and
1.5-min EBCT data, the lag-column effluent (end of the lead + lag train) the 1.0- and 2.5-min data.

Time axis: bed volumes were computed by the authors from run time and the actual EBCT (paper, Section 3.1), so run
time = BV x EBCT. The actual train EBCT (lead + lag) is taken from SI Table S3. Table S3 gives EBCT to two significant
figures, so the lead EBCT is taken from the data instead: both points of a train are sampled until the end of the run,
so EBCT_lead = EBCT_train * max(BV_lag) / max(BV_lead); the value is checked against Table S3 below. Standard
library only (zipfile + ElementTree).
"""
import csv
import hashlib
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "pr": "http://schemas.openxmlformats.org/package/2006/relationships"}

# SI Table S3: actual EBCT (min) of the lead column and of the lead + lag train, per NOM condition and replicate.
TABLE_S3_EBCT = {
    ("-NOM", 1, 1): (0.46, 0.92), ("-NOM", 1, 2): (0.52, 0.99),
    ("-NOM", 2, 1): (1.6, 2.7), ("-NOM", 2, 2): (1.6, 2.7),
    ("+NOM", 1, 1): (0.44, 0.89), ("+NOM", 1, 2): (0.45, 0.91),
    ("+NOM", 2, 1): (1.6, 2.6), ("+NOM", 2, 2): (1.6, 2.6),
}
RESIN_G = {1: (8.15, 16.3), 2: (26.7, 44.5)}  # dry resin mass (g): lead column, lead + lag train (SI Table S3)
EBCT_ROLE = {"0.5": (1, "lead"), "1": (1, "lag"), "1.5": (2, "lead"), "2.5": (2, "lag")}


def _col(ref: str) -> int:
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_sheet(z: zipfile.ZipFile, name: str):
    shared = ["".join(t.text or "" for t in si.iter("{%s}t" % NS["m"]))
              for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS)]
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels")).findall("pr:Relationship", NS)}
    for s in ET.fromstring(z.read("xl/workbook.xml")).find("m:sheets", NS):
        if s.get("name") != name:
            continue
        target = rels[s.get("{%s}id" % NS["r"])].lstrip("/")
        target = target if target.startswith("xl/") else "xl/" + target
        rows = []
        for row in ET.fromstring(z.read(target)).find("m:sheetData", NS).findall("m:row", NS):
            cells = {}
            for c in row.findall("m:c", NS):
                v = c.find("m:v", NS)
                if v is not None:
                    cells[_col(c.get("r"))] = shared[int(v.text)] if c.get("t") == "s" else v.text
            rows.append(cells)
        return rows
    raise KeyError(name)


def main(xlsx: str, out_csv: str) -> None:
    sha = hashlib.sha256(open(xlsx, "rb").read()).hexdigest()
    z = zipfile.ZipFile(xlsx)
    records = []
    for sheet in ("Fig1", "Fig2"):
        rows = read_sheet(z, sheet)
        start = next(i for i, cells in enumerate(rows) if cells.get(0) == "Anion")
        header = rows[start]
        assert header.get(3) == "BVs Treated (x1000)" and header.get(4) == "C/C0" and header.get(5) == "Outliers", sorted(header)
        for cells in rows[start + 1:]:
            if 3 not in cells or 4 not in cells:
                continue
            m = re.fullmatch(r"([+-])NOM, Replicate ([12])", cells[2])
            assert m, cells[2]
            exp, point = EBCT_ROLE[cells[1]]
            records.append({"experiment": exp, "nom": m.group(1) + "NOM", "replicate": int(m.group(2)), "point": point,
                            "species": cells[0].upper(), "nominal_ebct_min": cells[1], "kbv": float(cells[3]),
                            "c_over_c0": float(cells[4]), "outlier": 1 if cells.get(5) == "outlier" else 0})
    checks = []
    for (nom, exp, rep), (ebct_lead_s3, ebct_train) in sorted(TABLE_S3_EBCT.items()):
        tr = [r for r in records if (r["nom"], r["experiment"], r["replicate"]) == (nom, exp, rep)]
        bv_lead = max(r["kbv"] for r in tr if r["point"] == "lead")
        bv_lag = max(r["kbv"] for r in tr if r["point"] == "lag")
        ebct_lead = ebct_train * bv_lag / bv_lead
        h = 0.005 if exp == 1 else 0.05  # half of the last reported digit in Table S3
        lo, hi = (ebct_lead_s3 - h) / (ebct_train + h), (ebct_lead_s3 + h) / (ebct_train - h)
        assert lo <= bv_lag / bv_lead <= hi, (nom, exp, rep, bv_lag / bv_lead, lo, hi)
        checks.append(f"#   {nom} experiment {exp} replicate {rep}: train EBCT {ebct_train} min (Table S3); lead EBCT from data "
                      f"{ebct_lead:.4f} min (Table S3: {ebct_lead_s3}); z_port by resin mass = {RESIN_G[exp][0] / RESIN_G[exp][1]:.3f}")
        for r in tr:
            ebct = ebct_lead if r["point"] == "lead" else ebct_train
            r["time_d"] = r["kbv"] * 1000.0 * ebct / 1440.0
    records.sort(key=lambda r: (r["experiment"], r["nom"], r["replicate"], r["point"], r["species"], r["time_d"]))
    header = [
        "# Per-sample anion-exchange column data used by simulation/external_validation_aex.py (protocol:",
        "#   simulation/protocols/smith2026_aex_protocol.md, experiments E6-E8).",
        "# Source: Smith, S. J., Wahman, D. G., ..., Haupert, L. M. (2026) Water Research 288: 124685,",
        "#   doi:10.1016/j.watres.2025.124685. Data: U.S. EPA ScienceHub doi:10.23719/1532427, workbook",
        "#   \"Smith_SciHub_AEX_gel_columns_pilots (July 2025).xlsx\", sha256 " + sha + ".",
        "# License: U.S. public domain (EPA ScienceHub licence, https://pasteur.epa.gov/license/sciencehub-license.html).",
        "#   Changes: sheets Fig1 and Fig2 reshaped by simulation/tools/extract_smith2026_workbook.py; time_d added.",
        "# Columns: experiment (1 = short beds, 2 = long beds, different resin lots); nom (-NOM / +NOM, 2 mg C/L Ohio River",
        "#   NOM); replicate (duplicate trains); point (lead = lead-column effluent, the mid-bed port of the twin; lag = lag-column",
        "#   effluent, the train outlet); kbv = bed volumes treated x1000 of that bed as given; time_d = run time in days =",
        "#   BV x EBCT; c_over_c0 = effluent / mean influent of that condition (SI Table S5), as given by the authors (no",
        "#   per-sample influent and no ng/L values are in the workbook); outlier = 1 where the authors flag an outlier.",
        "# Purolite PFA694E gel resin; flow about 40 mL/min in every train. EBCT and port position per train:",
    ] + checks
    with open(out_csv, "w", encoding="utf-8", newline="") as f:
        f.write("\n".join(header) + "\n")
        w = csv.DictWriter(f, fieldnames=["experiment", "nom", "replicate", "point", "species", "nominal_ebct_min", "kbv",
                                          "time_d", "c_over_c0", "outlier"], lineterminator="\n")
        w.writeheader()
        for r in records:
            w.writerow({**r, "kbv": f"{r['kbv']:.6g}", "time_d": f"{r['time_d']:.6g}", "c_over_c0": f"{r['c_over_c0']:.6g}"})
    print(f"wrote {len(records)} rows to {out_csv}; workbook sha256 {sha}")
    for line in checks:
        print(line[2:])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
