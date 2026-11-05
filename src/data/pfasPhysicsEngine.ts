import { PFAS_SPECIES, SPECIES_ORDER } from './species';
import type { PfasSpeciesConfig, SpeciesId, MediaType } from './species';
import {
  EXPERIMENTAL_HYBRID_CONFIG,
  MID_BED_Z,
  fitPlantTwin,
  round1,
  round2,
  round3,
  truthConcentration,
  twinConcentration,
} from './hybridTwin';
import type { PlantSpec, PlantTwinFit } from './hybridTwin';
import {
  CROSS_SELECTIVITY,
  GROUP_SENSITIVITY_OHM,
  defaultCalibration,
  estimateMixture,
  readingSeed,
  runMixtureBenchmark,
  simulateSensor,
  simulatedLodPpt,
} from './sensorModel';
import type { MixtureBenchmark, SensorMatrix } from './sensorModel';
import { mulberry32 } from './rng';

export { PFAS_SPECIES, SPECIES_ORDER };
export type { PfasSpeciesConfig, SpeciesId, MediaType };

/**
 * 4x4 MIP Cross-Selectivity Matrix S (Rows: Channel Group 1..4, Cols: True PFBA, PFBS, PFOA, PFOS).
 * Design assumption for partial cross-reactivity between analogs sharing fluorocarbon tails or headgroups
 * (-COO⁻ vs -SO₃⁻). Values come from CROSS_SELECTIVITY in sensorModel.ts (single source).
 */
export interface CrossSelectivityRow {
  channelGroup: string;
  imprintTarget: 'PFBA' | 'PFBS' | 'PFOA' | 'PFOS';
  functionalMotif: string;
  affinityWeights: Record<'PFBA' | 'PFBS' | 'PFOA' | 'PFOS', number>;
}

const weightsOfGroup = (g: number) =>
  Object.fromEntries(SPECIES_ORDER.map((sp, j) => [sp, CROSS_SELECTIVITY[g][j]])) as Record<SpeciesId, number>;

export const MIP_CROSS_SELECTIVITY_MATRIX: CrossSelectivityRow[] = [
  {
    channelGroup: 'CH01–CH07 (Group 1)',
    imprintTarget: 'PFBA',
    functionalMotif: 'C4 Perfluoropropyl + Carboxylate (-COO⁻) Pocket',
    affinityWeights: weightsOfGroup(0),
  },
  {
    channelGroup: 'CH08–CH14 (Group 2)',
    imprintTarget: 'PFBS',
    functionalMotif: 'C4 Perfluorobutyl + Sulfonate (-SO₃⁻) Pocket',
    affinityWeights: weightsOfGroup(1),
  },
  {
    channelGroup: 'CH15–CH21 (Group 3)',
    imprintTarget: 'PFOA',
    functionalMotif: 'C8 Perfluoroheptyl + Carboxylate (-COO⁻) Pocket',
    affinityWeights: weightsOfGroup(2),
  },
  {
    channelGroup: 'CH22–CH28 (Group 4)',
    imprintTarget: 'PFOS',
    functionalMotif: 'C8 Perfluorooctyl + Sulfonate (-SO₃⁻) Pocket',
    affinityWeights: weightsOfGroup(3),
  },
];

export interface FacilityProfile {
  id: string;
  name: string;
  shortName: string;
  location: string;
  regulatoryRegime: string;
  mediaType: 'GAC' | 'IX' | 'HYBRID';
  mediaBrand: string;
  flowRateMGD: number; // Million Gallons per Day
  mediaMassKg: number; // Per Lead Vessel
  ebctMinutes: number; // Empty Bed Contact Time
  currentOperatingDay: number;
  influentProfile: Record<'PFOA' | 'PFOS' | 'PFBS' | 'PFBA', number>;
  coContaminantsPpt: {
    pfhxs: number;
    pfna: number;
    genx: number;
  };
  matrixDefaults: {
    tempC: number;
    pH: number;
    turbidityNTU: number;
    conductivityUsCm: number;
    nomMgL: number; // Natural Organic Matter / Humic Acid (mg/L DOC)
  };
  benchmarkNote: string;
}

