/**
 * Early-warning decision rules and safety interlocks for lead-lag rotation.
 * Every interlock value is computed from (simulated) telemetry; a valve command is only issued when
 * all interlocks pass, the forecast breach is inside the service window and governance allows it.
 */

/** Typical media procurement + Evoqua service scheduling lead time (configurable per utility). */
export const SERVICE_LEAD_TIME_DAYS = 60;
/** Below this the media service cannot arrive in time; MitiGATOR contingency is recommended. */
export const EMERGENCY_LEAD_DAYS = 14;
export const INTERLOCK_LIMITS = { heartbeatAgeS: 5, eisCvPct: 10, deltaPPsi: 18 };
/** Lead-vessel outlet level (inter-vessel port) at which rotation is due; the lag vessel still polishes. */
export const TARGET_TRIGGER_PPT = 4.0;

export interface FaultInjection {
  sondeOffline: boolean;
  channelDrift: boolean;
  prefilterClog: boolean;
}

export const NO_FAULTS: FaultInjection = { sondeOffline: false, channelDrift: false, prefilterClog: false };

export interface InterlockTelemetry {
  heartbeatAgeS: number;
  eisCvPct: number;
  deltaPPsi: number;
}

/**
 * Simulated plant telemetry behind the interlocks. The EIS value is the worst channel-group replicate
 * CV from the sensor simulator; the vessel pressure drop grows with flow and NOM loading of the bed.
 */
export function simulateInterlockTelemetry(input: {
  flowMultiplier: number;
  nomMgL: number;
  operatingDay: number;
  sensorCvPct: number;
  faults: FaultInjection;
}): InterlockTelemetry {
  const loading = 1 + 0.15 * Math.max(0, input.nomMgL - 1) * Math.min(1, input.operatingDay / 400);
  return {
    heartbeatAgeS: input.faults.sondeOffline ? 31 : 1.2,
    // Drift fault: a ~60 ohm offset on two of the seven electrodes of a group (about +12 CV points).
    eisCvPct: input.sensorCvPct + (input.faults.channelDrift ? 12 : 0),
    deltaPPsi: 6.5 * Math.pow(Math.max(0.2, input.flowMultiplier), 1.8) * loading + (input.faults.prefilterClog ? 11.5 : 0),
  };
}

export type InterlockId = 'heartbeat' | 'eisVariance' | 'deltaP';

export interface InterlockStatus {
  id: InterlockId;
  label: string;
  value: number;
  limit: number;
  unit: string;
  pass: boolean;
  onFail: string;
}

export function evaluateInterlocks(t: InterlockTelemetry): InterlockStatus[] {
  return [
    {
      id: 'heartbeat',
      label: 'Sonde heartbeat (Modbus)',
      value: t.heartbeatAgeS,
      limit: INTERLOCK_LIMITS.heartbeatAgeS,
      unit: 's',
      pass: t.heartbeatAgeS < INTERLOCK_LIMITS.heartbeatAgeS,
      onFail: 'Matrix context lost: sensor compensation unreliable, automatic actuation blocked.',
    },
    {
      id: 'eisVariance',
      label: 'EIS replicate CV (worst group)',
      value: t.eisCvPct,
      limit: INTERLOCK_LIMITS.eisCvPct,
      unit: '%',
      pass: t.eisCvPct < INTERLOCK_LIMITS.eisCvPct,
      onFail: 'Electrode replicates disagree (bubble, drift or fouling): sensor flagged untrusted.',
    },
    {
      id: 'deltaP',
      label: 'Vessel pressure drop',
      value: t.deltaPPsi,
      limit: INTERLOCK_LIMITS.deltaPPsi,
      unit: 'psi',
      pass: t.deltaPPsi < INTERLOCK_LIMITS.deltaPPsi,
      onFail: 'Hydraulic condition outside safe range: valve operation blocked.',
    },
  ];
}

export type ActuationAction = 'NO_ACTION' | 'MONITOR' | 'AWAIT_APPROVAL' | 'ACTUATE' | 'BLOCKED';

