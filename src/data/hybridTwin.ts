/**
 * Breakthrough twin and the synthetic testbench it is evaluated on.
 *
 * Testbench ("virtual plant", hidden from the model):
 *   NOM fouling with species-specific strength, a Richards-type breakthrough shape (not the model's
 *   Thomas shape), short-chain roll-up, and seeded multiplicative + additive measurement noise.
 *
 * Model (one fit per vessel, all four species together):
 *   C_hat_s(z, t) = C0_s [ sigma(-xi_s) + G(xi_s) N_W(z, t / T_REF, sigma) ],  G = sigma (1 - sigma)
 *   xi_s = k_s q_s M z / Q_n - k_s C0_s t,  k_s = k_prior,s e^phiK,  q_s = q_prior,s e^phiQ
 *   sigma(-xi) is the travelling-wave (Thomas) solution of the 1D advection-sorption PDE.
 *   phiK, phiQ ("bed condition") are shared by all species, so early short-chain (PFBA/PFBS) mid-bed
 *   data inform the slower PFOA/PFOS forecasts: the sentinel-tracer idea, made quantitative.
 *
 * Default = physics-based assimilation (network off, 2 fitted parameters). The PINN-style option adds the
 * neural correction N_W with the PDE penalty (23 parameters). In the ablation (simulation/validation_report.py)
 * the PDE penalty is what makes the network useful, and the hybrid is slightly more accurate on the testbench
 * but forecasts slightly later; the 2-parameter model stays the decision default until real data decide.
 *
 * Loss (gradient derived analytically, checked against finite differences in the tests):
 *   L = mean_i ((C_hat_i - y_i) / C0_i)^2 + lambda_adv mean r_adv^2 + lambda_kin mean r_kin^2
 *       + lambda_prior (phiK^2 + phiQ^2) + lambda_w ||W||^2
 *   r_adv = (T_c / C0) (dC/dt + u dC/dz),  u = Q_n C0 / (q M)          (advection of the MTZ)
 *   r_kin = (T_c / C0) (dC/dt - k C0^2 rho (1 - rho)),  rho = C / C0    (Thomas rate law)
 *
 * Mirrored line-for-line in simulation/pfas_sentinel_core.py.
 */
import { PFAS_SPECIES, SPECIES_ORDER } from './species';
import type { SpeciesId, MediaType } from './species';
import { gaussian, hundredths, mulberry32, seedFrom } from './rng';

export const T_REF_DAYS = 400;
export const FLOW_NORM_FACTOR = 320;
/** Validation protocol: TRAIN = mid-bed samples up to day 135, TEST = unseen days 155-210. */
export const OBSERVATION_DAYS = [30, 60, 90, 115, 135, 155, 180, 210];
export const TRAIN_DAYS = [30, 60, 90, 115, 135];
export const LAST_OBSERVATION_DAY = 210;
/** Operational mode: one mid-bed data point every 15 days; the twin only sees days <= today. */
export const OPERATIONAL_DAYS = Array.from({ length: 80 }, (_, i) => 15 * (i + 1));
export const MID_BED_Z = 0.5;
export const TARGET_PPT = 4.0;
export const TRUTH_SHAPE_NU = 0.7;
/** Sensor-grade noise, matching the mixture benchmark of the MIP estimator (~14% median error). */
export const OBS_NOISE = { relative: 0.15, absolutePpt: 0.2, floorPpt: 0.02 };
/** How strongly NOM fouling acts on each species in the testbench (hidden from the model). */
export const TRUTH_FOULING_EXPONENT: Record<SpeciesId, { capacity: number; kinetic: number }> = {
  PFBA: { capacity: 1.2, kinetic: 1.1 },
  PFBS: { capacity: 1.1, kinetic: 1.0 },
  PFOA: { capacity: 0.95, kinetic: 0.95 },
  PFOS: { capacity: 0.85, kinetic: 0.9 },
};
export const COLLOCATION_POINTS: [number, number][] = [0.5, 1.0].flatMap((z) =>
  [60, 120, 180, 240, 300, 360].map((t) => [z, t] as [number, number])
);
const MEDIA_ORDER: MediaType[] = ['GAC', 'IX', 'HYBRID'];

