/**
 * The app engine (TypeScript) and the Python reference (simulation/pfas_sentinel_core.py) must agree.
 * reference_outputs.json is written by `python simulation/validation_report.py`.
 */
import { describe, expect, it } from 'vitest';
import reference from '../../../simulation/reference_outputs.json';
import { fitPlantTwin } from '../hybridTwin';
import type { PlantSpec } from '../hybridTwin';
import { calibrateEdgeEstimator, runMixtureBenchmark } from '../sensorModel';
import { mulberry32 } from '../rng';
import { SPECIES_ORDER } from '../species';

const kkwwd: PlantSpec = {
  mediaType: 'GAC',
  flowRateMGD: 2.1,
  mediaMassKg: 9100,
  nomMgL: 2.1,
  includeRollup: true,
  C0: { PFBA: 26.5, PFBS: 31.0, PFOA: 38.5, PFOS: 44.0 },
};

describe('TypeScript engine matches the Python reference', () => {
  it('produces the same pseudo-random stream', () => {
    const r = mulberry32(12345);
    reference.prngSeed12345.forEach((v) => expect(r()).toBe(v));
  });

  it('validation fit (KKWWD profile)', () => {
    const fit = fitPlantTwin(kkwwd);
    for (const sp of SPECIES_ORDER) {
      const ref = (reference.kkwwdValidation as Record<string, Record<string, number>>)[sp];
      const r = fit.species[sp];
      expect(r.effluent4PptDay).toBeCloseTo(ref.effluent4PptDay, 6);
      expect(r.midBed4PptDay).toBeCloseTo(ref.midBed4PptDay, 6);
      expect(r.uncertaintyBandDays).toBeCloseTo(ref.uncertaintyBandDays, 6);
      expect(r.testRmsePpt).toBeCloseTo(ref.testRmsePpt, 6);
      expect(r.learnedQ0).toBeCloseTo(ref.learnedQ0, 6);
    }
  });

  it('operational fit at day 240', () => {
    const fit = fitPlantTwin(kkwwd, { asOfDay: 240 });
    for (const sp of SPECIES_ORDER) {
      const ref = (reference.kkwwdOperationalDay240 as Record<string, Record<string, number>>)[sp];
      expect(fit.species[sp].effluent4PptDay).toBeCloseTo(ref.effluent4PptDay, 6);
      expect(fit.species[sp].uncertaintyBandDays).toBeCloseTo(ref.uncertaintyBandDays, 6);
    }
  });

  it('sensor calibration and mixture benchmark', () => {
    const cal = calibrateEdgeEstimator();
    expect(cal.conditionNumberCalibrated).toBeCloseTo(reference.sensorCalibration.conditionNumberCalibrated, 9);
    expect(cal.lambda).toBeCloseTo(reference.sensorCalibration.lambda, 9);
    cal.sensitivity.forEach((row, g) => expect(row[g]).toBeCloseTo(reference.sensorCalibration.sensitivityDiagonal[g], 9));
    expect(runMixtureBenchmark(cal).methods.full.mapePct).toBeCloseTo(reference.sensorBenchmarkFullMapePct, 6);
  });
});
