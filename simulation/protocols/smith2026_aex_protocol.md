# Pre-registered protocol: third external check on the Smith et al. (2026) anion-exchange columns (E6–E8)

**Status:** written on 10 November 2026, **before the data workbook was downloaded or opened**. The commit that adds this file is the registration. Every step below is fixed by that commit. Any later change is labelled *post hoc* in the output JSON and the README, as was done for E1 (`POST_HOC_NOTE` in `external_validation.py`).

**Code version the methods refer to:** commit `b5e6eca` (`simulation/external_validation.py`, `simulation/external_validation_fullscale.py`, `simulation/pfas_sentinel_core.py`). The twin settings are `TWIN_CONFIG`, unchanged.

---

## 1. Data

- **Paper:** Smith, S. J., Wahman, D. G., …, Haupert, L. M. (2026). Implications for modeling anion exchange treatment of perfluoroalkyl substances in drinking water and related natural organic impacts: a pilot study. *Water Research* 288: 124685. https://doi.org/10.1016/j.watres.2025.124685
- **Dataset:** U.S. EPA ScienceHub, https://doi.org/10.23719/1532427, workbook "Smith_SciHub_AEX_gel_columns_pilots (July 2025)". Its SHA-256 is recorded in the header of the extracted CSV.
- **Setup (from the paper and SI, Table S3):**
  - Purolite PFA694E gel resin.
  - Four trains, each with two columns in series (lead and lag), two replicate trains per condition.
  - Influent: distilled water with inorganic anions and nine PFAS at about 400–600 ng/L each (SI Table S5). It is run without NOM (−NOM) or with 2 mg C/L reconstituted Ohio River NOM (+NOM).
  - Experiment 1 ("short beds"): lead 8.15 g, lead + lag 16.3 g dry resin (nominal EBCT 0.5 / 1.0 min).
  - Experiment 2 ("long beds"): lead 26.7 g, lead + lag 44.5 g (nominal EBCT 1.5 / 2.5 min).
  - Flow about 40 mL/min in every train.
  - The two experiments used **different resin lots**.
  - Samples were taken at the influent (head of the lead column), the lead effluent and the lag effluent.

### Mapping to the twin

| Twin quantity | Here |
| :--- | :--- |
| Mid-bed port, relative depth $z_p$ | Lead-column effluent. $z_p$ = lead resin mass / train resin mass = **0.500** (Experiment 1), **0.600** (Experiment 2) |
| Outlet, $z = 1$ | Lag-column effluent (end of the lead + lag train) |
| Throughput axis $t$ | Cumulative volume treated per gram of dry resin in the whole train (L/g), from the workbook's time or bed volumes and the train's flow (Table S3). A constant rescaling of this axis is allowed if a fit reaches a grid bound; it does not change any result. |
| Influent $C_0$ | Mean measured influent of the target train on or before the cut-off (as in E1) |

### Extraction rules (fixed now)

1. A script `simulation/tools/extract_smith2026_workbook.py` writes `simulation/data/smith2026_aex_columns.csv`. The columns are: experiment, NOM condition, replicate, sampling point (influent / lead / lag), species, throughput, ng/L, flag.
   - The script may be written after viewing the workbook's sheet names and column headers.
   - No model is fitted until the CSV is committed.
2. Values are used as reported, with no smoothing.
   - Non-detects are set to 0 ng/L and flagged, and their reporting limit is recorded.
   - PFHxA values above the influent (C/C0 > 1, the chromatographic overshoot reported in the paper) are kept unchanged.
3. The paper excluded 10 samples as outliers for its own bed-volume benchmarks.
   - **Primary analysis:** all samples are kept.
   - **Sensitivity run:** if the workbook flags those samples, the analysis is repeated without them. If they are not flagged, no sensitivity run is done.
4. If the workbook does not contain per-sample lead and lag effluent data, this protocol is not run on figures. The detailed data that Dr. Haupert offered will be requested instead. Figures are not digitized for this check.
5. A subset of the data goes into the public repository only if the ScienceHub licence or the authors allow it.

### Species

