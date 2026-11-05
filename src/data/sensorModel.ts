/**
 * 32-channel MIP/NIP electrochemical sensor: forward simulator, simulated factory calibration and the
 * blind edge estimator. The estimator never sees the forward formulas or the true concentrations:
 * it only uses (a) pure-standard calibration runs at a reference matrix and (b) blank/spike runs in a
 * spread of water matrices - exactly the data a TRL 4 wet-lab calibration would produce.
 *
 * Channel groups (7 working electrodes each) are imprinted for PFBA, PFBS, PFOA and PFOS; channels
 * 29-32 are non-imprinted (NIP) blanks. Each group responds to all four species through the
 * cross-selectivity matrix S, so the four group signals are four independent measurements and the
 * 4x4 Tikhonov solve genuinely separates the mixture.
 *
 * Mirrored line-for-line in simulation/pfas_sentinel_core.py.
 */
import { SPECIES_ORDER } from './species';
import type { SpeciesId } from './species';
import { gaussian, hundredths, mulberry32, seedFrom } from './rng';
import { conditionNumber2, determinant, leastSquares, matMul, solveLinearSystem, transpose } from './linalg';

/** Rows: channel groups (PFBA, PFBS, PFOA, PFOS imprint); columns: species (same order). Design assumption. */
export const CROSS_SELECTIVITY: number[][] = [
  [1.0, 0.14, 0.11, 0.04],
  [0.12, 1.0, 0.05, 0.13],
  [0.09, 0.04, 1.0, 0.15],
  [0.03, 0.11, 0.14, 1.0],
];
export const GROUP_SENSITIVITY_OHM = [59, 64, 72, 78];
export const GROUP_FOULING_COUPLING = [1.0, 1.05, 0.96, 1.03];
export const NIP_FOULING_COUPLING = 0.92;
export const NIP_NONSPECIFIC_FRACTION = 0.0075;
export const CHANNELS_PER_GROUP = 7;
export const NIP_CHANNELS = 4;
/** Assumed baseline charge-transfer resistance of a working electrode (design assumption). */
export const BASELINE_RCT_OHM = 400;
/** Assumed per-electrode Delta-Rct noise (about 1% of the baseline); a design assumption, not a measurement. */
export const CHANNEL_NOISE_OHM = 4.0;
export const CHANNEL_GAIN_SPREAD = 0.03;
export const SONDE_NOISE = { tempC: 0.1, pH: 0.02, conductivityRel: 0.01, turbidityRel: 0.03, fdomRel: 0.05 };
export const FDOM_QSU_PER_MG_L = 24.5;
export const TIKHONOV_LAMBDA_REL = 1e-3;
export const ACTIVATION_ENERGY_OVER_R = 2165;
export const AMINE_PKA = 8.4;
export const DEBYE_OFFSET_NM = 1.5;
export const CALIBRATION_SEED = 20261105;
export const STANDARD_LEVELS_PPT = [0, 2, 5, 10, 25, 50];
/** Each pure standard is measured this many times during factory calibration. */
export const CALIBRATION_REPLICATES = 3;
export const CALIBRATION_MATRICES = 48;
export const SPIKE_PPT = 10;

export interface SensorMatrix {
  tempC: number;
  pH: number;
  conductivityUsCm: number;
  turbidityNTU: number;
  nomMgL: number;
  cartridgeAgeDays: number;
}

export const REFERENCE_MATRIX: SensorMatrix = {
  tempC: 20,
  pH: 7.0,
  conductivityUsCm: 300,
  turbidityNTU: 0.1,
  nomMgL: 0.2,
  cartridgeAgeDays: 0,
};

export interface SensorOptions {
  assayMode?: 'quantitative' | 'screening';
  formFactor?: 'flow-cell' | 'sample-cup';
  noiseScale?: number;
}

export interface SondeReading {
  tempC: number;
  pH: number;
  conductivityUsCm: number;
  turbidityNTU: number;
  fdomQsu: number;
  cartridgeAgeDays: number;
}