export const XYLEM_FACILITIES: FacilityProfile[] = [
  {
    id: 'kkwwd-maine',
    name: 'Kennebunk, Kennebunkport & Wells Water District (KKWWD)',
    shortName: 'KKWWD Maine (GAC)',
    location: 'Maine, USA (EPA Region 1)',
    regulatoryRegime: 'US EPA MCL (4.0 ppt PFOA/PFOS | Compliance 2029, extension to 2031 announced)',
    mediaType: 'GAC',
    mediaBrand: 'Evoqua AquaCarb® Coconut-Based GAC, Lead-Lag (as in published KKWWD case)',
    flowRateMGD: 2.1,
    mediaMassKg: 9100,
    ebctMinutes: 11.5,
    currentOperatingDay: 118,
    influentProfile: {
      PFOA: 38.5,
      PFOS: 44.0,
      PFBS: 31.0,
      PFBA: 26.5,
    },
    coContaminantsPpt: {
      pfhxs: 4.8,
      pfna: 3.2,
      genx: 2.4,
    },
    matrixDefaults: {
      tempC: 14.2,
      pH: 7.1,
      turbidityNTU: 0.45,
      conductivityUsCm: 285,
      nomMgL: 2.1,
    },
    benchmarkNote:
      'Representative lead-lag coconut-based GAC train inspired by the published Xylem/Evoqua KKWWD (Maine) case study; flow, media mass and influent levels are illustrative assumptions, not utility data. Key operational challenge: early short-chain PFBA/PFBS breakthrough and chromatographic roll-up prior to long-chain PFOA/PFOS exhaustion.',
  },
  {
    id: 'shwsd-colorado',
    name: 'Stratmoor Hills Water & Sanitation District (SHWSD)',
    shortName: 'Stratmoor Hills CO (Selective IX)',
    location: 'Colorado Springs, CO, USA',
    regulatoryRegime: 'US EPA MCL (4.0 ppt PFOA/PFOS | HI rescission proposed)',
    mediaType: 'IX',
    mediaBrand: 'Evoqua Selective Single-Use Ion Exchange Resin (as in published SHWSD case)',
    flowRateMGD: 1.1,
    mediaMassKg: 3800,
    ebctMinutes: 2.8,
    currentOperatingDay: 164,
    influentProfile: {
      PFOA: 52.0,
      PFOS: 68.0,
      PFBS: 46.0,
      PFBA: 29.0,
    },
    coContaminantsPpt: {
      pfhxs: 7.4,
      pfna: 4.1,
      genx: 3.0,
    },
    matrixDefaults: {
      tempC: 16.8,
      pH: 7.6,
      turbidityNTU: 0.25,
      conductivityUsCm: 490,
      nomMgL: 1.3,
    },
    benchmarkNote:
      'Representative selective single-use IX design inspired by the published Xylem/Evoqua Stratmoor Hills (Colorado) case study (4 vessels, 350 gpm). Flow is scaled up to 1.1 MGD here as an illustrative assumption; groundwater reportedly impacted by historical AFFF use.',
  },
  {
    id: 'brabant-eu',
    name: 'Representative EU Hybrid GAC-IX Train (Dutch Groundwater Profile)',
    shortName: 'EU Hybrid NL (Representative)',
    location: 'North Brabant, Netherlands (EU)',
    regulatoryRegime: 'EU Drinking Water Directive 2026 (100 ng/L Sum) & EPA 4 ppt Standard',
    mediaType: 'HYBRID',
    mediaBrand: 'Evoqua Lead GAC + Lag Selective IX Polishing Train (Xylem Vue SWE)',
    flowRateMGD: 3.4,
    mediaMassKg: 14200,
    ebctMinutes: 14.0,
    currentOperatingDay: 132,
    influentProfile: {
      PFOA: 34.0,
      PFOS: 39.0,
      PFBS: 49.0,
      PFBA: 41.0,
    },
    coContaminantsPpt: {
      pfhxs: 5.5,
      pfna: 3.6,
      genx: 4.2,
    },
    matrixDefaults: {
      tempC: 12.5,
      pH: 7.4,
      turbidityNTU: 0.6,
      conductivityUsCm: 360,
      nomMgL: 2.8,
    },
    benchmarkNote:
      'Illustrative European lead GAC + lag selective IX polishing train under the EU DWD Sum-of-20 limit; a hypothetical profile, not a specific utility or Xylem deployment.',
  },
];

// ---------------------------------------------------------------------------------------------
// Breakthrough twin (implementation in hybridTwin.ts)
// ---------------------------------------------------------------------------------------------
export type { PlantSpec, PlantTwinFit, SpeciesTwinResult, TwinPoint, TrainingHistoryPoint } from './hybridTwin';
export {
  COLLOCATION_POINTS,
  EXPERIMENTAL_HYBRID_CONFIG,
  LAST_OBSERVATION_DAY,
  MID_BED_Z,
  OBSERVATION_DAYS,
  OPERATIONAL_DAYS,
  TARGET_PPT,
  TRAIN_DAYS,
  TWIN_CONFIG,
  pdeResidualRms,
  staticPriorConcentration,
  truthConcentration,
  twinConcentration,
} from './hybridTwin';

export interface PlantOptions {
  flowMultiplier?: number;
  c0Multiplier?: number;
  nomMgL?: number;
  includeRollup?: boolean;
  flowRateMGD?: number;
  mediaMassKg?: number;
  c0Override?: Partial<Record<SpeciesId, number>>;
}

/** Builds the vessel + influent description used by the twin and the testbench. */
export function plantSpecFor(facility: FacilityProfile, o: PlantOptions = {}): PlantSpec {
  const c0Mult = o.c0Multiplier ?? 1;
  const C0 = {} as Record<SpeciesId, number>;
  for (const sp of SPECIES_ORDER) C0[sp] = round1(o.c0Override?.[sp] ?? facility.influentProfile[sp] * c0Mult);
  return {
    mediaType: facility.mediaType,
    flowRateMGD: round2(o.flowRateMGD ?? facility.flowRateMGD * (o.flowMultiplier ?? 1)),
    mediaMassKg: Math.round(o.mediaMassKg ?? facility.mediaMassKg),
    nomMgL: round2(o.nomMgL ?? facility.matrixDefaults.nomMgL),
    includeRollup: o.includeRollup ?? true,
    C0,
  };
}

const fitCache = new Map<string, PlantTwinFit>();

function plantKey(p: PlantSpec): string {
  return [p.mediaType, p.flowRateMGD, p.mediaMassKg, p.nomMgL, p.includeRollup, ...SPECIES_ORDER.map((s) => p.C0[s])].join('|');
}

function cachedFit(key: string, compute: () => PlantTwinFit): PlantTwinFit {
  const hit = fitCache.get(key);
  if (hit) return hit;
  const fit = compute();
  if (fitCache.size > 120) fitCache.clear();
  fitCache.set(key, fit);
  return fit;
}

/** Validation protocol fit (TRAIN mid-bed days 30-135, TEST days 155-210). */
export function getValidationFit(plant: PlantSpec, experimental = false): PlantTwinFit {
  return cachedFit(`V|${plantKey(plant)}|${experimental}`, () =>
    fitPlantTwin(plant, { config: experimental ? EXPERIMENTAL_HYBRID_CONFIG : {} })
  );
}

/** Operational fit: only mid-bed data available on or before `asOfDay` (one point every 15 days). */
export function getOperationalFit(plant: PlantSpec, asOfDay: number, experimental = false): PlantTwinFit {
  const dataDay = Math.max(0, Math.floor(asOfDay / 15) * 15);
  return cachedFit(`O|${plantKey(plant)}|${dataDay}|${experimental}`, () =>
    fitPlantTwin(plant, { asOfDay: dataDay, config: experimental ? EXPERIMENTAL_HYBRID_CONFIG : {} })
  );
}

/**
 * Converts operating run time (days) into dimensionless Bed Volumes (BV) processed:
 * BV = (t_days * 1440 min/day) / EBCT_minutes
 */
export function computeBedVolumes(day: number, ebctMinutes: number): number {
  return Math.round((day * 1440) / Math.max(1.0, ebctMinutes));
}

