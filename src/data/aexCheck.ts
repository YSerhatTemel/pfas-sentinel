/**
 * Third external check (README Section 3.8.4): the pre-registered E6–E8 on the EPA anion-exchange columns of
 * Smith et al. (2026). Registered results: simulation/external_validation_aex.json. Time-corrected rerun and the
 * repeat with the authors' detailed data (amendments A2–A3): simulation/external_validation_aex_a2.json.
 * The `?summary` imports leave out only the per-case arrays (vite.config.ts); every number below is read
 * from those two files.
 */
import registeredJson from '../../simulation/external_validation_aex.json?summary';
import a2Json from '../../simulation/external_validation_aex_a2.json?summary';

export type AexMethod =
  | 'STATIC'
  | 'TWIN'
  | 'INDEPENDENT'
  | 'MIDBED_ONLY'
  | 'STATIC_ASYM'
  | 'TWIN_ASYM'
  | 'STATIC_OUTLET_ASYM'
  | 'TWOPOINT_ASYM';

export interface Counts {
  early: number;
  inside: number;
  late: number;
}

interface Run {
  E6: {
    /** Replicate scatter of the PFOA outlet, fraction of C0, per experiment and NOM condition, plus `mean`. */
    referenceScatter: Record<string, number>;
    summary: Record<string, { byMethod: Record<AexMethod, { meanS2primary: number; S1: Counts; S3: Counts }> }>;
    verdict: {
      openPfoaS1CasesAtK1: number;
      lateAtK1: Record<AexMethod, number>;
      travellingWaveTwinPasses: boolean;
      twopointCountsAsFix: boolean;
    };
  };
  E7: { counts: Record<string, Counts>; verdict: { tracerClaimSupported: boolean } };
  E8: { medians: Record<string, { n: number; R50: number; Ra: number }> };
}

interface RegisteredReport extends Run {
  dataset: { trains: Record<string, { recordEndD: number }> };
  protocol: { registrationCommit: string; amendmentA1Commit: string };
}

interface A2Report {
  protocol: { amendmentA2Commit: string; amendmentA3Commit: string };
  correction: Run & { timeFactors: Record<string, number> };
  repeat: Run;
}

const registered = registeredJson as RegisteredReport;
const a2 = a2Json as A2Report;

/** Cut-off at which the decision rules are applied (protocol Section 3). */
const DECISION_CUTOFF = 'K1';
/** Pass bar fixed in the protocol before the data were opened: at most 2 late outlet forecasts. */
export const AEX_PASS_BAR_MAX_LATE = 2;

const range = (values: number[]): [number, number] => [Math.min(...values), Math.max(...values)];

export interface AexRunSummary {
  /** PFOA outlet 10% crossings still open at cut-off K1 (both directions). */
  open: number;
  /** The travelling-wave twin as the decision rule tests it (asymmetric curve, TWIN_ASYM). */
  twinLate: number;
  twopointLate: number;
  tracerLate: number;
  tracerScored: number;
  verdicts: { twinPasses: boolean; twopointIsFix: boolean; tracerSupported: boolean };
  /** Per method at K1: PFOA error on the later outlet samples (fraction of C0) and the 10% crossing counts. */
  methods: Record<AexMethod, { error: number; crossing: Counts }>;
  /** Replicate scatter (fraction of C0): range over the four conditions, and their mean. */
  scatter: { min: number; max: number; mean: number };
  /** E8 medians: 50%-point ratio to a linear depth mapping, and outlet/port slope ratio (ranges over species and NOM). */
  e8: { r50: [number, number]; slope: [number, number] };
}

function summarize(run: Run): AexRunSummary {
  const byMethod = run.E6.summary[DECISION_CUTOFF].byMethod;
  const tracer = run.E7.counts['TRACER_TWIN_ASYM@outlet'];
  const conditions = Object.entries(run.E6.referenceScatter).filter(([key]) => key !== 'mean').map(([, v]) => v);
  const medians = Object.values(run.E8.medians);
  return {
    open: run.E6.verdict.openPfoaS1CasesAtK1,
    twinLate: run.E6.verdict.lateAtK1.TWIN_ASYM,
    twopointLate: run.E6.verdict.lateAtK1.TWOPOINT_ASYM,
    tracerLate: tracer.late,
    tracerScored: tracer.early + tracer.inside + tracer.late,
    verdicts: {
      twinPasses: run.E6.verdict.travellingWaveTwinPasses,
      twopointIsFix: run.E6.verdict.twopointCountsAsFix,
      tracerSupported: run.E7.verdict.tracerClaimSupported,
    },
    methods: Object.fromEntries(
      Object.entries(byMethod).map(([m, v]) => [m, { error: v.meanS2primary, crossing: v.S1 }]),
    ) as AexRunSummary['methods'],
    scatter: { min: Math.min(...conditions), max: Math.max(...conditions), mean: run.E6.referenceScatter.mean },
    e8: { r50: range(medians.map((m) => m.R50)), slope: range(medians.map((m) => m.Ra)) },
  };
}

/** Did the time correction leave every early/inside/late count (S1 and S3, all cut-offs, all methods) unchanged? */
function countsUnchanged(a: Run, b: Run): boolean {
  return Object.entries(a.E6.summary).every(([cutoff, s]) =>
    (Object.keys(s.byMethod) as AexMethod[]).every((m) =>
      (['S1', 'S3'] as const).every((score) => {
        const x = s.byMethod[m][score];
        const y = b.E6.summary[cutoff].byMethod[m][score];
        return x.early === y.early && x.inside === y.inside && x.late === y.late;
      }),
    ),
  );
}

/** Largest change of the PFOA error (fraction of C0) between two runs, over all cut-offs and methods. */
function maxErrorShift(a: Run, b: Run): number {
  return Math.max(
    ...Object.entries(a.E6.summary).flatMap(([cutoff, s]) =>
      (Object.keys(s.byMethod) as AexMethod[]).map((m) =>
        Math.abs(s.byMethod[m].meanS2primary - b.E6.summary[cutoff].byMethod[m].meanS2primary),
      ),
    ),
  );
}

const trainDays = Object.values(registered.dataset.trains).map((t) => t.recordEndD);

export const AEX_CHECK = {
  /** Registered result on the EPA workbook (shown first everywhere). */
  registered: summarize(registered),
  /** The same analysis with our Experiment 2 time axis corrected (A3). */
  corrected: summarize(a2.correction),
  /** Repeat with the authors' detailed per-sample data (A2). */
  repeat: summarize(a2.repeat),
  correction: {
    /** Size of our own Experiment 2 time-axis error, per train (fraction). */
    timeError: range(Object.values(a2.correction.timeFactors).map((f) => Math.abs(f - 1))),
    countsUnchanged: countsUnchanged(registered, a2.correction),
    maxErrorShift: maxErrorShift(registered, a2.correction),
  },
  trainPairs: Object.keys(registered.dataset.trains).length / 2,
  /** Length of the runs in months (min, max over the eight trains). */
  months: range(trainDays.map((d) => d / (365.25 / 12))),
  commits: {
    registration: registered.protocol.registrationCommit,
    amendmentA1: registered.protocol.amendmentA1Commit,
    amendmentA2: a2.protocol.amendmentA2Commit,
    amendmentA3: a2.protocol.amendmentA3Commit,
  },
};