export interface SensorReading {
  groupMeanOhm: number[];
  groupCvPct: number[];
  nipMeanOhm: number;
  specificOhm: number[];
  crossTalkOhm: number[];
  driftOhm: number;
  foulingOhm: number;
  gain: number;
  debyeLengthNm: number;
  amineProtonationPct: number;
  sonde: SondeReading;
}

export function debyeLengthNm(conductivityUsCm: number): number {
  return 0.304 / Math.sqrt(Math.max(5e-4, conductivityUsCm * 1.6e-5));
}

export function amineProtonationFraction(pH: number): number {
  return 1 / (1 + Math.pow(10, pH - AMINE_PKA));
}

/** True (hidden) sensitivity multiplier: temperature, surface protonation, Debye screening, ageing. */
export function trueGain(m: SensorMatrix, opts: SensorOptions = {}): number {
  const gT = Math.exp(ACTIVATION_ENERGY_OVER_R * (1 / 293.15 - 1 / (m.tempC + 273.15)));
  const gP = amineProtonationFraction(m.pH) / amineProtonationFraction(7.0);
  const lam = debyeLengthNm(m.conductivityUsCm);
  const lamRef = debyeLengthNm(300);
  const gD = lam / (lam + DEBYE_OFFSET_NM) / (lamRef / (lamRef + DEBYE_OFFSET_NM));
  const gAge = 1 - 0.004 * m.cartridgeAgeDays;
  const gMode = (opts.assayMode === 'screening' ? 0.78 : 1) * (opts.formFactor === 'sample-cup' ? 0.94 : 1);
  return gT * gP * gD * gAge * gMode;
}

export function baselineDriftOhm(m: SensorMatrix): number {
  const dT = m.tempC - 20;
  return -1.48 * dT + 0.018 * dT * dT - 9.4 * (m.pH - 7) - 0.037 * (m.conductivityUsCm - 300);
}

export function foulingOhm(m: SensorMatrix): number {
  return (
    (6.4 * Math.pow(m.nomMgL, 1.12) * (1 + 0.08 * (7.2 - m.pH)) + 4.7 * m.turbidityNTU) *
    (1 + 0.01 * m.cartridgeAgeDays)
  );
}

function meanOf(v: number[]): number {
  return v.reduce((a, x) => a + x, 0) / v.length;
}

function sampleSd(v: number[]): number {
  const m = meanOf(v);
  return Math.sqrt(v.reduce((a, x) => a + (x - m) * (x - m), 0) / Math.max(1, v.length - 1));
}