export interface SpeciesTrainState {
  speciesId: SpeciesId;
  c0: number;
  /** Run time of the current lead vessel in equivalent days (differs from the plant day after a rotation). */
  effectiveRunDays: number;
  midBedPpt: number;
  leadOutletPpt: number;
  finalEffluentPpt: number;
  isRollupActive: boolean;
  forecastLeadOutlet4PptDay: number;
  forecastMidBed4PptDay: number;
  uncertaintyBandDays: number;
  conservativeBreachDay: number;
  remainingDays: number;
  conservativeRemainingDays: number;
  staticLeadOutlet4PptDay: number;
}

/**
 * Equivalent loading time of the former lag vessel at the moment of rotation: the mass it has
 * retained (inflow at z = 1 minus outflow at z = 2), expressed as days of full-strength influent.
 */
function equivalentLoadingDays(fn: (z: number, t: number) => number, c0: number, switchDay: number): number {
  let retained = 0;
  for (let t = 0; t < switchDay; t++) retained += fn(1, t + 0.5) - fn(2, t + 0.5);
  return retained / Math.max(1e-9, c0);
}

/**
 * Lead-lag train state. The lead vessel spans z in [0, 1] and the lag vessel z in [1, 2]; after a
 * rotation the former lag becomes the lead with an equivalent loading time, and fresh media is the lag.
 * Live values come from the testbench plant; forecasts come from the twin fit.
 */
export function computeTrainState(
  plant: PlantSpec,
  fit: PlantTwinFit,
  day: number,
  switchDay: number | null
): Record<SpeciesId, SpeciesTrainState> {
  const out = {} as Record<SpeciesId, SpeciesTrainState>;
  for (const sp of SPECIES_ORDER) {
    const c0 = plant.C0[sp];
    const truthFn = (z: number, t: number) => truthConcentration(plant, sp, z, t);
    const twinFn = (z: number, t: number) => twinConcentration(fit, sp, z, t);
    const rotated = switchDay !== null && day >= switchDay;
    const tauTruth = rotated ? equivalentLoadingDays(truthFn, c0, switchDay as number) : 0;
    const tEff = rotated ? day - (switchDay as number) + tauTruth : day;
    const r = fit.species[sp];
    const tauTwin = rotated ? equivalentLoadingDays(twinFn, c0, switchDay as number) : 0;
    const shift = rotated ? (switchDay as number) - tauTwin : 0;
    const forecastLead = r.effluent4PptDay + shift;
    const lead = truthFn(1, tEff);
    out[sp] = {
      speciesId: sp,
      c0,
      effectiveRunDays: tEff,
      midBedPpt: truthFn(MID_BED_Z, tEff),
      leadOutletPpt: lead,
      finalEffluentPpt: truthFn(2, tEff),
      isRollupActive: lead > c0 * 1.01,
      forecastLeadOutlet4PptDay: forecastLead,
      forecastMidBed4PptDay: r.midBed4PptDay + shift,
      uncertaintyBandDays: r.uncertaintyBandDays,
      conservativeBreachDay: forecastLead - r.uncertaintyBandDays,
      remainingDays: forecastLead - day,
      conservativeRemainingDays: forecastLead - r.uncertaintyBandDays - day,
      staticLeadOutlet4PptDay: r.staticEffluent4PptDay + shift,
    };
  }
  return out;
}

/** The compliance-limiting species (binding MCL) with the earliest conservative breach. */
export function complianceLimitingSpecies(state: Record<SpeciesId, SpeciesTrainState>): SpeciesTrainState {
  const candidates = SPECIES_ORDER.filter((sp) => PFAS_SPECIES[sp].epaRegulationType === 'Binding Federal MCL (4.0 ppt)');
  return candidates.map((sp) => state[sp]).sort((a, b) => a.conservativeRemainingDays - b.conservativeRemainingDays)[0];
}

// ---------------------------------------------------------------------------------------------
// MIP sensor (implementation in sensorModel.ts)
// ---------------------------------------------------------------------------------------------
export {
  CROSS_SELECTIVITY,
  defaultCalibration,
  estimateMixture,
  simulateSensor,
} from './sensorModel';
export type { EdgeCalibration, MixtureBenchmark, SensorMatrix } from './sensorModel';

/** Background mixture used in the interactive sensor tab (a mid-bed sample during C4 breakthrough). */
export const BACKGROUND_MIX_PPT: Record<SpeciesId, number> = { PFBA: 6, PFBS: 4, PFOA: 2, PFOS: 1.5 };

export interface MipSignalResult {
  idealDeltaRct: number;
  measuredDeltaRct: number;
  nipBlankDeltaRct: number;
  purifiedDeltaRct: number;
  totalMatrixDriftOhms: number;
  crossSelectivityBleedOhms: number;
  debyeLengthNm: number;
  amineProtonationPct: number;
  fdomQsu: number;
  uncompensatedPpt: number;
  nipOnlyPpt: number;
  diagonalPpt: number;
  edgeAiCompensatedPpt: number;
  uncompensatedErrorPct: number;
  edgeAiErrorPct: number;
  worstGroupCvPct: number;
  matrixConditionNumber: number;
  matrixDeterminant: number;
  calibratedConditionNumber: number;
  mixture: { speciesId: SpeciesId; truePpt: number; estimatePpt: number; diagonalPpt: number }[];
}

/**
 * Interactive sensor reading: the selected species at `truePpt` in the background mixture.
 * Forward simulation (hidden physics) -> blind estimator (calibration only).
 */