export interface TwinConfig {
  epochs: number;
  lrPhys: number;
  lrNn: number;
  beta1: number;
  beta2: number;
  eps: number;
  lambdaAdv: number;
  lambdaKin: number;
  lambdaPrior: number;
  lambdaWeight: number;
  phiBound: number;
  tChar: number;
  dt: number;
  dz: number;
  priorSigma: number;
  noiseFloor: number;
  uncertaintyZ: number;
  /** Model-form discrepancy (days of 1-sigma error per day of extrapolation beyond the last data point). */
  discrepancyPerDay: number;
  useNetwork: boolean;
  /** false: the network sees only the local saturation sigma (a function of the wave coordinate). */
  networkUsesSpaceTime: boolean;
  fitPhysics: boolean;
}

export const TWIN_CONFIG: TwinConfig = {
  epochs: 250,
  lrPhys: 0.02,
  lrNn: 0.02,
  beta1: 0.9,
  beta2: 0.999,
  eps: 1e-8,
  lambdaAdv: 0,
  lambdaKin: 0,
  lambdaPrior: 0.008,
  lambdaWeight: 0.001,
  phiBound: Math.log(1.6),
  tChar: 120,
  dt: 0.1,
  dz: 0.002,
  priorSigma: 0.25,
  noiseFloor: 0.01,
  uncertaintyZ: 1.96,
  discrepancyPerDay: 0.05,
  useNetwork: false,
  networkUsesSpaceTime: true,
  fitPhysics: true,
};

/**
 * The PINN-style hybrid evaluated in the ablation; available in the demo as an experimental option.
 * The physics-only default needs no collocation penalty: it is the travelling-wave solution itself.
 */
export const EXPERIMENTAL_HYBRID_CONFIG: Partial<TwinConfig> = { useNetwork: true, lambdaAdv: 0.2, lambdaKin: 0.2 };

/** RMS of the scaled advection and kinetic PDE residuals of a fitted model at the collocation points. */
export function pdeResidualRms(plant: PlantSpec, theta: number[]): { adv: number; kin: number } {
  const l = lossAndGrad(plant, SPECIES_ORDER, theta, [], { ...TWIN_CONFIG, lambdaAdv: 1, lambdaKin: 1 });
  return { adv: Math.sqrt(l.adv), kin: Math.sqrt(l.kin) };
}

const N_HIDDEN = 4;
export const N_PARAMS = 2 + N_HIDDEN * 3 + N_HIDDEN + N_HIDDEN + 1;
const INIT_W1 = [
  [0.06, -0.04, 0.08],
  [-0.05, 0.07, -0.06],
  [0.04, 0.06, 0.05],
  [-0.04, -0.06, 0.07],
];
const INIT_W2 = [0.04, -0.03, 0.03, -0.04];