/** Forward simulator (hidden physics). `mix` is ppt in SPECIES_ORDER. */
export function simulateSensor(mix: number[], m: SensorMatrix, rand: () => number, opts: SensorOptions = {}): SensorReading {
  const gain = trueGain(m, opts);
  const x = mix.map((c) => Math.log1p(Math.max(0, c)));
  const specificOhm = CROSS_SELECTIVITY.map(
    (row, g) => GROUP_SENSITIVITY_OHM[g] * gain * row.reduce((a, s, j) => a + s * x[j], 0)
  );
  const crossTalkOhm = CROSS_SELECTIVITY.map(
    (row, g) => GROUP_SENSITIVITY_OHM[g] * gain * row.reduce((a, s, j) => (j === g ? a : a + s * x[j]), 0)
  );
  const drift = baselineDriftOhm(m);
  const foul = foulingOhm(m);
  const noiseSd = CHANNEL_NOISE_OHM * (1 + m.cartridgeAgeDays / 30) * (opts.noiseScale ?? 1);
  const groupMeanOhm: number[] = [];
  const groupCvPct: number[] = [];
  for (let g = 0; g < 4; g++) {
    const values: number[] = [];
    for (let i = 0; i < CHANNELS_PER_GROUP; i++) {
      const z1 = gaussian(rand);
      const z2 = gaussian(rand);
      values.push(specificOhm[g] * (1 + CHANNEL_GAIN_SPREAD * z1) + drift + GROUP_FOULING_COUPLING[g] * foul + noiseSd * z2);
    }
    const mean = meanOf(values);
    groupMeanOhm.push(mean);
    // Replicate agreement is judged on the absolute Rct (baseline + shift), as an EIS instrument reports it.
    groupCvPct.push((sampleSd(values) / Math.max(1e-9, BASELINE_RCT_OHM + mean)) * 100);
  }
  const meanSens = meanOf(GROUP_SENSITIVITY_OHM);
  const nipPfas = NIP_NONSPECIFIC_FRACTION * meanSens * gain * x.reduce((a, v) => a + v, 0);
  const nip: number[] = [];
  for (let i = 0; i < NIP_CHANNELS; i++) {
    nip.push(drift + NIP_FOULING_COUPLING * foul + nipPfas + noiseSd * gaussian(rand));
  }
  const sonde: SondeReading = {
    tempC: m.tempC + SONDE_NOISE.tempC * gaussian(rand),
    pH: m.pH + SONDE_NOISE.pH * gaussian(rand),
    conductivityUsCm: m.conductivityUsCm * (1 + SONDE_NOISE.conductivityRel * gaussian(rand)),
    turbidityNTU: m.turbidityNTU * (1 + SONDE_NOISE.turbidityRel * gaussian(rand)),
    fdomQsu: FDOM_QSU_PER_MG_L * m.nomMgL * (1 + SONDE_NOISE.fdomRel * gaussian(rand)),
    cartridgeAgeDays: m.cartridgeAgeDays,
  };
  return {
    groupMeanOhm,
    groupCvPct,
    nipMeanOhm: meanOf(nip),
    specificOhm,
    crossTalkOhm,
    driftOhm: drift,
    foulingOhm: foul,
    gain,
    debyeLengthNm: debyeLengthNm(m.conductivityUsCm),
    amineProtonationPct: amineProtonationFraction(m.pH) * 100,
    sonde,
  };
}

/** Offset features are centred on the reference matrix, so the offset correction is anchored to 0 there. */
export function offsetFeatures(s: SondeReading): number[] {
  const dT = s.tempC - REFERENCE_MATRIX.tempC;
  return [
    dT,
    dT * dT,
    s.pH - REFERENCE_MATRIX.pH,
    (s.conductivityUsCm - REFERENCE_MATRIX.conductivityUsCm) / 100,
    s.fdomQsu / FDOM_QSU_PER_MG_L - REFERENCE_MATRIX.nomMgL,
    s.turbidityNTU - REFERENCE_MATRIX.turbidityNTU,
    s.cartridgeAgeDays / 30,
  ];
}

/** Gain features are zero at the reference matrix, so the gain correction is anchored to 1 there. */
export function gainFeatures(s: SondeReading): number[] {
  const dT = s.tempC - 20;
  return [dT, dT * dT, s.pH - 7, (s.conductivityUsCm - 300) / 100, s.cartridgeAgeDays / 30];
}

const dot = (a: number[], b: number[]) => a.reduce((acc, v, i) => acc + v * b[i], 0);

export interface EdgeCalibration {
  sensitivity: number[][];
  blankOffsetOhm: number[];
  rawBlankRefOhm: number[];
  offsetCoef: number[][];
  gainCoef: number[][];
  lambda: number;
  conditionNumberS: number;
  determinantS: number;
  conditionNumberCalibrated: number;
}

function drawMatrix(rand: () => number, r: { t: number[]; ph: number[]; ec: number[]; tu: number[]; nom: number[] }): SensorMatrix {
  const u = (lo: number, hi: number) => lo + (hi - lo) * rand();
  return {
    tempC: u(r.t[0], r.t[1]),
    pH: u(r.ph[0], r.ph[1]),
    conductivityUsCm: u(r.ec[0], r.ec[1]),
    turbidityNTU: u(r.tu[0], r.tu[1]),
    nomMgL: u(r.nom[0], r.nom[1]),
    cartridgeAgeDays: u(0, 30),
  };
}