export function computeMipElectrochemicalSignal(params: {
  truePpt: number;
  speciesId: SpeciesId;
  tempC: number;
  pH: number;
  turbidityNTU: number;
  conductivityUsCm: number;
  nomMgL: number;
  assayMode?: 'quantitative' | 'screening';
  formFactor?: 'flow-cell' | 'sample-cup';
  cartridgeAgeDays?: number;
}): MipSignalResult {
  const cal = defaultCalibration();
  const g = SPECIES_ORDER.indexOf(params.speciesId);
  const mix = SPECIES_ORDER.map((sp) => (sp === params.speciesId ? params.truePpt : BACKGROUND_MIX_PPT[sp]));
  const m: SensorMatrix = {
    tempC: params.tempC,
    pH: params.pH,
    conductivityUsCm: params.conductivityUsCm,
    turbidityNTU: params.turbidityNTU,
    nomMgL: params.nomMgL,
    cartridgeAgeDays: params.cartridgeAgeDays ?? 10,
  };
  const modeCode = (params.assayMode === 'screening' ? 2 : 1) + (params.formFactor === 'sample-cup' ? 2 : 0);
  const rand = mulberry32(readingSeed({ speciesIdx: g, truePpt: params.truePpt, m, modeCode }));
  const reading = simulateSensor(mix, m, rand, { assayMode: params.assayMode, formFactor: params.formFactor });
  const est = estimateMixture(reading, cal);
  const ideal = GROUP_SENSITIVITY_OHM[g] * CROSS_SELECTIVITY[g][g] * Math.log1p(params.truePpt);
  const errPct = (v: number) => (Math.abs(v - params.truePpt) / Math.max(0.5, params.truePpt)) * 100;
  return {
    idealDeltaRct: round1(ideal),
    measuredDeltaRct: round1(reading.groupMeanOhm[g]),
    nipBlankDeltaRct: round1(reading.nipMeanOhm),
    purifiedDeltaRct: round1(cal.sensitivity[g][g] * Math.max(0, est.logSignal[g])),
    totalMatrixDriftOhms: round1(reading.groupMeanOhm[g] - ideal),
    crossSelectivityBleedOhms: round1(reading.crossTalkOhm[g]),
    debyeLengthNm: round2(reading.debyeLengthNm),
    amineProtonationPct: round1(reading.amineProtonationPct),
    fdomQsu: round1(reading.sonde.fdomQsu),
    uncompensatedPpt: round2(est.uncompensatedPpt[g]),
    nipOnlyPpt: round2(est.nipOnlyPpt[g]),
    diagonalPpt: round2(est.diagonalPpt[g]),
    edgeAiCompensatedPpt: round2(est.estimatePpt[g]),
    uncompensatedErrorPct: round1(errPct(est.uncompensatedPpt[g])),
    edgeAiErrorPct: round1(errPct(est.estimatePpt[g])),
    worstGroupCvPct: round2(Math.max(...reading.groupCvPct)),
    matrixConditionNumber: round3(cal.conditionNumberS),
    matrixDeterminant: round3(cal.determinantS),
    calibratedConditionNumber: round3(cal.conditionNumberCalibrated),
    mixture: SPECIES_ORDER.map((sp, i) => ({
      speciesId: sp,
      truePpt: mix[i],
      estimatePpt: round2(est.estimatePpt[i]),
      diagonalPpt: round2(est.diagonalPpt[i]),
    })),
  };
}

/** Worst channel-group replicate CV (%) for the current mid-bed mixture and water matrix. */
export function sensorChannelCvPct(mixPpt: number[], m: SensorMatrix, seed: number): number {
  return Math.max(...simulateSensor(mixPpt, m, mulberry32(seed)).groupCvPct);
}

export const SENSOR_MIXTURE_BENCHMARK: MixtureBenchmark = runMixtureBenchmark(defaultCalibration());
export const SENSOR_SIMULATED_LOD_PPT: Record<SpeciesId, number> = Object.fromEntries(
  simulatedLodPpt(defaultCalibration()).map((v, i) => [SPECIES_ORDER[i], round2(v)])
) as Record<SpeciesId, number>;

// ---------------------------------------------------------------------------------------------
// Regulatory screens (decision support only - not a compliance determination)
// ---------------------------------------------------------------------------------------------
/**
 * Instantaneous screen of simulated final-train effluent against:
 * 1. US EPA (89 FR 32532, April 2024): PFOA, PFOS MCL 4.0 ppt (kept; compliance 2029, extension to 2031
 *    announced May 2025). PFHxS, PFNA, HFPO-DA 10 ppt and the Hazard Index are proposed for rescission.
 *    Formal compliance uses running annual averages of quarterly samples, not one value.
 * 2. EU DWD 2020/2184 "Sum of PFAS" (20 named PFAS, 100 ng/L): only 7 of the 20 are modelled here,
 *    so the value is a partial 7-analyte estimate. "PFAS Total" (500 ng/L) is not estimated.
 */
export function computeRegulatoryComplianceMetrics(params: {
  effluentPpt: Record<SpeciesId, number>;
  coContaminantsInfluentPpt: { pfhxs: number; pfna: number; genx: number };
  removalEfficiencyFraction: number;
}) {
  const rem = Math.max(0.05, Math.min(0.995, params.removalEfficiencyFraction));
  const effPfhxs = round2(params.coContaminantsInfluentPpt.pfhxs * (1 - rem));
  const effPfna = round2(params.coContaminantsInfluentPpt.pfna * (1 - rem));
  const effGenx = round2(params.coContaminantsInfluentPpt.genx * (1 - rem));
  const hazardIndex = round3(params.effluentPpt.PFBS / 2000 + effPfhxs / 10 + effPfna / 10 + effGenx / 10);
  const euSumPartialNgL = round2(
    params.effluentPpt.PFOA + params.effluentPpt.PFOS + params.effluentPpt.PFBS + params.effluentPpt.PFBA + effPfhxs + effPfna + effGenx
  );
  const pfoaBelowMcl = params.effluentPpt.PFOA <= 4.0;
  const pfosBelowMcl = params.effluentPpt.PFOS <= 4.0;
  return {
    hazardIndex,
    effPfhxs,
    effPfna,
    effGenx,
    pfoaBelowMcl,
    pfosBelowMcl,
    coContaminantsBelow10Ppt: effPfhxs <= 10 && effPfna <= 10 && effGenx <= 10,
    hazardIndexBelowOne: hazardIndex <= 1.0,
    epaInstantaneousScreenPass: pfoaBelowMcl && pfosBelowMcl,
    euSumPartialNgL,
    euAnalytesCovered: 7,
    euAnalytesRequired: 20,
    euPartialBelowLimit: euSumPartialNgL <= 100,
    sentinelTracerWarning: params.effluentPpt.PFBA >= 4.0,
  };
}

// ---------------------------------------------------------------------------------------------
// Sensor stress test across five water matrices (simulation, computed live from the estimator)
// ---------------------------------------------------------------------------------------------
export interface MatrixStressTestRow {
  matrixName: string;
  referencePpt: number;
  speciesId: SpeciesId;
  uncompensatedSensorPpt: number;
  pfasSentinelEdgeAiPpt: number;
  recoveryPct: number;
  matrixConditions: string;
}