- **Used:** PFBA, PFHxA, PFBS, PFOA, PFNA.
- **Left out:**
  - PFDA, PFHxS and PFOS: they did not reach 50 % breakthrough in any condition, so there is too little curve to score.
  - GenX: its plateau is attributed to non-adsorptive removal, and its influent varies between analytical lots.
- **Primary species:** PFOA. It is the regulated PFAS with breakthrough data in every train.

---

## 2. What we already know (disclosure)

Before writing this protocol, the user and Claude read the paper and its SI. That includes:
- the abstract and the text,
- Table 1 (BV10 / BV50 / BV90 per PFAS, EBCT and NOM condition, and the % change with NOM),
- the descriptions of Figures 1–5 and S1–S12,
- Tables S3 and S5.

In particular we know that:
- NOM changed BV10 by only −2.8 % (PFBA) and +2.2 % (PFHxA) but by about −50 % for PFOA (0.5-min EBCT);
- PFHxA overshoots in the long beds;
- GenX plateaus.

The workbook itself has not been downloaded or opened.

---

## 3. E6: forecast the outlet from the mid-bed port (the app's use case)

**Question:** Does the twin forecast the lag-effluent ($z = 1$) breakthrough from lead-effluent ($z_p$) samples, given a starting curve from a replicate train? This is E4 (Crew 2021) under controlled conditions, with a measured influent series and replicate scatter.

- **Cases:** within each experiment and NOM condition, source replicate → target replicate, both directions. That gives 2 experiments × 2 NOM conditions × 2 directions = **8 cases**. Starting values never cross experiments, because the resin lots differ.
- **Starting values:** per-species curves fitted to **all** data of the source train (port and outlet).
- **Cut-offs (in the target train):**
  - **K1 (primary):** the first lead-effluent sample with PFOA C/C0 ≥ 0.10. This is the moment a utility's mid-bed port would first show PFOA.
  - K2: the first lead-effluent sample with PFOA C/C0 ≥ 0.50.
  - K3, K4: 1/3 and 1/2 of the target train's record, for comparison with E4.
  - A cut-off whose event never occurs is reported as "no case".
- **Training data:** target lead-effluent samples of all five species at or before the cut-off, at $z = z_p$. The twin learns from the port only, as in E4. A secondary variant also adds the target's lag-effluent samples at or before the cut-off.
- **Test data:** target lag-effluent samples after the cut-off.

### Methods

The first six are identical to E4. The last two are new and defined here.

| Method | Definition |
| :--- | :--- |
| STATIC | Thomas design curve fitted to all source data (port and outlet, travelling-wave scaling), unchanged |
| TWIN | Same curve plus two shared bed-condition factors learned from the target port (`core.train_twin`) |
| INDEPENDENT | Same, but each species learns its own two factors |
| MIDBED_ONLY | Thomas curve fitted to the target port data alone, mapped to $z = 1$ (no design curve) |
| STATIC_ASYM | As STATIC with the Richards curve of E3 |
| TWIN_ASYM | As TWIN with the Richards curve (`train_shared_richards`) |
| **STATIC_OUTLET_ASYM** (new) | Richards curve fitted to the source **outlet** data alone, unchanged. There is no depth scaling. |
| **TWOPOINT_ASYM** (new) | Separate Richards curves fitted to the source **port** data and the source **outlet** data, each treated as its own curve ($z = 1$ in the fit). The two shared factors are learned on the target port data against the source port curves (`train_shared_richards`, same settings, with $z = 1$). The outlet forecast is the source outlet curve with the same factors applied ($a \cdot e^{\theta_0}$, $t_0 \cdot e^{\theta_1}$). This takes the change of the front with depth from the replicate train instead of assuming it keeps its shape. It is the candidate fix for the E4 failure. It needs only existing functions. |

### Scores

- **S1 (primary):** PFOA outlet crossing of C/C0 = 0.10, compared with the observed sampling interval and classified early / inside / late (`classify`, `observed_bracket`). Only cases still open at the cut-off are scored. *Late* is the unsafe direction.
- **S2:** RMSE on the later outlet samples as % of $C_0$, for PFOA (primary) and pooled over the five species.
- **S3:** the same as S1 for C/C0 = 0.50.
- **S4:** the absolute 4 ng/L outlet crossing (about 0.7–1 % of $C_0$). It is scored only if the reporting limit is ≤ 2 ng/L; otherwise it is reported as not scorable.
- **Reference scatter:** the RMSE between the two replicate trains' outlet data at matched throughput (linear interpolation), as % of $C_0$. Differences smaller than this are reported as "within replicate scatter".

