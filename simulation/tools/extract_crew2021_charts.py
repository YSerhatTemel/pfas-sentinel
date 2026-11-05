"""Read the data points of the vector charts in Crew (2021) from their drawing coordinates.

Source PDF (not stored in this repository): Crew, A. D. (2021), Penn State ScholarSphere, doi:10.26207/qc55-h661,
CC BY-SA 4.0. Usage:
    python -I simulation/tools/extract_crew2021_charts.py <pdf> simulation/data/crew2021_fullscale.csv <report_json>
Calibration uses each chart's own gridlines and tick labels (linear least squares); a data point is the centre of
its marker. Content-stream object numbers refer to the ScholarSphere "ACCESSIBLE_VERSION" file (sha256 prefix
ef0505f). Only Figures 5-7 and 9-11 (Treatment Sites 1 and 2) are read.
"""
import csv
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
STREAMS = ["184", "186", "188", "190", "192", "194", "196", "198"]
GRID = (0.851, 0.851, 0.851)
HEADER = """# Full-scale lead-lag GAC data used by simulation/external_validation_fullscale.py.
# Source: Crew, A. D. (2021) Analysis of Granular Activated Carbon Removal Efficiency of Per- and Polyfluoroalkyl
#   Substances in Groundwater. Professional master's paper, Penn State. ScholarSphere doi:10.26207/qc55-h661.
# License of the source and of this derived file: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
#   Changes: points read from the vector charts of Figures 5-7 and 9-11 by simulation/tools/extract_crew2021_charts.py.
# Sites 1 and 2 (one water system, emergency systems, no pilot): two lead-lag vessels each, Evoqua AquaCarb 1230CX
#   coconut GAC, 285 ft3 per vessel. Ports: halfway = lead-vessel halfway port (z = 0.5), between = between the vessels
#   (lead outlet, z = 1), after_lag = after the lag vessel (z = 2). Bed volumes as plotted by the author (from total
#   gallons, +/- 10 %). Values are what the charts show (the lab reported whole ng/L; 0 = not detected or zero).
# Site 2 media were replaced at about 14,500 bed volumes (later points belong to a new bed).
# Influent averages stated in the text: site 1 PFHxA 21, PFOA 11, PFOS 18, PFBS 6 ng/L; site 2 PFOS 172, PFHxA 22,
#   PFOA+PFOS 186 ng/L. Influent was sampled monthly and is not plotted.
# Check: the first non-zero point of each series matches the author's stated breakthrough bed volumes within one
#   sampling interval (e.g. site 1 halfway PFOA 4,833 vs ~4,800; site 2 between PFHxA 3,434 vs ~3,300).
# Chart calibration residuals (max deviation of the gridlines from the fitted axis maps):
"""
AXIS = (0.749, 0.749, 0.749)