const MATRIX_STRESS_CONFIGS: {
  matrixName: string;
  truePpt: number;
  speciesId: SpeciesId;
  pH: number;
  tempC: number;
  nomMgL: number;
  conductivityUsCm: number;
  turbidityNTU: number;
}[] = [
  { matrixName: 'Buffered lab blank + 4.0 ppt PFOA spike', truePpt: 4.0, speciesId: 'PFOA', pH: 7.0, tempC: 20.0, nomMgL: 0.2, conductivityUsCm: 85, turbidityNTU: 0.2 },
  { matrixName: 'Moderate-humic groundwater (influent-like)', truePpt: 26.5, speciesId: 'PFBA', pH: 7.1, tempC: 14.2, nomMgL: 2.1, conductivityUsCm: 285, turbidityNTU: 0.8 },
  { matrixName: 'GAC mid-bed port (z/L = 0.50) near the breakthrough front', truePpt: 3.85, speciesId: 'PFBA', pH: 7.1, tempC: 14.2, nomMgL: 1.8, conductivityUsCm: 280, turbidityNTU: 0.6 },
  { matrixName: 'AFFF-impacted hard groundwater (high conductivity)', truePpt: 68.0, speciesId: 'PFOS', pH: 7.6, tempC: 16.8, nomMgL: 1.3, conductivityUsCm: 490, turbidityNTU: 1.1 },
  { matrixName: 'High-NOM surface-water blend (fouling stress test)', truePpt: 12.4, speciesId: 'PFBS', pH: 7.4, tempC: 12.5, nomMgL: 4.2, conductivityUsCm: 520, turbidityNTU: 2.4 },
];

export const MATRIX_STRESS_TEST_ROWS: MatrixStressTestRow[] = MATRIX_STRESS_CONFIGS.map((cfg) => {
  const res = computeMipElectrochemicalSignal({
    truePpt: cfg.truePpt,
    speciesId: cfg.speciesId,
    pH: cfg.pH,
    tempC: cfg.tempC,
    nomMgL: cfg.nomMgL,
    conductivityUsCm: cfg.conductivityUsCm,
    turbidityNTU: cfg.turbidityNTU,
  });
  return {
    matrixName: cfg.matrixName,
    referencePpt: cfg.truePpt,
    speciesId: cfg.speciesId,
    uncompensatedSensorPpt: res.uncompensatedPpt,
    pfasSentinelEdgeAiPpt: res.edgeAiCompensatedPpt,
    recoveryPct: round1((res.edgeAiCompensatedPpt / cfg.truePpt) * 100),
    matrixConditions: `pH ${cfg.pH.toFixed(1)} | ${cfg.tempC.toFixed(1)}°C | NOM ${cfg.nomMgL.toFixed(1)} mg/L | Cond ${cfg.conductivityUsCm} μS/cm`,
  };
});

export const MATRIX_STRESS_TEST_MAPE_PCT = round1(
  MATRIX_STRESS_TEST_ROWS.reduce((acc, r) => acc + Math.abs(r.recoveryPct - 100), 0) / MATRIX_STRESS_TEST_ROWS.length
);

// ---------------------------------------------------------------------------------------------
// Literature anchors (qualitative findings verified against the published abstracts)
// ---------------------------------------------------------------------------------------------
export interface PublishedLiteratureBenchmark {
  studyCitation: string;
  mediaAndScale: string;
  keyEmpiricalFinding: string;
  pinnModelAgreement: string;
}

export const PUBLISHED_LITERATURE_BREAKTHROUGH_BENCHMARKS: PublishedLiteratureBenchmark[] = [
  {
    studyCitation: 'McCleaf et al. (2017), Water Research 120, 77–87',
    mediaAndScale: 'Column tests with Filtrasorb 400 GAC and an anion-exchange resin (drinking water)',
    keyEmpiricalFinding:
      'Removal efficiency rises with perfluorocarbon chain length; sulfonates are removed better than carboxylates of similar length; DOC correlated poorly with PFAS removal in these columns.',
    pinnModelAgreement:
      'The testbench and the twin keep the same ordering: PFBA breaks through first, then PFBS, PFOA and PFOS. NOM fouling strength in the testbench is an assumption, not taken from this study.',
  },
  {
    studyCitation: 'Park et al. (2020), Water Research 170, 115364',
    mediaAndScale: 'Rapid small-scale column tests (RSSCT), four bituminous coal-based GACs, groundwater',
    keyEmpiricalFinding:
      'Longer EBCT gave steeper breakthrough curves without changing apparent capacity; PFAS hydrophobicity and carbon surface charge/pore structure governed performance.',
    pinnModelAgreement:
      'Motivates the RSSCT step in the roadmap (TRL 5) and the twin structure: capacity (q₀) and kinetics (k_Th) are separate, jointly assimilated bed-condition parameters.',
  },
];

export interface BomItem {
  subsystem: string;
  component: string;
  specification: string;
  unitCostUsd: number;
  lifecycleRole: 'Disposable Cartridge (Target BOM @ 10k/yr)' | 'Reusable In-Line Reader Pod';
}