export interface ActuationDecision {
  action: ActuationAction;
  reasons: string[];
  blockers: string[];
  scheduleMediaService: boolean;
  mitigatorRecommended: boolean;
  withinServiceWindow: boolean;
  interlocks: InterlockStatus[];
}

/**
 * Lead-lag rotation decision. `conservativeRemainingDays` is (forecast breach day - uncertainty band)
 * minus today for the compliance-limiting species (PFOA/PFOS); C4 tracer alerts never enter here.
 */
export function decideActuation(input: {
  mode: 'autonomous' | 'human-in-the-loop';
  operatorApproved: boolean;
  alreadySwitched: boolean;
  limitingSpecies: string;
  conservativeRemainingDays: number;
  currentLeadOutletPpt: number;
  triggerPpt: number;
  interlocks: InterlockTelemetry;
}): ActuationDecision {
  const interlocks = evaluateInterlocks(input.interlocks);
  const blockers = interlocks.filter((i) => !i.pass).map((i) => `${i.label}: ${i.onFail}`);
  const outletAtTrigger = input.currentLeadOutletPpt >= input.triggerPpt;
  const withinServiceWindow = input.conservativeRemainingDays <= SERVICE_LEAD_TIME_DAYS || outletAtTrigger;
  const emergency = input.conservativeRemainingDays <= EMERGENCY_LEAD_DAYS || outletAtTrigger;
  const base = { blockers, interlocks, withinServiceWindow };

  if (input.alreadySwitched) {
    return {
      ...base,
      action: 'NO_ACTION',
      reasons: ['Lead-lag already rotated; the twin now tracks the new lead vessel.'],
      scheduleMediaService: false,
      mitigatorRecommended: false,
    };
  }
  if (!withinServiceWindow) {
    return {
      ...base,
      action: 'MONITOR',
      reasons: [
        `${input.limitingSpecies} conservative breach is ${input.conservativeRemainingDays.toFixed(0)} d away, outside the ${SERVICE_LEAD_TIME_DAYS}-day service window.`,
      ],
      scheduleMediaService: false,
      mitigatorRecommended: false,
    };
  }
  if (blockers.length > 0) {
    return {
      ...base,
      action: 'BLOCKED',
      reasons: ['Inside the service window, but at least one interlock failed; operator alarm raised.'],
      scheduleMediaService: false,
      mitigatorRecommended: emergency,
    };
  }
  if (input.mode === 'human-in-the-loop' && !input.operatorApproved) {
    return {
      ...base,
      action: 'AWAIT_APPROVAL',
      reasons: ['Inside the service window and all interlocks pass; waiting for operator sign-off.'],
      scheduleMediaService: false,
      mitigatorRecommended: emergency,
    };
  }
  return {
    ...base,
    action: 'ACTUATE',
    reasons: [
      `${input.limitingSpecies} conservative breach in ${Math.max(0, input.conservativeRemainingDays).toFixed(0)} d is inside the ${SERVICE_LEAD_TIME_DAYS}-day window; all interlocks pass.`,
    ],
    scheduleMediaService: true,
    mitigatorRecommended: emergency,
  };
}

/** Manual override bypasses the forecast rule but never the hydraulic interlock. */
export function evaluateManualOverride(t: InterlockTelemetry): { allowed: boolean; blockers: string[] } {
  const dp = evaluateInterlocks(t).find((i) => i.id === 'deltaP') as InterlockStatus;
  return dp.pass ? { allowed: true, blockers: [] } : { allowed: false, blockers: [`${dp.label}: ${dp.onFail}`] };
}

export type AuditSource =
  | 'EWS_DECISION'
  | 'OPERATOR_APPROVAL'
  | 'MANUAL_OVERRIDE'
  | 'MITIGATOR_DISPATCH'
  | 'SCENARIO_PRESET'
  | 'RESET';

export interface AuditEvent {
  id: number;
  timestampIso: string;
  operatingDay: number;
  actor: string;
  source: AuditSource;
  action: string;
  details: string;
}
