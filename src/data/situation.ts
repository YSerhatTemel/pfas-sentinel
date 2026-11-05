/**
 * One consistent snapshot of the simulated plant for the Twin and EWS tabs: live (testbench) values,
 * the operational twin forecast, interlock telemetry and the actuation decision.
 */
import {
  FacilityProfile,
  SPECIES_ORDER,
  SpeciesTrainState,
  complianceLimitingSpecies,
  computeBedVolumes,
  computeRegulatoryComplianceMetrics,
  computeTrainState,
  getOperationalFit,
  plantSpecFor,
  sensorChannelCvPct,
} from './pfasPhysicsEngine';
import type { PlantSpec, PlantTwinFit, SpeciesId } from './pfasPhysicsEngine';
import {
  ActuationDecision,
  FaultInjection,
  InterlockTelemetry,
  TARGET_TRIGGER_PPT,
  decideActuation,
  simulateInterlockTelemetry,
} from './ewsDecision';
import { seedFrom } from './rng';

export type ScenarioId = 'normal' | 'short-chain' | 'afff-surge' | 'matrix-storm';

export const SCENARIO_NOM_MULTIPLIER: Record<ScenarioId, number> = {
  normal: 1.0,
  'short-chain': 1.0,
  'afff-surge': 1.25,
  'matrix-storm': 2.15,
};

export interface Situation {
  plant: PlantSpec;
  fit: PlantTwinFit;
  train: Record<SpeciesId, SpeciesTrainState>;
  limiting: SpeciesTrainState;
  tracer: SpeciesTrainState;
  rotated: boolean;
  effectiveFlowMGD: number;
  effectiveEbctMinutes: number;
  effectiveNomMgL: number;
  bedVolumes: number;
  cartridgeAgeDays: number;
  sensorCvPct: number;
  interlockTelemetry: InterlockTelemetry;
  decision: ActuationDecision;
  regMetrics: ReturnType<typeof computeRegulatoryComplianceMetrics>;
  finalEffluent: Record<SpeciesId, number>;
}

export function computeSituation(input: {
  facility: FacilityProfile;
  operatingDay: number;
  flowMultiplier: number;
  c0Multiplier: number;
  scenario: ScenarioId;
  switchDay: number | null;
  scadaMode: 'autonomous' | 'human-in-the-loop';
  operatorApproved: boolean;
  faults: FaultInjection;
}): Situation {
  const { facility, operatingDay } = input;
  const effectiveNomMgL = Number((facility.matrixDefaults.nomMgL * SCENARIO_NOM_MULTIPLIER[input.scenario]).toFixed(1));
  const plant = plantSpecFor(facility, {
    flowMultiplier: input.flowMultiplier,
    c0Multiplier: input.c0Multiplier,
    nomMgL: effectiveNomMgL,
  });
  const rotated = input.switchDay !== null && operatingDay >= input.switchDay;
  // After a rotation the twin keeps the data it had at the switch (it describes the same water and media).
  const fitDay = rotated ? (input.switchDay as number) : operatingDay;
  const fit = getOperationalFit(plant, fitDay);
  const train = computeTrainState(plant, fit, operatingDay, rotated ? input.switchDay : null);
  const limiting = complianceLimitingSpecies(train);
  const tracer = train.PFBA;
  const effectiveEbctMinutes = Number((facility.ebctMinutes / Math.max(0.2, input.flowMultiplier)).toFixed(2));
  const cartridgeAgeDays = Math.round(operatingDay) % 30;
  const mix = SPECIES_ORDER.map((sp) => train[sp].midBedPpt);
  const sensorCvPct = sensorChannelCvPct(
    mix,
    {
      tempC: facility.matrixDefaults.tempC,
      pH: facility.matrixDefaults.pH,
      conductivityUsCm: facility.matrixDefaults.conductivityUsCm,
      turbidityNTU: facility.matrixDefaults.turbidityNTU,
      nomMgL: effectiveNomMgL,
      cartridgeAgeDays,
    },
    seedFrom(Math.round(operatingDay) + 1, 4242)
  );
  const interlockTelemetry = simulateInterlockTelemetry({
    flowMultiplier: input.flowMultiplier,
    nomMgL: effectiveNomMgL,
    operatingDay,
    sensorCvPct,
    faults: input.faults,
  });
  const decision = decideActuation({
    mode: input.scadaMode,
    operatorApproved: input.operatorApproved,
    alreadySwitched: rotated,
    limitingSpecies: limiting.speciesId,
    conservativeRemainingDays: limiting.conservativeRemainingDays,
    currentLeadOutletPpt: limiting.leadOutletPpt,
    triggerPpt: TARGET_TRIGGER_PPT,
    interlocks: interlockTelemetry,
  });
  const finalEffluent = Object.fromEntries(SPECIES_ORDER.map((sp) => [sp, Number(train[sp].finalEffluentPpt.toFixed(2))])) as Record<SpeciesId, number>;
  const removal =
    SPECIES_ORDER.reduce((acc, sp) => acc + (1 - train[sp].finalEffluentPpt / Math.max(1, train[sp].c0)), 0) / SPECIES_ORDER.length;
  const regMetrics = computeRegulatoryComplianceMetrics({
    effluentPpt: finalEffluent,
    coContaminantsInfluentPpt: facility.coContaminantsPpt,
    removalEfficiencyFraction: Math.max(0.05, removal),
  });
  return {
    plant,
    fit,
    train,
    limiting,
    tracer,
    rotated,
    effectiveFlowMGD: plant.flowRateMGD,
    effectiveEbctMinutes,
    effectiveNomMgL,
    bedVolumes: computeBedVolumes(operatingDay, effectiveEbctMinutes),
    cartridgeAgeDays,
    sensorCvPct,
    interlockTelemetry,
    decision,
    regMetrics,
    finalEffluent,
  };
}