export const HARDWARE_BOM: BomItem[] = [
  {
    subsystem: 'Molecular Recognition Layer',
    component: 'Stand-Alone MIP Membrane (32-Ch Multiplexed)',
    specification: '3D steric & electrostatic cavities templated for C4/C8 sub-classes (Oseyemi & Rezai 2025 architecture)',
    unitCostUsd: 4.20,
    lifecycleRole: 'Disposable Cartridge (Target BOM @ 10k/yr)',
  },
  {
    subsystem: 'Transducer Array',
    component: 'Amine-Functionalized Nanocarbon Electrode Chip',
    specification: 'Screen-printed carbon nanotube / graphene working electrodes + Ag/AgCl ref (inspired by Verralize nanocarbon sensors)',
    unitCostUsd: 3.85,
    lifecycleRole: 'Disposable Cartridge (Target BOM @ 10k/yr)',
  },
  {
    subsystem: 'Microfluidics & Redox',
    component: 'COC Microfluidic Flow Cell & Solid-State [Fe(CN)₆]³⁻/⁴⁻ Mediator',
    specification: 'Cyclic Olefin Copolymer laminar micro-channels with integrated 0.22 μm pre-filter membrane',
    unitCostUsd: 3.75,
    lifecycleRole: 'Disposable Cartridge (Target BOM @ 10k/yr)',
  },
  {
    subsystem: 'Potentiostat / EIS AFE',
    component: 'AD5940 High-Precision Impedance Analog Front-End + ADG732 32:1 Mux',
    specification: '0.1 Hz – 200 kHz Electrochemical Impedance Spectroscopy (EIS) & DPV interrogation across 32 channels',
    unitCostUsd: 28.50,
    lifecycleRole: 'Reusable In-Line Reader Pod',
  },
  {
    subsystem: 'Edge AI Compute & Comms',
    component: 'Dual-Core ARM Cortex-M33 + NPU Edge Node (Modbus/MQTT)',
    specification: 'Runs the calibration-based matrix compensation, 4x4 Tikhonov deconvolution & TLS 1.3 bridge to Xylem Vue',
    unitCostUsd: 42.00,
    lifecycleRole: 'Reusable In-Line Reader Pod',
  },
  {
    subsystem: 'Industrial Fluidics',
    component: '316L Stainless Piezo Micro-Pump & Auto-Purge Solenoid Valve',
    specification: 'Retrofits existing NPT 1/4" GAC/IX Influent, Mid-Bed, and Effluent sample ports (IP68 NEMA 4X)',
    unitCostUsd: 77.50,
    lifecycleRole: 'Reusable In-Line Reader Pod',
  },
];

export interface EngineeringLimitation {
  challenge: string;
  physicalCause: string;
  pfasSentinelMitigation: string;
  trlTarget: string;
}

export const HONEST_LIMITATIONS: EngineeringLimitation[] = [
  {
    challenge: 'Ultra-Trace Limit of Detection (Target 1–4 ppt) Signal-to-Noise Ratio',
    physicalCause:
      'PFAS molecules are electrochemically inert; direct faradaic oxidation/reduction does not occur at low potentials (<1.2 V).',
    pfasSentinelMitigation:
      'Uses indirect "gate-effect" Electrochemical Impedance Spectroscopy (EIS) with an embedded [Fe(CN)₆]³⁻/⁴⁻ redox mediator and 12-minute microfluidic pre-concentration across amine-functionalized nanocarbon.',
    trlTarget: 'TRL 3 In-Silico Model Complete → Target TRL 4 Wet-Lab Spike Calibration',
  },
  {
    challenge: 'Cross-Selectivity Between Structural PFAS Analogs (C4 vs. C8)',
    physicalCause:
      'MIP cavities templated for one PFAS also bind structural analogs sharing -COO⁻ or -SO₃⁻ headgroups; the design assumes 3%–15% cross-binding (matrix S), to be measured at TRL 4.',
    pfasSentinelMitigation:
      'Groups the 28 working channels into 4 sub-class regions (C4-COO⁻, C4-SO₃⁻, C8-COO⁻, C8-SO₃⁻) and applies Tikhonov-regularized 4×4 selectivity matrix inversion on the Edge NPU.',
    trlTarget: `Simulated: 4×4 deconvolution cuts mixture error from ${round1(SENSOR_MIXTURE_BENCHMARK.methods.diagonal.mapePct)}% to ${round1(SENSOR_MIXTURE_BENCHMARK.methods.full.mapePct)}% MAPE`,
  },
  {
    challenge: 'Natural Organic Matter (NOM / Humic Acid) & Co-Ion Interference',
    physicalCause:
      'Humic/fulvic acids and sulfate/chloride ions in raw groundwater exist at mg/L (ppm) levels—10⁶ times higher than ppt PFAS.',
    pfasSentinelMitigation:
      'Dual defense: (1) Stand-Alone MIP steric size-exclusion rejects bulky humic macromolecules; (2) 4 Non-Imprinted Polymer (NIP) blank channels + YSI/WTW sonde telemetry subtract residual drift.',
    trlTarget: `Simulated: NIP + sonde compensation, ${round1(SENSOR_MIXTURE_BENCHMARK.methods.full.medianApePct)}% median error on random mixtures`,
  },
  {
    challenge: 'Chromatographic "Roll-Up" (Competitive Desorption of Short-Chain PFAS)',
    physicalCause:
      'More strongly adsorbed PFOS/PFOA and NOM can displace previously adsorbed short-chain PFBA/PFBS, so their effluent can briefly exceed the influent (C > C₀).',
    pfasSentinelMitigation:
      'Retrofits onto existing vessel Mid-Bed sample ports (z/L = 0.50) to track the PFBA tracer wave and roll-up in the twin; Lead-Lag actuation is scheduled from the PFOA/PFOS effluent forecast, with C4 roll-up flagged to operators.',
    trlTarget: 'Roll-up simulated in the testbench and flagged by the twin (not forecast)',
  },
  {
    challenge: 'Irreversible MIP Cavity Saturation Over Continuous In-Line Operation',
    physicalCause:
      'High-affinity fluorophilic binding (assumed Ka ~ 10⁸ M⁻¹) means bound PFOS/PFOA is unlikely to desorb with plain water flushing.',
    pfasSentinelMitigation:
      'Proposed: indexed micro-valving + mild electrochemical pulse desorption, paired with a snap-in 30-day disposable cartridge ($11.80 target BOM at scale). Not yet tested.',
    trlTarget: 'Target TRL 5 Durability & Desorption Cycling Protocol Defined',
  },
  {
    challenge: 'Chip-to-Chip Sorption Variance in Hand-Packed MOF Sensors',
    physicalCause:
      'Hand-packed sorbent chips (e.g. MOF powders) are prone to batch-to-batch packing variance and delamination under hydraulic shear (design concern, not measured here).',
    pfasSentinelMitigation:
      'Proposes in-place photopolymerized stand-alone MIP membranes (after Oseyemi & Rezai, 2025 preprint / 2026 paper) on screen-printed nanocarbon electrodes (target channel CV < 5%).',
    trlTarget: 'Conceptual CAD & Wafer-Scale Manufacturing BOM Specified',
  },
];

export interface ResearchPillar {
  institution: string;
  year: string;
  technologyFocus: string;
  pfasSentinelIntegration: string;
}