/** One treatment vessel and its influent (all four species share the bed and the water). */
export interface PlantSpec {
  mediaType: MediaType;
  flowRateMGD: number;
  mediaMassKg: number;
  nomMgL: number;
  includeRollup: boolean;
  C0: Record<SpeciesId, number>;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const round1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;
export const round2 = (x: number) => Math.floor(x * 100 + 0.5) / 100;
export const round3 = (x: number) => Math.floor(x * 1000 + 0.5) / 1000;

export function flowNorm(flowRateMGD: number): number {
  return Math.max(0.2, flowRateMGD * FLOW_NORM_FACTOR);
}

/** Clean-water prior kinetics (vendor isotherm level) for each media type. */
export function priorKinetics(speciesId: SpeciesId, mediaType: MediaType) {
  const sp = PFAS_SPECIES[speciesId];
  if (mediaType === 'IX') return { kTh: sp.kTh_IX, q0: sp.q0_IX, rollup: sp.rollupFactorIX };
  if (mediaType === 'HYBRID') {
    return {
      kTh: (sp.kTh_GAC + sp.kTh_IX) * 0.52,
      q0: (sp.q0_GAC + sp.q0_IX) * 0.62,
      rollup: sp.rollupFactorGAC * 0.45,
    };
  }
  return { kTh: sp.kTh_GAC, q0: sp.q0_GAC, rollup: sp.rollupFactorGAC };
}

/** Testbench NOM fouling: lower capacity, slightly faster kinetics, stronger for short chains. */
export function nomFoulingFactors(nomMgL: number, speciesId: SpeciesId) {
  const capacity = Math.max(0.62, 1 - (nomMgL - 1) * 0.065 - Math.pow(Math.max(0, nomMgL - 2), 1.35) * 0.012);
  const kinetic = 1 + (nomMgL - 1) * 0.042;
  const e = TRUTH_FOULING_EXPONENT[speciesId];
  return { capacity: Math.pow(capacity, e.capacity), kinetic: Math.pow(kinetic, e.kinetic) };
}

/**
 * Hidden "virtual plant" concentration (ppt) at bed depth z (in vessel lengths) and day t.
 * Used to generate synthetic observations and the demo's live telemetry; never seen by the model.
 */
export function truthConcentration(plant: PlantSpec, sp: SpeciesId, z: number, t: number): number {
  const c0 = plant.C0[sp];
  const prior = priorKinetics(sp, plant.mediaType);
  const foul = nomFoulingFactors(plant.nomMgL, sp);
  const k = prior.kTh * foul.kinetic;
  const q = prior.q0 * foul.capacity;
  const qn = flowNorm(plant.flowRateMGD);
  const xi = clamp((k * q * plant.mediaMassKg * z) / qn - k * c0 * t, -35, 35);
  const base = c0 * Math.pow(1 + TRUTH_SHAPE_NU * Math.exp(xi), -1 / TRUTH_SHAPE_NU);
  let bump = 0;
  if (plant.includeRollup && prior.rollup > 0 && t > 1 && base / c0 > 0.35) {
    const tau50 = (q * plant.mediaMassKg * z) / (qn * Math.max(1, c0));
    const width = Math.max(2.5, tau50 * 0.18);
    const wave = Math.exp(-Math.pow((t - tau50 * 1.16) / width, 2));
    const gate = 1 / (1 + Math.exp(-clamp((t - tau50 * 1.02) / Math.max(1.2, tau50 * 0.04), -30, 30)));
    const depthScale = z >= 0.85 ? 1 : 0.25 * z;
    bump = c0 * prior.rollup * depthScale * (0.85 + 0.12 * plant.nomMgL) * wave * gate;
  }
  return Math.max(0, Math.min(c0 * 1.42, base + bump));
}

/** Uncorrected Thomas model with clean-water prior parameters (the "static" baseline). */
export function staticPriorConcentration(plant: PlantSpec, sp: SpeciesId, z: number, t: number): number {
  const c0 = plant.C0[sp];
  const prior = priorKinetics(sp, plant.mediaType);
  const qn = flowNorm(plant.flowRateMGD);
  const xi = clamp((prior.kTh * prior.q0 * plant.mediaMassKg * z) / qn - prior.kTh * c0 * t, -35, 35);
  return c0 / (1 + Math.exp(xi));
}

export interface TwinContext {
  C0: number;
  qn: number;
  M: number;
  k0: number;
  q0: number;
}

export function makeContext(plant: PlantSpec, sp: SpeciesId): TwinContext {
  const prior = priorKinetics(sp, plant.mediaType);
  return { C0: plant.C0[sp], qn: flowNorm(plant.flowRateMGD), M: plant.mediaMassKg, k0: prior.kTh, q0: prior.q0 };
}

export function initialParams(useNetwork = true, networkUsesSpaceTime = true): number[] {
  const theta = new Array(N_PARAMS).fill(0);
  for (let j = 0; j < N_HIDDEN; j++) {
    for (let k = 0; k < 3; k++) theta[2 + 3 * j + k] = networkUsesSpaceTime || k === 2 ? INIT_W1[j][k] : 0;
    theta[18 + j] = useNetwork ? INIT_W2[j] : 0;
  }
  return theta;
}

/** Twin value (ppt); when `grad` is given it is filled with dC/dtheta. */
export function evalTwin(ctx: TwinContext, theta: number[], z: number, t: number, grad?: number[]): number {
  const k = ctx.k0 * Math.exp(theta[0]);
  const q = ctx.q0 * Math.exp(theta[1]);
  const cap = (k * q * ctx.M * z) / ctx.qn;
  const xiRaw = cap - k * ctx.C0 * t;
  const xi = clamp(xiRaw, -35, 35);
  const sig = 1 / (1 + Math.exp(xi));
  const g = sig * (1 - sig);
  const x = [z, t / T_REF_DAYS, sig];
  const h: number[] = [];
  const dh: number[] = [];
  let n = theta[22];
  for (let j = 0; j < N_HIDDEN; j++) {
    const a = theta[14 + j] + theta[2 + 3 * j] * x[0] + theta[3 + 3 * j] * x[1] + theta[4 + 3 * j] * x[2];
    const hj = Math.tanh(clamp(a, -15, 15));
    h.push(hj);
    dh.push(Math.abs(a) < 15 ? 1 - hj * hj : 0);
    n += theta[18 + j] * hj;
  }
  const c = ctx.C0 * (sig + g * n);
  if (grad) {
    let dNdSig = 0;
    for (let j = 0; j < N_HIDDEN; j++) dNdSig += theta[18 + j] * dh[j] * theta[4 + 3 * j];
    const dCdXi = Math.abs(xiRaw) < 35 ? ctx.C0 * (-g - n * g * (1 - 2 * sig) - g * g * dNdSig) : 0;
    grad[0] = dCdXi * xiRaw;
    grad[1] = dCdXi * cap;
    for (let j = 0; j < N_HIDDEN; j++) {
      const gj = ctx.C0 * g * theta[18 + j] * dh[j];
      grad[2 + 3 * j] = gj * x[0];
      grad[3 + 3 * j] = gj * x[1];
      grad[4 + 3 * j] = gj * x[2];
      grad[14 + j] = gj;
      grad[18 + j] = ctx.C0 * g * h[j];
    }
    grad[22] = ctx.C0 * g;
  }
  return c;
}

export interface Observation {
  sp: SpeciesId;
  z: number;
  t: number;
  y: number;
}

export interface LossBreakdown {
  total: number;
  data: number;
  adv: number;
  kin: number;
  prior: number;
  weight: number;
}

/** Total loss and (optionally) its exact gradient with respect to all 23 shared parameters. */
export function lossAndGrad(
  plant: PlantSpec,
  species: SpeciesId[],
  theta: number[],
  obs: Observation[],
  cfg: TwinConfig,
  grad?: number[]
): LossBreakdown {
  const P = N_PARAMS;
  if (grad) grad.fill(0);
  const ctxs = {} as Record<SpeciesId, TwinContext>;
  for (const sp of SPECIES_ORDER) ctxs[sp] = makeContext(plant, sp);
  const gi = new Array(P).fill(0);
  let data = 0;
  for (const o of obs) {
    const ctx = ctxs[o.sp];
    const c = evalTwin(ctx, theta, o.z, o.t, grad ? gi : undefined);
    const r = (c - o.y) / ctx.C0;
    data += (r * r) / obs.length;
    if (grad) for (let p = 0; p < P; p++) grad[p] += ((2 * r) / (obs.length * ctx.C0)) * gi[p];
  }

  let adv = 0;
  let kin = 0;
  if (cfg.lambdaAdv > 0 || cfg.lambdaKin > 0) {
    const m = COLLOCATION_POINTS.length * species.length;
    const gTp = new Array(P).fill(0);
    const gTm = new Array(P).fill(0);
    const gZp = new Array(P).fill(0);
    const gZm = new Array(P).fill(0);
    const gC = new Array(P).fill(0);
    const want = grad !== undefined;
    for (const sp of species) {
      const ctx = ctxs[sp];
      const k = ctx.k0 * Math.exp(theta[0]);
      const q = ctx.q0 * Math.exp(theta[1]);
      const u = (ctx.qn * ctx.C0) / (q * ctx.M);
      const s = cfg.tChar / ctx.C0;
      for (const [zc, tc] of COLLOCATION_POINTS) {
        const zp = zc + cfg.dz;
        const zm = Math.max(0, zc - cfg.dz);
        const cTp = evalTwin(ctx, theta, zc, tc + cfg.dt, want ? gTp : undefined);
        const cTm = evalTwin(ctx, theta, zc, tc - cfg.dt, want ? gTm : undefined);
        const cZp = evalTwin(ctx, theta, zp, tc, want ? gZp : undefined);
        const cZm = evalTwin(ctx, theta, zm, tc, want ? gZm : undefined);
        const cC = evalTwin(ctx, theta, zc, tc, want ? gC : undefined);
        const dCdt = (cTp - cTm) / (2 * cfg.dt);
        const dCdz = (cZp - cZm) / (zp - zm);
        const rAdv = s * (dCdt + u * dCdz);
        const rho = cC / ctx.C0;
        const kinTerm = k * ctx.C0 * ctx.C0 * rho * (1 - rho);
        const rKin = s * (dCdt - kinTerm);
        adv += (rAdv * rAdv) / m;
        kin += (rKin * rKin) / m;
        if (grad) {
          for (let p = 0; p < P; p++) {
            const dDt = (gTp[p] - gTm[p]) / (2 * cfg.dt);
            const dDz = (gZp[p] - gZm[p]) / (zp - zm);
            let dAdv = s * (dDt + u * dDz);
            if (p === 1) dAdv -= s * u * dCdz;
            const dRho = gC[p] / ctx.C0;
            let dKin = s * (dDt - k * ctx.C0 * ctx.C0 * (1 - 2 * rho) * dRho);
            if (p === 0) dKin -= s * kinTerm;
            grad[p] += (cfg.lambdaAdv * 2 * rAdv * dAdv + cfg.lambdaKin * 2 * rKin * dKin) / m;
          }
        }
      }
    }
  }

  const prior = cfg.lambdaPrior * (theta[0] * theta[0] + theta[1] * theta[1]);
  let weight = 0;
  for (let p = 2; p < 14; p++) weight += theta[p] * theta[p];
  for (let p = 18; p < 22; p++) weight += theta[p] * theta[p];
  weight *= cfg.lambdaWeight;
  if (grad) {
    grad[0] += 2 * cfg.lambdaPrior * theta[0];
    grad[1] += 2 * cfg.lambdaPrior * theta[1];
    for (let p = 2; p < 14; p++) grad[p] += 2 * cfg.lambdaWeight * theta[p];
    for (let p = 18; p < 22; p++) grad[p] += 2 * cfg.lambdaWeight * theta[p];
  }
  const total = data + cfg.lambdaAdv * adv + cfg.lambdaKin * kin + prior + weight;
  return { total, data, adv, kin, prior, weight };
}

export interface ObservationPoint {
  day: number;
  split: 'TRAIN' | 'TEST';
  observedMidBedPpt: number;
  observedEffluentPpt: number;
  truthMidBedPpt: number;
  truthEffluentPpt: number;
}

export function observationSeed(plant: PlantSpec, replicate: number): number {
  return seedFrom(
    MEDIA_ORDER.indexOf(plant.mediaType) + 1,
    hundredths(plant.flowRateMGD),
    Math.floor(plant.mediaMassKg + 0.5),
    hundredths(plant.nomMgL),
    plant.includeRollup ? 2 : 1,
    replicate + 1,
    hundredths(plant.C0.PFBA) + 3 * hundredths(plant.C0.PFBS),
    hundredths(plant.C0.PFOA) + 3 * hundredths(plant.C0.PFOS)
  );
}

/**
 * Synthetic mid-bed and vessel-outlet observations on `days`; points on or before `trainUntilDay`
 * are the TRAIN split, later points are TEST (unseen by the fit).
 */
export function generateObservations(
  plant: PlantSpec,
  replicate = 0,
  days: number[] = OBSERVATION_DAYS,
  trainUntilDay = TRAIN_DAYS[TRAIN_DAYS.length - 1]
): Record<SpeciesId, ObservationPoint[]> {
  const rand = mulberry32(observationSeed(plant, replicate));
  const noisy = (c: number) =>
    Math.max(
      OBS_NOISE.floorPpt,
      c * (1 + OBS_NOISE.relative * gaussian(rand)) + OBS_NOISE.absolutePpt * gaussian(rand)
    );
  const out = {} as Record<SpeciesId, ObservationPoint[]>;
  for (const sp of SPECIES_ORDER) {
    out[sp] = days.map((day) => {
      const truthMid = truthConcentration(plant, sp, MID_BED_Z, day);
      const truthEff = truthConcentration(plant, sp, 1, day);
      return {
        day,
        split: day <= trainUntilDay ? 'TRAIN' : 'TEST',
        observedMidBedPpt: noisy(truthMid),
        observedEffluentPpt: noisy(truthEff),
        truthMidBedPpt: truthMid,
        truthEffluentPpt: truthEff,
      };
    });
  }
  return out;
}

/** First day on which fn(t) reaches the target (1-day scan, then bisection); tMax if never. */
export function crossingDay(fn: (t: number) => number, target: number, tMax = 1500): number {
  if (fn(0) >= target) return 0;
  for (let t = 1; t <= tMax; t++) {
    if (fn(t) >= target) {
      let lo = t - 1;
      let hi = t;
      for (let i = 0; i < 40; i++) {
        const mid = 0.5 * (lo + hi);
        if (fn(mid) >= target) hi = mid;
        else lo = mid;
      }
      return hi;
    }
  }
  return tMax;
}

export interface TrainingHistoryPoint {
  epoch: number;
  total: number;
  data: number;
  adv: number;
  kin: number;
}

export function trainTwin(
  plant: PlantSpec,
  species: SpeciesId[],
  obs: Observation[],
  cfg: TwinConfig
): { theta: number[]; history: TrainingHistoryPoint[]; initial: LossBreakdown; final: LossBreakdown } {
  const theta = initialParams(cfg.useNetwork, cfg.networkUsesSpaceTime);
  const P = N_PARAMS;
  const g = new Array(P).fill(0);
  const m1 = new Array(P).fill(0);
  const m2 = new Array(P).fill(0);
  const history: TrainingHistoryPoint[] = [];
  const initial = lossAndGrad(plant, species, theta, obs, cfg);
  if (obs.length === 0) return { theta, history, initial, final: initial };
  for (let ep = 1; ep <= cfg.epochs; ep++) {
    const l = lossAndGrad(plant, species, theta, obs, cfg, g);
    if (ep === 1 || ep % 10 === 0) {
      history.push({ epoch: ep, total: l.total, data: l.data, adv: l.adv, kin: l.kin });
    }
    for (let p = 0; p < P; p++) {
      const spaceTimeWeight = p >= 2 && p < 14 && (p - 2) % 3 !== 2;
      const trainable = p < 2 ? cfg.fitPhysics : cfg.useNetwork && (cfg.networkUsesSpaceTime || !spaceTimeWeight);
      if (!trainable) continue;
      m1[p] = cfg.beta1 * m1[p] + (1 - cfg.beta1) * g[p];
      m2[p] = cfg.beta2 * m2[p] + (1 - cfg.beta2) * g[p] * g[p];
      const mh = m1[p] / (1 - Math.pow(cfg.beta1, ep));
      const vh = m2[p] / (1 - Math.pow(cfg.beta2, ep));
      theta[p] -= ((p < 2 ? cfg.lrPhys : cfg.lrNn) * mh) / (Math.sqrt(vh) + cfg.eps);
    }
    theta[0] = clamp(theta[0], -cfg.phiBound, cfg.phiBound);
    theta[1] = clamp(theta[1], -cfg.phiBound, cfg.phiBound);
  }
  const final = lossAndGrad(plant, species, theta, obs, cfg);
  return { theta, history, initial, final };
}

/**
 * Uncertainty of a species' outlet 4 ppt day:
 *   parametric part  - delta method on the shared (phiK, phiQ) posterior (Gauss-Newton + prior),
 *   model-form part  - discrepancyPerDay x days of extrapolation beyond the last data point.
 * band = z * sqrt(sigma_param^2 + sigma_model^2) + 0.5 d. Coverage is measured on independent
 * synthetic plants by simulation/validation_report.py; it is a decision aid, not a certified interval.
 */
export function breachUncertainty(
  plant: PlantSpec,
  theta: number[],
  obs: Observation[],
  cfg: TwinConfig,
  sp: SpeciesId,
  z = 1,
  target = TARGET_PPT
): { sigmaDays: number; bandDays: number; parametricSigmaDays: number; modelFormSigmaDays: number } {
  const gi = new Array(N_PARAMS).fill(0);
  let ssr = 0;
  let h00 = 0;
  let h01 = 0;
  let h11 = 0;
  let lastObsDay = 0;
  for (const o of obs) {
    const ctxO = makeContext(plant, o.sp);
    const c = evalTwin(ctxO, theta, o.z, o.t, gi);
    const r = (c - o.y) / ctxO.C0;
    ssr += r * r;
    const j0 = gi[0] / ctxO.C0;
    const j1 = gi[1] / ctxO.C0;
    h00 += j0 * j0;
    h01 += j0 * j1;
    h11 += j1 * j1;
    lastObsDay = Math.max(lastObsDay, o.t);
  }
  const s2 = Math.max(ssr / Math.max(1, obs.length - 2), cfg.noiseFloor * cfg.noiseFloor);
  const prec = 1 / (cfg.priorSigma * cfg.priorSigma);
  const a = h00 / s2 + prec;
  const b = h01 / s2;
  const d = h11 / s2 + prec;
  const det = a * d - b * b;
  const cov = [
    [d / det, -b / det],
    [-b / det, a / det],
  ];
  const ctx = makeContext(plant, sp);
  const step = 1e-3;
  const dT: number[] = [0, 1].map((i) => {
    const plus = [...theta];
    const minus = [...theta];
    plus[i] += step;
    minus[i] -= step;
    const tp = crossingDay((t) => evalTwin(ctx, plus, z, t), target);
    const tm = crossingDay((t) => evalTwin(ctx, minus, z, t), target);
    return (tp - tm) / (2 * step);
  });
  const variance = dT[0] * dT[0] * cov[0][0] + 2 * dT[0] * dT[1] * cov[0][1] + dT[1] * dT[1] * cov[1][1];
  const parametricSigmaDays = Math.sqrt(Math.max(0, variance));
  const forecast = crossingDay((t) => evalTwin(ctx, theta, z, t), target);
  const modelFormSigmaDays = cfg.discrepancyPerDay * Math.max(0, forecast - lastObsDay);
  const sigmaDays = Math.sqrt(parametricSigmaDays * parametricSigmaDays + modelFormSigmaDays * modelFormSigmaDays);
  return { sigmaDays, bandDays: cfg.uncertaintyZ * sigmaDays + 0.5, parametricSigmaDays, modelFormSigmaDays };
}

export interface TwinPoint extends ObservationPoint {
  twinMidBedPpt: number;
  twinEffluentPpt: number;
  staticMidBedPpt: number;
  staticEffluentPpt: number;
}

export interface SpeciesTwinResult {
  ctx: TwinContext;
  priorKth: number;
  priorQ0: number;
  learnedKth: number;
  learnedQ0: number;
  midBed4PptDay: number;
  effluent4PptDay: number;
  staticEffluent4PptDay: number;
  testbenchEffluent4PptDay: number;
  uncertaintySigmaDays: number;
  uncertaintyBandDays: number;
  parametricSigmaDays: number;
  modelFormSigmaDays: number;
  points: TwinPoint[];
  trainRmsePpt: number;
  testRmsePpt: number;
  staticTestRmsePpt: number;
}

export interface PlantTwinFit {
  plant: PlantSpec;
  mode: 'validation' | 'operational';
  asOfDay: number | null;
  lastDataDay: number;
  trainedOn: SpeciesId[];
  theta: number[];
  config: TwinConfig;
  history: TrainingHistoryPoint[];
  initialLoss: LossBreakdown;
  finalLoss: LossBreakdown;
  species: Record<SpeciesId, SpeciesTwinResult>;
  r2All: number;
  rmseAll: number;
}

export function twinConcentration(fit: PlantTwinFit, sp: SpeciesId, z: number, t: number): number {
  return Math.max(0, evalTwin(fit.species[sp].ctx, fit.theta, z, t));
}

function rmse(errors: number[]): number {
  return Math.sqrt(errors.reduce((a, e) => a + e * e, 0) / Math.max(1, errors.length));
}

/**
 * Fits the twin on mid-bed TRAIN observations of `trainOn` (default: all four species) and evaluates
 * every species on the TEST points.
 *   - asOfDay undefined: validation protocol (TRAIN <= day 135, TEST = days 155-210).
 *   - asOfDay = D: operational mode (data every 15 days; only days <= D are used).
 */
export function fitPlantTwin(
  plant: PlantSpec,
  opts: { replicate?: number; config?: Partial<TwinConfig>; trainOn?: SpeciesId[]; asOfDay?: number } = {}
): PlantTwinFit {
  const cfg: TwinConfig = { ...TWIN_CONFIG, ...(opts.config ?? {}) };
  const trainOn = opts.trainOn ?? SPECIES_ORDER;
  const operational = opts.asOfDay !== undefined;
  const observations = operational
    ? generateObservations(plant, opts.replicate ?? 0, OPERATIONAL_DAYS, opts.asOfDay as number)
    : generateObservations(plant, opts.replicate ?? 0);
  const trainObs: Observation[] = trainOn.flatMap((sp) =>
    observations[sp]
      .filter((p) => p.split === 'TRAIN')
      .map((p) => ({ sp, z: MID_BED_Z, t: p.day, y: p.observedMidBedPpt }))
  );
  const lastDataDay = trainObs.reduce((a, o) => Math.max(a, o.t), 0);
  const { theta, history, initial, final } = trainTwin(plant, trainOn, trainObs, cfg);
  const zeros = new Array(N_PARAMS).fill(0);

  const species = {} as Record<SpeciesId, SpeciesTwinResult>;
  const obsAll: number[] = [];
  const predAll: number[] = [];
  for (const sp of SPECIES_ORDER) {
    const ctx = makeContext(plant, sp);
    const twinAt = (z: number, t: number) => Math.max(0, evalTwin(ctx, theta, z, t));
    const staticAt = (z: number, t: number) => Math.max(0, evalTwin(ctx, zeros, z, t));
    const points: TwinPoint[] = observations[sp].map((p) => ({
      ...p,
      twinMidBedPpt: twinAt(MID_BED_Z, p.day),
      twinEffluentPpt: twinAt(1, p.day),
      staticMidBedPpt: staticAt(MID_BED_Z, p.day),
      staticEffluentPpt: staticAt(1, p.day),
    }));
    const train = points.filter((p) => p.split === 'TRAIN');
    const test = points.filter((p) => p.split === 'TEST');
    points.forEach((p) => {
      obsAll.push(p.observedMidBedPpt, p.observedEffluentPpt);
      predAll.push(p.twinMidBedPpt, p.twinEffluentPpt);
    });
    const unc = breachUncertainty(plant, theta, trainObs, cfg, sp);
    species[sp] = {
      ctx,
      priorKth: ctx.k0,
      priorQ0: ctx.q0,
      learnedKth: ctx.k0 * Math.exp(theta[0]),
      learnedQ0: ctx.q0 * Math.exp(theta[1]),
      midBed4PptDay: crossingDay((t) => twinAt(MID_BED_Z, t), TARGET_PPT),
      effluent4PptDay: crossingDay((t) => twinAt(1, t), TARGET_PPT),
      staticEffluent4PptDay: crossingDay((t) => staticAt(1, t), TARGET_PPT),
      testbenchEffluent4PptDay: crossingDay((t) => truthConcentration(plant, sp, 1, t), TARGET_PPT),
      uncertaintySigmaDays: unc.sigmaDays,
      uncertaintyBandDays: unc.bandDays,
      parametricSigmaDays: unc.parametricSigmaDays,
      modelFormSigmaDays: unc.modelFormSigmaDays,
      points,
      trainRmsePpt: rmse(train.map((p) => p.twinMidBedPpt - p.observedMidBedPpt)),
      testRmsePpt: rmse(
        test.flatMap((p) => [p.twinMidBedPpt - p.observedMidBedPpt, p.twinEffluentPpt - p.observedEffluentPpt])
      ),
      staticTestRmsePpt: rmse(
        test.flatMap((p) => [p.staticMidBedPpt - p.observedMidBedPpt, p.staticEffluentPpt - p.observedEffluentPpt])
      ),
    };
  }
  const mean = obsAll.reduce((a, v) => a + v, 0) / obsAll.length;
  const ssRes = obsAll.reduce((a, v, i) => a + (v - predAll[i]) * (v - predAll[i]), 0);
  const ssTot = obsAll.reduce((a, v) => a + (v - mean) * (v - mean), 0);
  return {
    plant,
    mode: operational ? 'operational' : 'validation',
    asOfDay: operational ? (opts.asOfDay as number) : null,
    lastDataDay,
    trainedOn: trainOn,
    theta,
    config: cfg,
    history,
    initialLoss: initial,
    finalLoss: final,
    species,
    r2All: ssTot > 1e-9 ? 1 - ssRes / ssTot : 0,
    rmseAll: rmse(obsAll.map((v, i) => v - predAll[i])),
  };
}
