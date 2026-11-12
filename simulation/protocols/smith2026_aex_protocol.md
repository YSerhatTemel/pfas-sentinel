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

---

## 8. Amendment A2: repeat of E6–E8 with the authors' detailed data (12 November 2026, before the files were opened)

This amendment was written **before any of the detailed data files was opened**. The commit that adds it is the registration of A2, and it is pushed to `main` before the files are opened. Any later change is labelled *post hoc* in the output JSON and the README.

### 8.1 The data, and what is already known

- **Source.** On 10 November 2026, Dr. Levi Haupert (U.S. EPA, a co-author of the paper) sent the compiled raw data behind the paper: `Smith-2026-all-data.zip`, 12,011,614 bytes, SHA-256 `2e35200625a9f140ee57d7691bfc5e14bc451fa7abff987e18e1dce497650716`.
- **Content, as his emails describe it:** two multi-tab spreadsheets with the influent of each sample and concentrations in ng/L. A few short pump-maintenance interruptions (under a day each) are accounted for in the data.
- **Sharing condition.** A processed subset may be published. The raw compiled files must not be shared or posted, so they are kept out of git (`Smith-2026-all-data/` and `*.zip` are in `.gitignore`).
- **State of the files.** The zip was extracted on 11 November 2026 into the ignored folder `Smith-2026-all-data/`. File names may have been seen during the extraction. No file has been opened. The hash above was computed on 12 November without opening the zip.
- **What is already known:** all E6–E8 results on the public workbook (README §3.8.4, `external_validation_aex.json`). The workbook gives the same samples of the same experiment as C/C0, so the shape of every curve is known.
  - This repeat is therefore **not blind**. It checks whether the E6–E8 results depend on the workbook's format. It does not test a new hypothesis.
  - These are **not unseen data**. They cannot serve as the unseen test of a model changed after E6–E8, for example the two-point twin with outlet data.

### 8.2 What the repeat changes

The repeat runs Sections 1–6 as first registered, now that the data allow it. It undoes the changes that A1 had to make because of the workbook's format:

| Item | E6–E8 (workbook, A1) | A2 repeat |
| :--- | :--- | :--- |
| Influent $C_0$ | The authors' C/C0, normalized with the mean influent of each condition (SI Table S5); $C_0 = 1$ | Measured influent of the train, as registered in Section 1 (rules below) |
| 4 ng/L crossing (S4) | Not scorable | Scored as registered in Section 3 (reporting-limit rule in 8.4) |
| Non-detects | Not in the workbook | Set to 0 ng/L, flagged, reporting limit recorded (extraction rule 2) |
| Outliers | The workbook's flags; a sensitivity run without them | Extraction rule 3 as written: a sensitivity run only if the files flag outliers themselves |

Everything else is unchanged: species, cases, cut-offs K1–K4, methods, fits, scores S1–S3, the reference scatter and every decision rule.

**$C_0$ rules (fixed now).**
- **Target train:** the mean of its influent samples on or before the cut-off (Section 1, as in E1). The target's port and outlet values are divided by this $C_0$. The S1–S3 levels, the S2 errors and the forecasts are therefore fractions of the $C_0$ known at the cut-off.
- **Cut-offs set as a fraction of $C_0$** (K1, K2 and the PFHxA ≥ 0.90 cut-off of E7): the first port sample that reaches the level times the mean influent on or before that sample's time.
- **Source train (starting curves), E8 and the reference scatter:** the mean of all influent samples of that train.
- If no influent sample exists on or before a time, the train's first influent sample is used.
- If the influent was sampled per NOM condition rather than per train, each train uses the samples of its condition.

**Throughput axis.** Run time in days, as in A1: bed volumes of the sampled bed × that bed's EBCT (the values in the header of `smith2026_aex_columns.csv`). The bed volumes account for the pump interruptions. If the files give no bed volumes, their run-time column is used. Calendar days since the first sample are used only if neither exists. Influent samples take the run time of the effluent samples taken with them.

### 8.3 Handling of the files (fixed now)

1. **Order.** First, only the structure is examined: file names, sheet names, column headers, and the categorical levels and their counts, as in A1. Anything seen beyond that is recorded in an amendment A3. A3 is committed with the extractor and the processed CSV, before any model is fitted to these data.
2. **Scope.** Only the eight trains of the paper are extracted (2 experiments × 2 NOM conditions × 2 replicates): influent, lead-effluent and lag-effluent samples of PFBA, PFHxA, PFBS, PFOA and PFNA, plus PFOS for the comparison in 8.4.
3. **Data outside that scope.** If the files hold other experiments, trains or sampling points, their values are neither extracted nor viewed. They are listed by name in A3 and set aside as possible unseen data for a separate, new protocol.
4. **Values.** As reported, in ng/L, without smoothing.
   - Non-detects are set to 0 ng/L and flagged, and their reporting limit is recorded. Values below the reporting limit that are reported as numbers are kept as given and flagged.
   - Labelled quality-control samples (blanks, spikes, calibration checks) are left out.
   - Repeat analyses of one sample (same train, point, species and time) are averaged. Duplicate trains are never averaged.