export const CALIBRATION_RANGES = { t: [6, 26], ph: [6.4, 8.3], ec: [90, 700], tu: [0.1, 2.5], nom: [0.3, 4.5] };
export const BENCHMARK_RANGES = { t: [4, 28], ph: [6.2, 8.5], ec: [80, 750], tu: [0.05, 3.0], nom: [0.2, 5.0] };

/** Simulated factory calibration: pure standards at the reference matrix, then matrix blanks/spikes. */
export function calibrateEdgeEstimator(seed = CALIBRATION_SEED): EdgeCalibration {
  const rand = mulberry32(seed);
  const rows: number[][] = [];
  const ys: number[][] = [[], [], [], []];
  const rawBlank: number[][] = [[], [], [], []];
  for (let s = 0; s < 4; s++) {
    for (const c of STANDARD_LEVELS_PPT) {
      for (let rep = 0; rep < CALIBRATION_REPLICATES; rep++) {
        const mix = [0, 0, 0, 0];
        mix[s] = c;
        const r = simulateSensor(mix, REFERENCE_MATRIX, rand);
        rows.push([1, ...mix.map((v) => Math.log1p(v))]);
        for (let g = 0; g < 4; g++) {
          ys[g].push(r.groupMeanOhm[g] - r.nipMeanOhm);
          if (c === 0) rawBlank[g].push(r.groupMeanOhm[g]);
        }
      }
    }
  }
  const sensitivity: number[][] = [];
  const blankOffsetOhm: number[] = [];
  for (let g = 0; g < 4; g++) {
    const beta = leastSquares(rows, ys[g], 1e-9);
    blankOffsetOhm.push(beta[0]);
    sensitivity.push(beta.slice(1));
  }
  const rawBlankRefOhm = rawBlank.map(meanOf);

  const offRows: number[][] = [];
  const offY: number[][] = [[], [], [], []];
  const spikes: SensorReading[] = [];
  for (let i = 0; i < CALIBRATION_MATRICES; i++) {
    const m = drawMatrix(rand, CALIBRATION_RANGES);
    const blank = simulateSensor([0, 0, 0, 0], m, rand);
    spikes.push(simulateSensor([SPIKE_PPT, SPIKE_PPT, SPIKE_PPT, SPIKE_PPT], m, rand));
    offRows.push(offsetFeatures(blank.sonde));
    for (let g = 0; g < 4; g++) offY[g].push(blank.groupMeanOhm[g] - blank.nipMeanOhm - blankOffsetOhm[g]);
  }
  const offsetCoef = offY.map((y) => leastSquares(offRows, y, 1e-6));
  const xs = Math.log1p(SPIKE_PPT);
  const gainRows = spikes.map((r) => gainFeatures(r.sonde));
  const gainCoef = [0, 1, 2, 3].map((g) => {
    const expected = sensitivity[g].reduce((a, v) => a + v * xs, 0);
    const ratios = spikes.map(
      (r) => (r.groupMeanOhm[g] - r.nipMeanOhm - blankOffsetOhm[g] - dot(offsetCoef[g], offsetFeatures(r.sonde))) / expected - 1
    );
    return leastSquares(gainRows, ratios, 1e-6);
  });
  const ata = matMul(transpose(sensitivity), sensitivity);
  const lambda = (TIKHONOV_LAMBDA_REL * (ata[0][0] + ata[1][1] + ata[2][2] + ata[3][3])) / 4;
  return {
    sensitivity,
    blankOffsetOhm,
    rawBlankRefOhm,
    offsetCoef,
    gainCoef,
    lambda,
    conditionNumberS: conditionNumber2(CROSS_SELECTIVITY),
    determinantS: determinant(CROSS_SELECTIVITY),
    conditionNumberCalibrated: conditionNumber2(sensitivity),
  };
}