### Decision rules (fixed now)

- **The travelling-wave twin passes E6** if TWIN_ASYM at K1 meets both conditions:
  - it is late in at most 2 of the open PFOA S1 cases, and
  - its mean PFOA S2 is no worse than STATIC_ASYM's by more than the reference scatter.
- **TWOPOINT_ASYM counts as the fix for the E4 failure** if, at K1:
  - it is late in at most 2 of the open PFOA S1 cases, and
  - it has fewer late cases than TWIN_ASYM.
- **If neither passes:** the decision layer stays as it is (model-free mid-bed guard plus operator sign-off), and the README says so.
- **What does not change the verdict:** results at K2–K4, for the other species and for the secondary variant are reported but cannot change the verdict.

---

## 4. E7: can short-chain tracers carry the NOM effect? (README §5 claim)

**Question:** README §5 (and the Innovation row of the summary table) says PFBA and PFBS "teach the twin the bed's condition months before PFOA/PFOS move". With a −NOM starting curve, can factors learned from the short-chain species alone predict the earlier PFOA breakthrough under +NOM?

On this resin PFBS elutes **after** PFOA (paper, Section 3.2), so it is not a fast tracer here. PFHxA takes its place as the second short-chain tracer, as in E4.

- **Cases:** within each experiment, the −NOM replicate *i* is the source for the +NOM replicate *i* (same resin lot). That gives 2 experiments × 2 replicates = **4 cases**.
- **Cut-off:** the first target lead-effluent sample with PFHxA C/C0 ≥ 0.90. At that point the tracers' information is in, and PFOA has normally not yet appeared at the port.
- **Training data:** target lead-effluent samples of PFBA and PFHxA only, at or before the cut-off.
- **Methods:**
  - STATIC_ASYM: the −NOM PFOA curve, unchanged.
  - TRACER_TWIN_ASYM: the two shared factors from PFBA and PFHxA applied to the PFOA curve.
- **Scores:** the PFOA C/C0 = 0.10 crossing at the port ($z_p$) and at the outlet, against the observed sampling intervals (early / inside / late). Also the signed error as % of the observed interval midpoint.
- **Expectation, stated in advance:** from the paper's Table 1, the NOM effect on PFBA and PFHxA is close to zero while PFOA moves by about −50 %. So both methods are expected to be **late** for PFOA under +NOM, and the tracer factors are expected to stay near 1.
  - Also known in advance: the factor bound `phiBound = log(1.6)` would cap the correction at a factor of 0.625, even if the tracers did carry the signal. The bound is not changed.
- **Interpretation:**
  - If the expectation holds, the README must narrow the tracer claim: tracers carry bed-condition information only for effects that act on all species alike, and not for NOM competition on an anion-exchange resin.
  - If TRACER_TWIN_ASYM is inside or early in ≥ 3 of 4 cases at the outlet, the claim is supported for this resin.

---

## 5. E8: physics check of the depth scaling (no prior, no cut-off)

**Question:** Does the breakthrough front keep its shape between $z_p$ and $z = 1$? E4 found the outlet's 50 % point 1.5–1.7 times earlier than the travelling-wave mapping predicts.

- **Data:** per train and species, only where the paper's own fitting criterion holds at **both** sampling points: at least two points ≥ 0.5 C/C0 and at least four points between 0.025 and 0.95 C/C0.
- **Fits:** Richards curves fitted separately to the port data and to the outlet data.
- **Reported quantities:**
  - $R_{50} = t_{50,\text{outlet}} \cdot z_p / t_{50,\text{port}}$. This is 1 if the 50 % point moves linearly with depth; E4's value would be about 0.6.
  - $R_a = a_{\text{outlet}} / a_{\text{port}}$. This is 1 if the shape is unchanged in throughput; it is below 1 if the front spreads.
  - Medians are reported by species and NOM condition.