def linfit(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx
    a = my - b * mx
    res = max(abs(a + b * x - y) for x, y in zip(xs, ys))
    return a, b, res


def words(texts):
    rows = {}
    for t in texts:
        rows.setdefault(round(t["y"], 1), []).append(t)
    out = []
    for y, items in rows.items():
        items.sort(key=lambda t: t["x"])
        cur = None
        for t in items:
            if cur and t["x"] - cur["xe"] < 4.5:
                cur["s"] += t["s"]
                cur["xe"] = t["x"] + 5.2 * len(t["s"])
            else:
                if cur:
                    out.append(cur)
                cur = {"x": t["x"], "y": y, "s": t["s"], "xe": t["x"] + 5.2 * len(t["s"])}
        if cur:
            out.append(cur)
    return out


def main(pdf, out_csv, report_json):
    rows_out = []
    report = []
    for num in STREAMS:
        tmp = os.path.join(HERE, f"_obj{num}.json")
        subprocess.run([sys.executable, "-I", os.path.join(HERE, "pdf_vector_chart.py"), pdf, num, tmp], check=True, capture_output=True)
        d = json.load(open(tmp))
        os.remove(tmp)
        texts = d["texts"]
        title = " ".join(t["s"] for t in texts if t["s"].startswith("Treatment Site") or t["s"].startswith("Treament Site")
                         or "Port" in t["s"] or "Vessel" in t["s"] or t["s"] == "-")
        caption = next((t for t in texts if t["s"] == "Figure"), None)
        cap_text = " ".join(t["s"] for t in texts if caption and abs(t["y"] - caption["y"]) < 0.5)
        hgrid = sorted({round(p["pts"][0][1], 3) for p in d["paths"] if tuple(p["color"]) == GRID and p["op"] == "S"
                        and abs(p["pts"][0][1] - p["pts"][-1][1]) < 0.01})
        vgrid = sorted({round(p["pts"][0][0], 3) for p in d["paths"] if tuple(p["color"]) == GRID and p["op"] == "S"
                        and abs(p["pts"][0][0] - p["pts"][-1][0]) < 0.01})
        axes = [p for p in d["paths"] if tuple(p["color"]) == AXIS and p["op"] == "S"]
        if not hgrid or not axes:
            report.append({"stream": num, "skipped": "no gridlines/axes", "caption": cap_text})
            continue
        x_axis = next(p for p in axes if abs(p["pts"][0][1] - p["pts"][1][1]) < 0.01)
        y_axis = next((p for p in axes if abs(p["pts"][0][0] - p["pts"][1][0]) < 0.01), None)
        y0 = x_axis["pts"][0][1]
        x0 = x_axis["pts"][0][0]
        left = min(x0, y_axis["pts"][0][0]) if y_axis else x0
        ylabels = sorted([t for t in texts if re.fullmatch(r"\d+\.\d\d", t["s"]) and t["x"] < left and y0 - 8 < t["y"] < max(hgrid) + 8],
                         key=lambda t: t["y"])
        xlab = next((t for t in texts if re.fullmatch(r"[\d ,]+", t["s"]) and len(t["s"].split()) > 5), None)
        if "%" in cap_text or "Percent" in cap_text or xlab is None:
            report.append({"stream": num, "skipped": "percent-reduction chart or no x labels", "caption": cap_text})
            continue
        xvals = [float(v.replace(",", "")) for v in xlab["s"].split()]
        ylines = [y0] + hgrid
        xlines = [x0] + vgrid
        yvals = [float(t["s"]) for t in ylabels]
        assert len(ylines) == len(yvals), (num, len(ylines), len(yvals))
        assert len(xlines) == len(xvals), (num, len(xlines), len(xvals))
        ay, by, ry = linfit(ylines, yvals)
        ax, bx, rx = linfit(xlines, xvals)
        # legend: markers below the plot area, words to their right
        legend_words = [w for w in words(texts) if w["y"] < y0 - 20 and re.fullmatch(r"[A-Za-z]+", w["s"]) and w["s"] not in ("Bed", "Volumes", "Figure")]
        series = {}
        for p in d["paths"]:
            col = tuple(p["color"])
            if col in (GRID, AXIS, (0.0, 0.0, 0.0)) or p["op"] != "S":
                continue
            pts = p["pts"]
            if len(pts) >= 4 and abs(pts[0][0] - pts[-1][0]) < 0.01 and abs(pts[0][1] - pts[-1][1]) < 0.01:
                xs = [q[0] for q in pts]
                ys = [q[1] for q in pts]
                series.setdefault(col, []).append(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2))
        names = {}
        for col, centres in series.items():
            leg = [c for c in centres if c[1] < y0 - 15]
            if not leg:
                continue
            lx, ly = leg[0]
            cands = [w for w in legend_words if abs(w["y"] + 3 - ly) < 6 and 0 < w["x"] - lx < 40]
            if cands:
                names[col] = min(cands, key=lambda w: w["x"] - lx)["s"].upper().replace("PHFPA", "PFHPA")
        info = {"stream": num, "caption": cap_text, "title": title, "yResidual": round(ry, 4), "xResidual": round(rx, 2),
                "series": {}}
        for col, centres in series.items():
            name = names.get(col, str(col))
            pts = sorted((ax + bx * cx, ay + by * cy) for cx, cy in centres if cy >= y0 - 15)
            info["series"][name] = len(pts)
            site = 1 if "Site 1" in cap_text else 2
            port = "halfway" if "Halfway" in cap_text else ("between" if "Between" in cap_text else "after_lag")
            z = {"halfway": 0.5, "between": 1.0, "after_lag": 2.0}[port]
            for bv, ppt in pts:
                rows_out.append([site, port, z, name, round(bv, 1), round(max(0.0, ppt), 3)])
        report.append(info)
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        f.write(HEADER)
        for r in report:
            if "series" in r:
                f.write(f"#   {r['caption']}: {r['yResidual']} ng/L (y), {r['xResidual']} BV (x)\n")
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["site", "port", "z", "species", "bed_volumes", "ng_L"])
        w.writerows(sorted(rows_out, key=lambda r: (r[0], r[2], r[3], r[4])))
    json.dump(report, open(report_json, "w"), indent=1)
    for r in report:
        print(r.get("caption"), "|", r.get("skipped") or (r["yResidual"], r["xResidual"], r["series"]))


if __name__ == "__main__":
    main(*sys.argv[1:4])