export interface MixtureEstimate {
  estimatePpt: number[];
  logSignal: number[];
  diagonalPpt: number[];
  nipOnlyPpt: number[];
  uncompensatedPpt: number[];
  compensatedOhm: number[];
}

/** Blind edge estimator: uses only the four group means, the NIP mean, the sonde reading and the calibration. */
export function estimateMixture(
  reading: { groupMeanOhm: number[]; nipMeanOhm: number; sonde: SondeReading },
  cal: EdgeCalibration
): MixtureEstimate {
  const compensatedOhm: number[] = [];
  const diagonalPpt: number[] = [];
  const nipOnlyPpt: number[] = [];
  const uncompensatedPpt: number[] = [];
  const fo = offsetFeatures(reading.sonde);
  const fg = gainFeatures(reading.sonde);
  for (let g = 0; g < 4; g++) {
    const diff = reading.groupMeanOhm[g] - reading.nipMeanOhm;
    const offset = cal.blankOffsetOhm[g] + dot(cal.offsetCoef[g], fo);
    const gain = Math.max(0.2, 1 + dot(cal.gainCoef[g], fg));
    const y = (diff - offset) / gain;
    compensatedOhm.push(y);
    const sgg = cal.sensitivity[g][g];
    diagonalPpt.push(Math.expm1(Math.max(0, y / sgg)));
    nipOnlyPpt.push(Math.expm1(Math.max(0, (diff - cal.blankOffsetOhm[g]) / sgg)));
    uncompensatedPpt.push(Math.expm1(Math.max(0, (reading.groupMeanOhm[g] - cal.rawBlankRefOhm[g]) / sgg)));
  }
  const a = cal.sensitivity;
  const ata = matMul(transpose(a), a).map((row, i) => row.map((v, j) => v + (i === j ? cal.lambda : 0)));
  const aty = [0, 1, 2, 3].map((j) => a.reduce((acc, row, g) => acc + row[j] * compensatedOhm[g], 0));
  const logSignal = solveLinearSystem(ata, aty);
  return {
    estimatePpt: logSignal.map((v) => Math.expm1(Math.max(0, v))),
    logSignal,
    diagonalPpt,
    nipOnlyPpt,
    uncompensatedPpt,
    compensatedOhm,
  };
}

export type EstimatorMethod = 'uncompensated' | 'nipOnly' | 'diagonal' | 'full';
export const ESTIMATOR_METHODS: EstimatorMethod[] = ['uncompensated', 'nipOnly', 'diagonal', 'full'];

export interface MethodSummary {
  mapePct: number;
  medianApePct: number;
  p90ApePct: number;
  maeLowPpt: number;
}

export interface MixtureBenchmark {
  samples: number;
  noiseScale: number;
  methods: Record<EstimatorMethod, MethodSummary>;
  fullBySpecies: Record<SpeciesId, MethodSummary>;
}

function summarize(apes: number[], lowAbs: number[]): MethodSummary {
  const sorted = [...apes].sort((x, y) => x - y);
  return {
    mapePct: apes.length ? meanOf(apes) : 0,
    medianApePct: sorted.length ? sorted[Math.floor(0.5 * (sorted.length - 1))] : 0,
    p90ApePct: sorted.length ? sorted[Math.floor(0.9 * (sorted.length - 1))] : 0,
    maeLowPpt: lowAbs.length ? meanOf(lowAbs) : 0,
  };
}

/**
 * Random mixtures (log-uniform 0.5-50 ppt per species) in random matrices that extend slightly beyond
 * the calibration ranges. Percentage errors use samples >= 2 ppt; below 2 ppt absolute errors are used.
 */