5. **Mapping check.** Before any model is fitted, the extractor compares its output with the workbook CSV (`smith2026_aex_columns.csv`):
   - the trains, sampling points and species;
   - the number of samples and their run times;
   - for matching samples, ng/L divided by the condition's mean influent against the workbook's C/C0.

   Differences are listed in A3. If the check shows that the workbook CSV mislabels a train, a sampling point or a time, E6–E8 are rerun with a corrected CSV. Both versions are then reported, and the rerun is labelled as a correction.
6. **Public subset.** The processed CSV `simulation/data/smith2026_aex_detailed.csv` holds only what the analysis needs: experiment, NOM condition, replicate, sampling point (influent / lead / lag), species, run time in days, ng/L, the non-detect flag, the reporting limit, and an outlier flag if the files have one. Its header records the SHA-256 of the zip and of each file used, and the sharing condition. The extractor `simulation/tools/extract_smith2026_detailed.py` reads the raw files from the ignored folder, so it cannot run in CI. The raw files are never committed.

### 8.4 Added in A2 (reported only; cannot change any verdict)

These items use the ng/L values, which E6–E8 did not have.

- **Reporting limit.** S4, K0 and the comparison below are used for a species only if its reporting limit is ≤ 2 ng/L (Section 3). The limit is read from the files and must hold for every non-detect at the port and the outlet. If the files give no limits, the limit stated in the paper or its SI is used. If neither gives one, these items are reported as not scorable.
- **Cut-off K0:** the first port sample with PFOA ≥ 4 ng/L. This is the moment a port sensor set to the U.S. limit would first alarm. Every method and score is run at K0, as at K1–K4.
- **Expectation for S4, stated in advance:** the travelling-wave twin is also late at 4 ng/L. The 4 ng/L level (about 1 % of $C_0$) lies on the foot of the curve, where E6 found the constant-shape mapping too late.
- **Model-free port lead at 4 ng/L** (as in README §3.8.2): for every train, for PFOA and PFOS, the port's first sample at or above 4 ng/L against the outlet's observed 4 ng/L interval. Reported: both run times and their ratio (port time ÷ the outlet's first sample at or above 4 ng/L). If the outlet never reaches 4 ng/L, the lead is reported as at least the rest of the record.

### 8.5 Verdicts and reporting

- **The primary results stay those of E6–E8 on the workbook.**
- The repeat applies the decision rules of Sections 3 and 4, unchanged, to the new data. For each of the three verdicts (travelling-wave twin, two-point twin, tracer claim), the README states whether the repeat agrees.
  - If a verdict does not agree, the README says that it depends on the data format and in which direction it moved. The primary verdict is not replaced.
- **Expectation, stated in advance:** all three verdicts agree, because the influent varied by only about 5–8 % of its mean (SI Table S5) and the samples are the same.
- **Outputs.** `simulation/external_validation_aex_a2.py` writes `simulation/external_validation_aex_a2.json`; its tests go in `simulation/test_external_validation_aex_a2.py`. The script imports the fits, methods and scores of `external_validation_aex.py` (as of commit `e466b2f`) instead of copying them. It adds only the loading, the $C_0$ rules, K0, S4 and the comparison in 8.4.
- **Order of commits:**
  1. this amendment, pushed to `main` before the files are opened;
  2. A3, the extractor and the CSV, before any model is fitted;
  3. the analysis script, before its first run;
  4. the JSON, the tests and the README section, together.
- The README gets a short subsection in §3.8.4 with every result, including failures. The outcome is also sent to Dr. Haupert.

---

## 9. Amendment A3: what the detailed files contain (12 November 2026, before any model was fitted to them)

This amendment was written after the structure of the files had been examined and the extractor had been written. It is committed together with the extractor and the processed CSV. **No model had been fitted to these data at that point.**

### 9.1 What was looked at

- File names, sizes and SHA-256 hashes; the sheet names; the first rows of every sheet with all numbers masked.
- The text of the `ReadMe` and `ChangeLog` sheets.
- In the sheet `ALL_DATA`:
  - the column headers;
  - the categorical levels and their counts (train, sampling point, replicate label, sample type, treatment, experiment description);
  - the median EBCT per train and sampling point;
  - the run-time columns, compared with the workbook's run times;
  - the sample IDs of rows that share a run time.
- Aggregates of the mapping check: shares within a tolerance, largest differences, and the ratio of the implied normalization constant to the mean influent.
- The paper and the SI were searched for a PFAS reporting limit.

**No individual PFAS concentration was viewed.**

### 9.2 What the files contain

- **Two workbooks, one per experiment.** `121RC_…` is Experiment 1 (nominal EBCT 0.5 / 1.0 min) and `146RC_…` is Experiment 2 (1.5 / 2.5 min). Each holds a compiled table (`ALL_DATA`) plus laboratory reports, pivot tables, plots, model inputs, flow logs, and inorganic and carbon data. Only `ALL_DATA` is used.
- **`ALL_DATA`** has one row per sample. It gives:
  - the train (1–4; trains 1–2 are +NOM, trains 3–4 −NOM);
  - the sampling point (c0 influent, c1 lead effluent, c2 lag effluent);
  - the collection time and the run time ("Collection Experiment Time (days)");
  - bed volumes;
  - ng/L of nine PFAS.
- **Every train has its own influent samples:** 74–119 PFOA influent samples per train.
- **Non-detects** are written "<MRL". The value of the MRL is not given in the files, nor in the paper or the SI (which refer to the analytical method papers).
- **Laboratory duplicates.** Rows that share a run time within a train and sampling point are two analyses of one sample (sample ID and ID + "DUP"): 129 such pairs in Experiment 1 and 111 in Experiment 2.
- **Outliers.** The change log says that the authors replaced the values they judged outliers with "na". There is no outlier flag. In Experiment 1, 89 values that the workbook gives are "na" in the files.
- **More samples than the workbook.** The files hold samples that the paper's figures do not show, most of them in Experiment 2. In one train, for example, there are 79 PFOA lag samples against 26 in the workbook.
- **Adjusted run time.** The files also give an adjusted run time. It is up to 2.0 days shorter late in Experiment 1 and equal to the run time in Experiment 2 (where it is often an error value). The published bed volumes do not use it.
- **Not in scope, not extracted:**
  - blanks and controls;
  - three Experiment 1 samples at a fourth sampling point ("cft");
  - nine blanks of Experiment 2.
  
  The sheet `PFASdbf`, a laboratory database export of inorganic and carbon analyses, also lists samples of other studies. It holds no PFAS concentrations and is not used. No other experiment or train has PFAS data in the files.

### 9.3 Consequences, fixed now

1. **Time axis.** The files' bed-volume columns use the nominal EBCT, so A2's "bed volumes × A1's EBCT" would distort the time axis. The run time itself is in the files: "Collection Experiment Time (days)". Under one constant factor per train and bed, it reproduces the run time of every one of the 3,760 workbook samples of the six species. A2 therefore uses this run time for every sample, influent included. The rule "influent samples take the run time of the effluent samples taken with them" (8.2) is not needed.
2. **A correction to A1, for Experiment 2.**
   - In Experiment 1 the factor is 1: A1's time axis is exact.
   - In Experiment 2 the authors' bed volumes imply EBCTs (lead / train) of 1.60 / 2.63, 1.57 / 2.64, 1.57 / 2.66 and 1.64 / 2.71 min, for +NOM replicates 1 and 2 and −NOM replicates 1 and 2.
   - A1 used the two-digit train EBCTs of SI Table S3 (2.6 and 2.7 min). Its Experiment 2 run times are therefore off by a constant factor per train: 0.989, 0.985, 1.015 and 0.996. The two −NOM replicates differ from each other by 1.9 % in that factor.
   - Under 8.3.5 this is a time error in the workbook CSV. **E6–E8 are therefore rerun on the workbook data with corrected Experiment 2 run times**: workbook bed volumes × the EBCT from run time ÷ 1440 (the values are in the header of `smith2026_aex_detailed.csv`). Both versions are reported, and the rerun is labelled as a correction. The primary results stay the registered ones.
   - The A2 repeat is compared with both: with the primary results, and with the corrected rerun, which isolates the effect of the data format.
3. **Influent $C_0$.** Each train's own influent samples, as in 8.2. Ten influent rows of Experiment 2 have no run time and are left out.
4. **Reporting limit.** Not given anywhere. As 8.4 foresaw, S4, K0 and the model-free 4 ng/L comparison are therefore **not scorable** and are not run. If the authors later state the MRL, these items may be run as registered in 8.4, labelled as added after the A2 results.
5. **Outliers.** The files do not flag them, so there is no sensitivity run (extraction rule 3). The repeat uses the files' values, so the samples the authors set to "na" are absent. The primary E6–E8 kept the 19 flagged samples.
6. **Laboratory duplicates** are averaged (8.3.4).
7. **Mapping check (8.3.5).**
   - Trains, sampling points and sample times match the workbook: all 3,760 samples under the assumed train → replicate mapping.
   - For matched samples, ng/L divided by the authors' influent mean of that row agrees with the workbook's C/C0 within 0.01 for 66 % of samples. With the replicates swapped, this drops to 44 % (Experiment 1) and 33 % (Experiment 2), which confirms the mapping.
   - The workbook's C/C0 equal the files' ng/L divided by one constant per condition and species within 0.01 for 78–80 % of samples. The constants lie within −3.4 % to +8.1 % of the mean influent of each condition. This is consistent with the paper's normalization by one mean influent per condition (SI Table S5).
   - 96 samples differ by more than 0.05, mostly PFHxA and PFBA near or above C/C0 = 1.
   - None of these differences points to a mislabelled train, sampling point or sample.
8. **The processed CSV** has 10,091 rows: influent, lead-effluent and lag-effluent samples of the six species in the eight trains.
9. **Unchanged:** everything else in A2, including the $C_0$ rules, cases, cut-offs K1–K4, methods, decision rules and expectations.