- There is no pass/fail.
- **Interpretation, stated in advance:**
  - If $R_{50} \approx 1$ here, E4's early outlet more likely reflects site factors there (bed volumes ±10 %, port placement, influent known only as averages).
  - If $R_{50} < 1$ here as well, the travelling-wave mapping itself needs the depth correction.

---

## 6. Outputs and reporting

- Script `simulation/external_validation_aex.py` writes `simulation/external_validation_aex.json`, standard library only, reusing `external_validation.py`. Tests go in `simulation/test_external_validation_aex.py`.
- README: a new Section 3.8.4 with every case, including failures. The limits must be stated:
  - one resin and two resin lots;
  - synthetic water with one NOM source;
  - laboratory-scale columns (2.6 cm diameter);
  - anion exchange, not GAC;
  - influent about 100 times the 4 ng/L level.
- This is a controlled third check. It does **not** replace a full-scale GAC dataset with a mid-bed port; README §3.8.3 keeps that item open.
- EPA's IEX-CM simulations in the paper are in-sample fits and are not used as a baseline.

---

## 7. Amendment A1: what the workbook contains (10 November 2026, before any model was fitted)

This amendment was written after the workbook had been downloaded (SHA-256 `d19d9962c3d4e78076842d080cb208bdb783d99f4031b8c06ac166f86c0cb8bd`) and its structure had been examined. **No model had been fitted at that point.** It is committed together with the extracted CSV, before the analysis code exists.

### What was looked at

- The sheet names and column headers.
- The categorical levels and their counts (species, nominal EBCT, NOM condition and replicate, outlier flags).
- The bed-volume values of one train and species (PFBA, −NOM, Experiment 1, Replicate 1) and the largest bed volume of every train.
- One concentration value: the earliest PFBA lead-effluent sample of the +NOM Experiment 1 Replicate 1 train, which appeared in an error message while the extractor was being written.

No other concentration value was viewed.

### What the workbook contains

The workbook has no table of raw results. Instead, sheets `Fig1` (PFCAs) and `Fig2` (PFSAs, GenX) list **every sample plotted in Figures 1 and 2 as numbers**. For each sample they give:
- the species,
- the nominal EBCT (0.5 and 1.5 min = lead effluent; 1.0 and 2.5 min = lag effluent),
- the NOM condition and replicate,
- bed volumes ×1000 of that bed,
- C/C0,
- the authors' outlier flag.

These are exact tabulated values, not values read from a picture. Extraction rule 4 ("not run on figures; figures are not digitized") was written to exclude digitizing. These sheets therefore count as per-sample lead and lag effluent data, and the protocol is run on them.

### Consequences, fixed now

1. **No per-sample influent and no ng/L values.** C/C0 is given as normalized by the authors with the mean influent of each condition (SI Table S5; influent standard deviation about 5–8 % of the mean).
   - The model therefore works in C/C0 with $C_0 = 1$. This replaces "mean measured influent on or before the cut-off".
   - **S4 (4 ng/L) is not scorable**, as foreseen in Section 3.
   - Non-detect flags and reporting limits are not available; values are used as given.
2. **Throughput axis.** Run time in days = BV × EBCT (the authors computed BV from run time and the actual EBCT).
   - The train EBCT comes from Table S3.
   - The lead EBCT is derived from the ratio of the last lead and lag bed volumes. It agrees with Table S3 within its rounding for all eight trains; the values are listed in the CSV header.
   - Flow is 40 mL/min in every train, and resin mass is equal within an experiment. Run time is therefore proportional to the protocol's throughput per gram of resin within an experiment, and starting curves never cross experiments.
   - $z_p$ stays at the resin-mass values 0.500 and 0.600.
3. **Outliers.** The workbook flags 11 samples in `Fig1` and 8 in `Fig2`. The primary analysis keeps them. The sensitivity run (extraction rule 3) excludes the flagged samples.
4. **Unchanged.** Everything else in Sections 1–6 is unchanged: species, cases, cut-offs, methods, scores and decision rules.

The detailed underlying data that Dr. Haupert offered (with influent per sample and ng/L values) will be used to repeat the analysis as a check if they arrive. The primary results remain the ones from this workbook.