export const RESEARCH_SYNTHESIS_PILLARS: ResearchPillar[] = [
  {
    institution: 'Oseyemi & Rezai, York University (Meas. Sci. Technol. 2026; preprint 2025)',
    year: '2025–2026',
    technologyFocus: 'Self-supporting microfluidic Molecularly Imprinted Polymer membrane without fragile support beads',
    pfasSentinelIntegration: 'Forms Layer 2 of the proposed cartridge, addressing MOF hand-packing sorption variance',
  },
  {
    institution: '2witech Solutions (NIEHS SBIR R43ES035347)',
    year: '2024–2025',
    technologyFocus: 'Portable MIP + electrochemical PFAS screening device reported across 1–200 ppt, under validation with real contaminated groundwater',
    pfasSentinelIntegration: 'Supports the MIP + electrochemical sensing principle used in Layers 2–3 of the proposed cartridge',
  },
  {
    institution: 'McCleaf et al. (2017) & Park et al. (2020), Water Research',
    year: '2017–2020',
    technologyFocus: 'GAC/anion-exchange column tests (McCleaf) and RSSCTs on four coal-based GACs (Park): chain-length, headgroup and carbon-property effects',
    pfasSentinelIntegration: 'Informs the testbench trends (short chains first) and the twin structure with separate capacity and kinetics',
  },
  {
    institution: 'Rowan University (NSF-funded, 2025–2027)',
    year: '2025–2027',
    technologyFocus: 'Low-cost PFAS sensor research and an MIP electrochemical sensor for landfill leachate (preliminary LOD in the low hundreds of ppt for PFOA)',
    pfasSentinelIntegration: 'Informs dual-mode interrogation: <2 min rapid plume screening & 12–15 min quantitative EIS',
  },
  {
    institution: 'Verralize (company-reported) & Analog Devices AD5940 AFE',
    year: '2025–2026',
    technologyFocus: 'Portable nanocarbon electrochemical PFAS biosensor reported at 4 ppt in 12–15 min (vendor claim), plus single-chip EIS potentiostat AFE',
    pfasSentinelIntegration: 'Enables 32-channel multiplexed array & $11.80 target disposable cartridge unit economics',
  },
];

export interface RegulatoryMilestone {
  date: string;
  authority: string;
  title: string;
  mandate: string;
  status: 'ENACTED' | 'MANDATORY NOW' | 'UPCOMING DEADLINE';
}

export const REGULATORY_TIMELINE: RegulatoryMilestone[] = [
  {
    date: 'April 2024',
    authority: 'US EPA (Federal)',
    title: 'Binding National Drinking Water Standard',
    mandate: 'Legally enforceable MCLs of 4.0 ppt for PFOA & PFOS, 10 ppt for PFHxS, PFNA & HFPO-DA (GenX), and a Hazard Index for mixtures incl. PFBS (89 FR 32532). The last three MCLs and the HI are now proposed for rescission.',
    status: 'ENACTED',
  },
  {
    date: 'January 2026',
    authority: 'European Union (DWD)',
    title: 'Mandatory EU Member State Compliance',
    mandate: 'EU Drinking Water Directive (2020/2184) harmonized PFAS monitoring and strict 100 ng/L (Sum of 20 PFAS including C4 PFBA/PFBS) compliance becomes mandatory across EU utilities.',
    status: 'MANDATORY NOW',
  },
  {
    date: 'April 2027',
    authority: 'US EPA (Federal)',
    title: 'Initial Monitoring Complete & Public Reporting',
    mandate: 'Public water systems complete initial PFAS monitoring and start reporting PFAS levels to their customers. Notices of MCL violations start only at the compliance date.',
    status: 'UPCOMING DEADLINE',
  },
  {
    date: 'May 2025 → 2031',
    authority: 'US EPA (Federal)',
    title: 'PFOA/PFOS Kept; Deadline Extended',
    mandate: 'EPA announced it will keep the 4.0 ppt PFOA/PFOS MCLs, extend compliance from April 2029 to April 2031, and rescind the PFHxS, PFNA, HFPO-DA and Hazard Index limits (proposed rules followed). PFOA/PFOS remain the durable treatment target.',
    status: 'UPCOMING DEADLINE',
  },
];

export interface MarketSizingRow {
  label: string;
  value: string;
  source: string;
  color: string;
}

export const US_MARKET_SIZING: MarketSizingRow[] = [
  {
    label: 'Public water systems covered by the US rule',
    value: '~66,000',
    source: 'US EPA PFAS NPDWR (April 2024)',
    color: '#00B4D8',
  },
  {
    label: 'Systems expected to need treatment (6–10%)',
    value: '~4,000–6,600',
    source: 'US EPA PFAS NPDWR (April 2024)',
    color: '#10B981',
  },
  {
    label: 'Annual national compliance cost',
    value: '$1.5B – $3.5B / yr',
    source: 'US EPA final rule ($1.5B); AWWA 2024 update with Corona Environmental & Black & Veatch ($2.7–3.5B)',
    color: '#F59E0B',
  },
  {
    label: 'Treatment capital over the next 5 years',
    value: '$37B – $48B',
    source: 'AWWA 2024 updated national cost estimate',
    color: '#A855F7',
  },
  {
    label: 'PFAS-Sentinel addressable revenue (US)',
    value: '$115M – $570M / yr',
    source: 'Own estimate: 4,000–6,600 systems × 2–6 vessels × $14,400 per vessel-year (upper bound)',
    color: '#38BDF8',
  },
];

export interface StakeholderFeedback {
  group: string;
  sampleSize: string;
  keyPainPointValidated: string;
  interviewQuote: string;
  designImpactOnPfasSentinel: string;
}

/**
 * Verifiable Literature, Regulatory & Published Utility Case Study Benchmarks
 * (Replaces unverified survey anecdotes with documented EPA, AWWA, Xylem/Evoqua & peer-reviewed evidence)
 */
