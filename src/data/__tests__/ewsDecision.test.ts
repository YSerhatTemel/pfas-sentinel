import { describe, expect, it } from 'vitest';
import {
  EMERGENCY_LEAD_DAYS,
  NO_FAULTS,
  SERVICE_LEAD_TIME_DAYS,
  decideActuation,
  evaluateManualOverride,
  simulateInterlockTelemetry,
} from '../ewsDecision';

const healthy = { heartbeatAgeS: 1.2, eisCvPct: 2, deltaPPsi: 8 };
const base = {
  mode: 'autonomous' as const,
  operatorApproved: false,
  alreadySwitched: false,
  limitingSpecies: 'PFOA',
  conservativeRemainingDays: 30,
  currentLeadOutletPpt: 1,
  triggerPpt: 4,
  interlocks: healthy,
};

describe('EWS actuation rules', () => {
  it('does not rotate outside the service window, even in autonomous mode', () => {
    const d = decideActuation({ ...base, conservativeRemainingDays: SERVICE_LEAD_TIME_DAYS + 1 });
    expect(d.action).toBe('MONITOR');
    expect(d.scheduleMediaService).toBe(false);
  });

  it('rotates inside the window when every interlock passes (autonomous)', () => {
    const d = decideActuation(base);
    expect(d.action).toBe('ACTUATE');
    expect(d.scheduleMediaService).toBe(true);
  });

  it('blocks on sonde heartbeat loss', () => {
    const d = decideActuation({ ...base, interlocks: { ...healthy, heartbeatAgeS: 31 } });
    expect(d.action).toBe('BLOCKED');
    expect(d.blockers.join(' ')).toMatch(/heartbeat/i);
  });

  it('blocks when electrode replicates disagree', () => {
    const d = decideActuation({ ...base, interlocks: { ...healthy, eisCvPct: 14 } });
    expect(d.action).toBe('BLOCKED');
  });

  it('blocks on an unsafe pressure drop', () => {
    const d = decideActuation({ ...base, interlocks: { ...healthy, deltaPPsi: 19 } });
    expect(d.action).toBe('BLOCKED');
  });

  it('waits for operator sign-off in co-pilot mode', () => {
    expect(decideActuation({ ...base, mode: 'human-in-the-loop' }).action).toBe('AWAIT_APPROVAL');
    expect(decideActuation({ ...base, mode: 'human-in-the-loop', operatorApproved: true }).action).toBe('ACTUATE');
  });

  it('treats an outlet already at the trigger as inside the window', () => {
    const d = decideActuation({ ...base, conservativeRemainingDays: 200, currentLeadOutletPpt: 4.2 });
    expect(d.action).toBe('ACTUATE');
    expect(d.mitigatorRecommended).toBe(true);
  });

  it('recommends MitiGATOR only inside the emergency lead time', () => {
    expect(decideActuation({ ...base, conservativeRemainingDays: EMERGENCY_LEAD_DAYS + 5 }).mitigatorRecommended).toBe(false);
    expect(decideActuation({ ...base, conservativeRemainingDays: EMERGENCY_LEAD_DAYS - 1 }).mitigatorRecommended).toBe(true);
  });

  it('does nothing after a rotation', () => {
    expect(decideActuation({ ...base, alreadySwitched: true }).action).toBe('NO_ACTION');
  });

  it('lets a manual override bypass the forecast rule but not the hydraulic interlock', () => {
    expect(evaluateManualOverride({ ...healthy, heartbeatAgeS: 31 }).allowed).toBe(true);
    expect(evaluateManualOverride({ ...healthy, deltaPPsi: 19 }).allowed).toBe(false);
  });
});

describe('interlock telemetry simulation', () => {
  const t = (faults = NO_FAULTS) =>
    simulateInterlockTelemetry({ flowMultiplier: 1, nomMgL: 2.1, operatingDay: 200, sensorCvPct: 1.5, faults });

  it('is healthy without faults', () => {
    const v = t();
    expect(v.heartbeatAgeS).toBeLessThan(5);
    expect(v.eisCvPct).toBeLessThan(10);
    expect(v.deltaPPsi).toBeLessThan(18);
  });

  it('each injected fault trips its own interlock', () => {
    expect(t({ ...NO_FAULTS, sondeOffline: true }).heartbeatAgeS).toBeGreaterThanOrEqual(5);
    expect(t({ ...NO_FAULTS, channelDrift: true }).eisCvPct).toBeGreaterThanOrEqual(10);
    expect(t({ ...NO_FAULTS, prefilterClog: true }).deltaPPsi).toBeGreaterThanOrEqual(18);
  });
});
