import { describe, expect, it } from 'vitest';
import {
  N_PARAMS,
  TWIN_CONFIG,
  crossingDay,
  fitPlantTwin,
  generateObservations,
  initialParams,
  lossAndGrad,
  staticPriorConcentration,
  truthConcentration,
} from '../hybridTwin';
import type { PlantSpec } from '../hybridTwin';
import { computeRegulatoryComplianceMetrics, XYLEM_FACILITIES, plantSpecFor, SPECIES_ORDER } from '../pfasPhysicsEngine';
import { BASE_ECONOMICS, computeEconomics } from '../economics';
import {
  REFERENCE_MATRIX,
  calibrateEdgeEstimator,
  estimateMixture,
  runMixtureBenchmark,
  simulateSensor,
} from '../sensorModel';
import { mulberry32 } from '../rng';
import { computeSituation } from '../situation';
import { NO_FAULTS } from '../ewsDecision';

const kkwwd: PlantSpec = {
  mediaType: 'GAC',
  flowRateMGD: 2.1,
  mediaMassKg: 9100,
  nomMgL: 2.1,
  includeRollup: true,
  C0: { PFBA: 26.5, PFBS: 31.0, PFOA: 38.5, PFOS: 44.0 },
};

describe('breakthrough twin', () => {
  it('has an analytical gradient that matches central finite differences (network + PDE terms on)', () => {
    const obs = SPECIES_ORDER.flatMap((sp) =>
      generateObservations(kkwwd)[sp]
        .filter((p) => p.split === 'TRAIN')
        .map((p) => ({ sp, z: 0.5, t: p.day, y: p.observedMidBedPpt }))
    );
    const cfg = { ...TWIN_CONFIG, useNetwork: true, lambdaAdv: 0.5, lambdaKin: 0.5 };
    const theta = initialParams(true).map((v, i) => v + 0.1 * Math.sin(i + 1));
    const g = new Array(N_PARAMS).fill(0);
    lossAndGrad(kkwwd, SPECIES_ORDER, theta, obs, cfg, g);
    for (let p = 0; p < N_PARAMS; p++) {
      const h = 1e-6;
      const tp = [...theta];
      const tm = [...theta];
      tp[p] += h;
      tm[p] -= h;
      const fd = (lossAndGrad(kkwwd, SPECIES_ORDER, tp, obs, cfg).total - lossAndGrad(kkwwd, SPECIES_ORDER, tm, obs, cfg).total) / (2 * h);
      expect(Math.abs(fd - g[p])).toBeLessThanOrEqual(1e-5 * Math.max(1e-6, Math.abs(fd) + Math.abs(g[p])) + 1e-10);
    }
  });

  it('returns finite, bounded results and reduces the loss', () => {
    const fit = fitPlantTwin(kkwwd);
    expect(fit.finalLoss.total).toBeLessThan(fit.initialLoss.total);
    for (const v of fit.theta) expect(Number.isFinite(v)).toBe(true);
    expect(Math.abs(fit.theta[0])).toBeLessThanOrEqual(TWIN_CONFIG.phiBound + 1e-12);
    for (const sp of SPECIES_ORDER) {
      const r = fit.species[sp];
      for (const v of [r.effluent4PptDay, r.midBed4PptDay, r.uncertaintyBandDays, r.testRmsePpt]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(r.midBed4PptDay).toBeLessThan(r.effluent4PptDay);
    }
  });

  it('keeps the published chain-length ordering (PFBA first, PFOS last) on GAC', () => {
    const fit = fitPlantTwin(kkwwd);
    const days = SPECIES_ORDER.map((sp) => fit.species[sp].effluent4PptDay);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });

  it('beats the static vendor curve on the PFOA/PFOS outlet breach (validation protocol)', () => {
    const fit = fitPlantTwin(kkwwd);
    for (const sp of ['PFOA', 'PFOS'] as const) {
      const r = fit.species[sp];
      expect(Math.abs(r.effluent4PptDay - r.testbenchEffluent4PptDay)).toBeLessThan(
        Math.abs(r.staticEffluent4PptDay - r.testbenchEffluent4PptDay)
      );
    }
  });

  it('never uses data from the future in operational mode', () => {
    const fit = fitPlantTwin(kkwwd, { asOfDay: 118 });
    expect(fit.lastDataDay).toBeLessThanOrEqual(118);
  });

  it('the static baseline is the Thomas prior (sanity)', () => {
    const d = crossingDay((t) => staticPriorConcentration(kkwwd, 'PFOA', 1, t), 4);
    expect(d).toBeGreaterThan(crossingDay((t) => truthConcentration(kkwwd, 'PFOA', 1, t), 4));
  });
});

describe('MIP sensor model', () => {
  const cal = calibrateEdgeEstimator();

  it('reports the true 2-norm condition number and determinant of S', () => {
    expect(cal.conditionNumberS).toBeCloseTo(1.6272, 3);
    expect(cal.determinantS).toBeCloseTo(0.9395, 3);
  });

  it('separates a mixture: deconvolution beats the diagonal-only estimate', () => {
    const b = runMixtureBenchmark(cal, 120, 4242);
    expect(b.methods.full.mapePct).toBeLessThan(b.methods.diagonal.mapePct);
    expect(b.methods.full.mapePct).toBeLessThan(b.methods.uncompensated.mapePct);
  });

  it('recovers a noise-free mixture at the reference matrix within 10%', () => {
    const mix = [8, 5, 3, 2];
    const r = simulateSensor(mix, REFERENCE_MATRIX, mulberry32(7), { noiseScale: 0 });
    const est = estimateMixture(r, cal);
    est.estimatePpt.forEach((v, i) => expect(Math.abs(v - mix[i]) / mix[i]).toBeLessThan(0.1));
  });

  it('the blind estimator takes no true concentration or true NOM', () => {
    expect(estimateMixture.length).toBe(2);
  });
});

describe('regulatory screen and economics', () => {
  it('labels the EU sum as a partial 7-of-20 estimate and checks PFOA/PFOS at 4 ppt', () => {
    const m = computeRegulatoryComplianceMetrics({
      effluentPpt: { PFBA: 1, PFBS: 200, PFOA: 4.1, PFOS: 1 },
      coContaminantsInfluentPpt: { pfhxs: 0, pfna: 0, genx: 0 },
      removalEfficiencyFraction: 0.9,
    });
    expect(m.euAnalytesCovered).toBe(7);
    expect(m.euAnalytesRequired).toBe(20);
    expect(m.epaInstantaneousScreenPass).toBe(false);
    expect(m.hazardIndex).toBeCloseTo(200 / 2000, 6);
  });

  it('reproduces the README base case and break-even', () => {
    const e = computeEconomics(BASE_ECONOMICS);
    expect(Math.round(e.net)).toBe(112092);
    expect(e.breakEvenExtension).toBeCloseTo(0.0602, 3);
    expect(e.mediaAvoidedTonnes).toBeCloseTo(15.288, 3);
  });
});

describe('plant situation (Twin + EWS tabs)', () => {
  const facility = XYLEM_FACILITIES[0];
  const run = (day: number, extra: Partial<Parameters<typeof computeSituation>[0]> = {}) =>
    computeSituation({
      facility,
      operatingDay: day,
      flowMultiplier: 1,
      c0Multiplier: 1,
      scenario: 'normal',
      switchDay: null,
      scadaMode: 'autonomous',
      operatorApproved: false,
      faults: NO_FAULTS,
      ...extra,
    });

  it('monitors early in the run and only PFOA/PFOS can be limiting', () => {
    const s = run(118);
    expect(s.decision.action).toBe('MONITOR');
    expect(['PFOA', 'PFOS']).toContain(s.limiting.speciesId);
  });

  it('rotates near the breach, and refuses when a fault is injected', () => {
    expect(run(300).decision.action).toBe('ACTUATE');
    expect(run(300, { faults: { ...NO_FAULTS, prefilterClog: true } }).decision.action).toBe('BLOCKED');
    expect(run(300, { faults: { ...NO_FAULTS, sondeOffline: true } }).decision.action).toBe('BLOCKED');
    expect(run(300, { faults: { ...NO_FAULTS, channelDrift: true } }).decision.action).toBe('BLOCKED');
  });

  it('after a rotation the final effluent is far below 4 ppt', () => {
    const s = run(330, { switchDay: 300 });
    expect(s.rotated).toBe(true);
    expect(s.finalEffluent.PFOA).toBeLessThan(1);
  });

  it('builds the plant from the facility profile', () => {
    expect(plantSpecFor(facility).C0.PFOA).toBe(facility.influentProfile.PFOA);
  });
});