export const STAKEHOLDER_VALIDATION_FINDINGS: StakeholderFeedback[] = [
  {
    group: 'Laboratory monitoring today (EPA Methods 533 / 537.1)',
    sampleSize: 'Typical commercial pricing (assumption)',
    keyPainPointValidated:
      'Compliance PFAS analysis is done by LC-MS/MS in accredited labs; the project assumes $300–$500 per sample and a 10–14 day turnaround, to be confirmed with labs and utilities.',
    interviewQuote:
      'Working hypothesis (to validate in utility interviews): without real-time breakthrough visibility, operators change lead media on conservative schedules, discarding an estimated 20%–30% of usable capacity. The business case breaks even at only 6% (Business tab).',
    designImpactOnPfasSentinel:
      'Retrofits existing Mid-Bed (z/L = 0.50) sample ports with 15-minute automated telemetry & SCADA Lead-Lag switchover.',
  },
  {
    group: 'Xylem / Evoqua Municipal Deployments (KKWWD Maine & SHWSD Colorado)',
    sampleSize: 'Published Xylem Case Studies',
    keyPainPointValidated:
      'Published Xylem/Evoqua case studies describe lead-lag coconut-based GAC (KKWWD, Maine) and selective single-use IX (Stratmoor Hills, Colorado) for PFAS; media service is scheduled from lab results.',
    interviewQuote:
      'Published practice: the KKWWD system runs lead-lag GAC vessels in series and SHWSD runs four selective IX vessels in single- or two-pass mode — both rely on off-site lab results to time media service.',
    designImpactOnPfasSentinel:
      'Built representative facility profiles inspired by the KKWWD (lead-lag GAC) and SHWSD (selective IX) case studies; flows and masses are illustrative assumptions.',
  },
  {
    group: 'Peer-Reviewed Column Breakthrough Literature (Water Research)',
    sampleSize: 'McCleaf et al. 2017; Park et al. 2020',
    keyPainPointValidated:
      'PFAS removal on GAC rises with chain length and is higher for sulfonates than carboxylates (McCleaf 2017); breakthrough shape depends on contact time and carbon properties (Park 2020).',
    interviewQuote:
      'Implication: short-chain PFAS reach the mid-bed port long before PFOA/PFOS reach the outlet, so they can serve as early tracers of the mass-transfer zone.',
    designImpactOnPfasSentinel:
      'Shared bed-condition assimilation lets PFBA/PFBS mid-bed data inform PFOA/PFOS forecasts; roll-up is simulated in the testbench and flagged, not forecast.',
  },
  {
    group: 'Xylem Vue powered by GoAigua Digitalization & Servitization Strategy',
    sampleSize: 'Design rationale (not survey data)',
    keyPainPointValidated:
      'Assumption to validate with utilities: operators prefer modules inside existing SCADA, Xylem Vue and O&M service contracts over new standalone dashboards and upfront CAPEX.',
    interviewQuote:
      'Design rationale: combining YSI EXO2 sonde data and Sensus/MJK flow with Evoqua media service gives a closed loop from measurement to action.',
    designImpactOnPfasSentinel:
      'Designed standardized OPC-UA/MQTT telemetry for Xylem Vue SWE and zero-CAPEX "$11.80 cartridge + O&M subscription" unit economics.',
  },
];

export interface CompetitorComparison {
  solutionName: string;
  category: string;
  detectionCapability: string;
  physicalTreatmentIntegration: string;
  digitalTwinAndAi: string;
  xylemEcosystemFit: string;
}

export const COMPETITIVE_LANDSCAPE_2026: CompetitorComparison[] = [
  {
    solutionName: 'PFAS-Sentinel™ (Proposed TRL 2–3 Architecture)',
    category: 'In-Line Microfluidic MIP-EIS Array + Physics-Based Breakthrough Twin',
    detectionCapability:
      'Target 1–4 ppt C4/C8 sub-classes in 12–15 min (32-ch Stand-Alone MIP + 4×4 Cross-Selectivity Deconvolution)',
    physicalTreatmentIntegration:
      'Retrofits existing 1/4" NPT Influent, Mid-Bed (z/L=0.50) & Effluent ports on GAC/IX vessels + automated Lead-Lag PLC control',
    digitalTwinAndAi:
      'Calibration-based blind estimator (NIP + sonde) + physics-based breakthrough twin with shared bed-condition assimilation (simulated)',
    xylemEcosystemFit:
      'Native Fit: Xylem Vue (GoAigua SWE), Evoqua GAC/IX, MitiGATOR™ Mobile Fleet, Sensus/MJK, YSI/WTW',
  },
  {
    solutionName: 'Centralized Offline LC-MS/MS Labs (EPA Method 533 / 537.1)',
    category: 'Current Regulatory Gold Standard (Off-Site Laboratory)',
    detectionCapability:
      'Certified quantitation at regulatory levels (EPA PQL 4.0 ppt for PFOA/PFOS) with full speciation; assumed $300–$500/sample and 10–14 day turnaround',
    physicalTreatmentIntegration:
      'No real-time control: results arrive days to weeks after sampling, so short-lived roll-up can be missed',
    digitalTwinAndAi:
      'Offline records; conservative changeout schedules (hypothesis: 20%–30% of usable capacity discarded)',
    xylemEcosystemFit:
      'Required quarterly for regulatory certification, but cannot provide continuous operational SCADA early warning',
  },
  {
    solutionName: 'Total Organofluorine (TOF / CIC) & Colorimetric Field Kits',
    category: 'Bulk Fluorine Screening & Portable Optical Assays',
    detectionCapability:
      'Bulk fluorine screening with detection limits typically far above the 4.0 ppt (ng/L) MCL; not species-specific',
    physicalTreatmentIntegration:
      'Manual benchtop or grab-sample screening; not designed for pressurized in-line GAC/IX mid-bed telemetry',
    digitalTwinAndAi:
      'Cannot distinguish short-chain C4 sentinel breakthrough from long-chain C8 exhaustion or model bed kinetics',
    xylemEcosystemFit:
      'Limited to high-concentration industrial spill triage; disconnected from Xylem Vue SWE and Evoqua media optimization',
  },
  {
    solutionName: 'Conventional Static Bed-Volume Curves & Manual Grab Sampling',
    category: 'Standard Municipal Utility Operating Practice',
    detectionCapability:
      'Relies on clean-water vendor isotherm curves plus monthly manual grab samples from mid-bed ports',
    physicalTreatmentIntegration:
      'Manual valve rotation on fixed calendar schedules; vulnerable to sudden flow surges (Q) or high-NOM storm fouling',
    digitalTwinAndAi:
      'Static empirical curves ignore real-time NOM pore-blocking and multi-solute C8-on-C4 competitive desorption roll-up',
    xylemEcosystemFit:
      'Leaves media changeout timing to conservative rules of thumb; no forecast of the remaining safe run time',
  },
];