export function runMixtureBenchmark(cal: EdgeCalibration, n = 200, seed = 777, noiseScale = 1): MixtureBenchmark {
  const rand = mulberry32(seed);
  const apes: Record<EstimatorMethod, number[]> = { uncompensated: [], nipOnly: [], diagonal: [], full: [] };
  const lows: Record<EstimatorMethod, number[]> = { uncompensated: [], nipOnly: [], diagonal: [], full: [] };
  const bySp: Record<SpeciesId, { ape: number[]; low: number[] }> = {
    PFBA: { ape: [], low: [] },
    PFBS: { ape: [], low: [] },
    PFOA: { ape: [], low: [] },
    PFOS: { ape: [], low: [] },
  };
  for (let i = 0; i < n; i++) {
    const mix = [0, 1, 2, 3].map(() => Math.exp(Math.log(0.5) + rand() * (Math.log(50) - Math.log(0.5))));
    const m = drawMatrix(rand, BENCHMARK_RANGES);
    const est = estimateMixture(simulateSensor(mix, m, rand, { noiseScale }), cal);
    const byMethod: Record<EstimatorMethod, number[]> = {
      uncompensated: est.uncompensatedPpt,
      nipOnly: est.nipOnlyPpt,
      diagonal: est.diagonalPpt,
      full: est.estimatePpt,
    };
    for (let s = 0; s < 4; s++) {
      for (const method of ESTIMATOR_METHODS) {
        const e = byMethod[method][s];
        if (mix[s] >= 2) apes[method].push((Math.abs(e - mix[s]) / mix[s]) * 100);
        else lows[method].push(Math.abs(e - mix[s]));
      }
      const e = est.estimatePpt[s];
      if (mix[s] >= 2) bySp[SPECIES_ORDER[s]].ape.push((Math.abs(e - mix[s]) / mix[s]) * 100);
      else bySp[SPECIES_ORDER[s]].low.push(Math.abs(e - mix[s]));
    }
  }
  const methods = {} as Record<EstimatorMethod, MethodSummary>;
  for (const method of ESTIMATOR_METHODS) methods[method] = summarize(apes[method], lows[method]);
  const fullBySpecies = {} as Record<SpeciesId, MethodSummary>;
  for (const sp of SPECIES_ORDER) fullBySpecies[sp] = summarize(bySp[sp].ape, bySp[sp].low);
  return { samples: n, noiseScale, methods, fullBySpecies };
}

/**
 * Model-based limit of detection per species (ppt): mean + 3 SD of blank estimates measured across
 * random water matrices (so matrix-compensation error is included, not only electrode noise).
 */
export function simulatedLodPpt(cal: EdgeCalibration, n = 60, seed = 991): number[] {
  const rand = mulberry32(seed);
  const est: number[][] = [[], [], [], []];
  for (let i = 0; i < n; i++) {
    const m = drawMatrix(rand, BENCHMARK_RANGES);
    const e = estimateMixture(simulateSensor([0, 0, 0, 0], m, rand), cal);
    for (let s = 0; s < 4; s++) est[s].push(Math.expm1(e.logSignal[s]));
  }
  return est.map((v) => Math.max(0, meanOf(v) + 3 * sampleSd(v)));
}

/** Seed for an interactive reading so the demo is stable while the sliders do not move. */
export function readingSeed(parts: { speciesIdx: number; truePpt: number; m: SensorMatrix; modeCode: number }): number {
  return seedFrom(
    parts.speciesIdx + 1,
    hundredths(parts.truePpt),
    hundredths(parts.m.tempC + 50),
    hundredths(parts.m.pH),
    hundredths(parts.m.turbidityNTU),
    Math.floor(parts.m.conductivityUsCm + 0.5),
    hundredths(parts.m.nomMgL),
    parts.modeCode * 100 + Math.floor(parts.m.cartridgeAgeDays + 0.5)
  );
}

let cachedCalibration: EdgeCalibration | null = null;
export function defaultCalibration(): EdgeCalibration {
  if (!cachedCalibration) cachedCalibration = calibrateEdgeEstimator();
  return cachedCalibration;
}
