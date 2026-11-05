import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, FileCheck2, Lock, Play, RefreshCw, ShieldAlert, Truck, Zap } from 'lucide-react';
import { FacilityProfile, LAST_OBSERVATION_DAY } from '../data/pfasPhysicsEngine';
import type { Situation } from '../data/situation';
import {
  AuditEvent,
  EMERGENCY_LEAD_DAYS,
  FaultInjection,
  INTERLOCK_LIMITS,
  SERVICE_LEAD_TIME_DAYS,
} from '../data/ewsDecision';
import { BASE_ECONOMICS } from '../data/economics';

interface AgenticEwsTabProps {
  facility: FacilityProfile;
  operatingDay: number;
  situation: Situation;
  scadaMode: 'autonomous' | 'human-in-the-loop';
  setScadaMode: (m: 'autonomous' | 'human-in-the-loop') => void;
  operatorApproved: boolean;
  setOperatorApproved: (v: boolean) => void;
  faults: FaultInjection;
  setFaults: (f: FaultInjection) => void;
  mitigatorDispatched: boolean;
  onRunDecision: () => void;
  onToggleManualRotation: () => void;
  onToggleMitigator: () => void;
  auditLog: AuditEvent[];
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

async function sha256Hex(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) return 'unavailable (needs a secure context)';
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const ACTION_STYLE: Record<string, string> = {
  ACTUATE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
  AWAIT_APPROVAL: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
  BLOCKED: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
  MONITOR: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  NO_ACTION: 'bg-slate-700/40 text-slate-300 border-slate-600',
};

export const AgenticEwsTab: React.FC<AgenticEwsTabProps> = ({
  facility,
  operatingDay,
  situation,
  scadaMode,
  setScadaMode,
  operatorApproved,
  setOperatorApproved,
  faults,
  setFaults,
  mitigatorDispatched,
  onRunDecision,
  onToggleManualRotation,
  onToggleMitigator,
  auditLog,
}) => {
  const [showExport, setShowExport] = useState<boolean>(false);
  const [digest, setDigest] = useState<string>('');
  const { decision, limiting, tracer, regMetrics, finalEffluent } = situation;
  const forecastDay = r1(limiting.forecastLeadOutlet4PptDay);
  const band = r1(limiting.uncertaintyBandDays);
  const conservativeRemaining = r1(limiting.conservativeRemainingDays);
  const extrapolating = limiting.forecastLeadOutlet4PptDay > situation.fit.lastDataDay;
  const savedMediaKg = Math.round(facility.mediaMassKg * BASE_ECONOMICS.bedLifeExtension);

  const exportPayload = {
    disclaimer:
      'Simulated decision-support log from an in-silico testbench (TRL 2-3). Not a regulatory compliance record and not a certified measurement.',
    facilityProfile: `${facility.name} (representative profile)`,
    operatingDay,
    bedVolumes: situation.bedVolumes,
    governanceMode: scadaMode,
    operatorApproved,
    faultsInjected: faults,
    leadLagRotated: situation.rotated,
    mitigatorDispatched,
    decision: { action: decision.action, reasons: decision.reasons, blockers: decision.blockers },
    interlocks: decision.interlocks.map((i) => ({ id: i.id, value: r2(i.value), limit: i.limit, unit: i.unit, pass: i.pass })),
    forecast: {
      limitingSpecies: limiting.speciesId,
      leadOutlet4PptDay: forecastDay,
      uncertaintyBandDays: band,
      conservativeRemainingDays: conservativeRemaining,
      twinDataUpToDay: situation.fit.lastDataDay,
      pfbaTracerMidBedPpt: r2(tracer.midBedPpt),
    },
    instantaneousScreenOfSimulatedFinalEffluent: {
      ppt: finalEffluent,
      pfoaPfosBelow4Ppt: regMetrics.epaInstantaneousScreenPass,
      hazardIndex2024Rule: regMetrics.hazardIndex,
      euSumPartial: `${regMetrics.euSumPartialNgL} ng/L over ${regMetrics.euAnalytesCovered} of ${regMetrics.euAnalytesRequired} analytes`,
    },
    auditLog,
  };
  const payloadText = JSON.stringify(exportPayload, null, 2);

  useEffect(() => {
    if (!showExport) return;
    let alive = true;
    sha256Hex(payloadText).then((h) => alive && setDigest(h));
    return () => {
      alive = false;
    };
  }, [showExport, payloadText]);

  const downloadLog = async () => {
    const hash = await sha256Hex(payloadText);
    const blob = new Blob([JSON.stringify({ sha256OfPayload: hash, payload: exportPayload }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PFAS_Sentinel_decision_log_${facility.id}_day${operatingDay}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const faultToggles: { key: keyof FaultInjection; label: string; effect: string }[] = [
    { key: 'sondeOffline', label: 'Sonde heartbeat loss', effect: 'heartbeat 31 s' },
    { key: 'channelDrift', label: 'EIS channel drift', effect: 'replicate CV +12 points' },
    { key: 'prefilterClog', label: 'Pre-filter clog', effect: 'ΔP +11.5 psi' },
  ];

  const nodes = [
    {
      step: 1,
      name: 'Node 01 • Sensor + YSI EXO2 context',
      role: 'Blind estimator (simulated)',
      status: `PFBA mid-bed ${r2(tracer.midBedPpt)} ppt ${tracer.midBedPpt >= 4 ? '• TRACER ALERT' : ''}`,
      detail: `Mid-bed port (z/L = 0.50): PFBA ${r2(tracer.midBedPpt)} ppt (C4 tracer, never actuates), ${limiting.speciesId} ${r2(limiting.midBedPpt)} ppt. Worst channel-group CV ${r2(situation.sensorCvPct)}%. YSI EXO2 supplies pH, temperature, conductivity and fDOM context; it does not measure PFAS.`,
    },
    {
      step: 2,
      name: 'Node 02 • Breakthrough twin',
      role: 'Physics-based assimilation (Xylem Vue concept)',
      status: `${limiting.speciesId} lead outlet 4 ppt ≈ day ${forecastDay} ±${band}`,
      detail: `Shared bed-condition parameters are assimilated from all four species' mid-bed data up to day ${situation.fit.lastDataDay}. ${
        extrapolating ? 'The forecast lies beyond the last data point (extrapolation); the band widens with that distance.' : ''
      } Band = parametric + model-form term, calibrated to ~91% coverage on held-out synthetic plants.`,
    },
    {
      step: 3,
      name: 'Node 03 • PLC lead-lag rotation',
      role: 'Interlocked actuation (MV-104 / MV-105)',
      status: situation.rotated ? 'ROTATED' : decision.action,
      detail: `Rotation only when (forecast − band) − today ≤ ${SERVICE_LEAD_TIME_DAYS} d (now ${conservativeRemaining} d), all three interlocks pass and governance allows it. Manual override is logged and still blocked by the hydraulic interlock.`,
    },
    {
      step: 4,
      name: 'Node 04 • Evoqua media service & MitiGATOR™',
      role: 'Service logistics (concept)',
      status: situation.rotated ? 'MEDIA SERVICE SCHEDULED' : mitigatorDispatched ? 'MitiGATOR DISPATCHED' : 'STANDBY',
      detail: `Rotation raises a media service work order for the exhausted vessel. MitiGATOR™ is recommended only if the conservative breach is within ${EMERGENCY_LEAD_DAYS} days or the lead outlet already exceeds 4 ppt (${
        decision.mitigatorRecommended ? 'recommended now' : 'not needed now'
      }).`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0B1D30] border border-cyan-500/30 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Bot className="w-4 h-4" />
              Early-Warning System (EWS) • Interlocked lead-lag decision support
            </span>
            <h2 className="text-lg font-bold text-white mt-0.5">
              Forecast-gated rotation, Evoqua media service &amp; MitiGATOR™ contingency
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Every number on this tab is computed from the simulated plant: the interlocks from simulated telemetry,
              the forecast from the operational twin, the decision from fixed rules. Use the fault switches to see the
              system refuse to act.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onRunDecision}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run EWS Decision
            </button>
            <button
              onClick={onToggleManualRotation}
              className={`px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-all ${
                situation.rotated
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-[#10263F] text-slate-300 border-slate-700 hover:border-cyan-500/40'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {situation.rotated ? 'Rotated (undo demo)' : 'Manual Override (logged)'}
            </button>
            <button
              onClick={onToggleMitigator}
              className={`px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-all ${
                mitigatorDispatched
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-[#10263F] text-slate-300 border-slate-700 hover:border-amber-500/40'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              {mitigatorDispatched ? 'MitiGATOR™: Dispatched' : 'Dispatch MitiGATOR™'}
            </button>
            <button
              onClick={() => setShowExport(!showExport)}
              className={`px-3.5 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-all ${
                showExport
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                  : 'bg-[#10263F] hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              {showExport ? 'Hide Decision Log' : 'Export Decision Log'}
            </button>
          </div>
        </div>
      </div>

      {showExport && (
        <div className="bg-[#061320] border-2 border-cyan-400/70 rounded-xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-mono uppercase text-cyan-400 font-bold block">
                Simulated decision-support log • not a regulatory compliance record
              </span>
              <p className="text-xs text-slate-400 mt-0.5 break-all">
                SHA-256 of the payload (computed in the browser): <span className="font-mono text-slate-200">{digest || '…'}</span>
              </p>
            </div>
            <button
              onClick={downloadLog}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs"
            >
              ↓ Download JSON
            </button>
          </div>
          <pre className="max-h-64 overflow-auto text-[10px] font-mono text-slate-300 bg-[#0B1D30] border border-slate-800 rounded-lg p-3">
            {payloadText}
          </pre>
        </div>
      )}

      {/* Governance, fault injection and interlocks */}
      <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 font-bold block">
              Governance &amp; safety interlocks (computed, not fixed)
            </span>
            <p className="text-xs text-slate-300 mt-0.5">
              Co-pilot mode needs an operator sign-off; autonomous mode acts on its own but only when every interlock
              passes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-[#061320] p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setScadaMode('human-in-the-loop')}
                className={`px-2.5 py-1 rounded font-semibold transition-all ${
                  scadaMode === 'human-in-the-loop' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Operator Co-Pilot (default)
              </button>
              <button
                onClick={() => setScadaMode('autonomous')}
                className={`px-2.5 py-1 rounded font-semibold transition-all ${
                  scadaMode === 'autonomous' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Autonomous
              </button>
            </div>
            {scadaMode === 'human-in-the-loop' && (
              <button
                onClick={() => setOperatorApproved(!operatorApproved)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                  operatorApproved
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                {operatorApproved ? '✓ Operator sign-off: GIVEN' : '⚠ Operator sign-off: PENDING'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-[11px] text-slate-400 uppercase">Fault injection (demo):</span>
          {faultToggles.map((f) => (
            <button
              key={f.key}
              onClick={() => setFaults({ ...faults, [f.key]: !faults[f.key] })}
              className={`px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                faults[f.key]
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                  : 'bg-[#061320] text-slate-300 border-slate-700 hover:border-rose-500/40'
              }`}
            >
              {faults[f.key] ? '● ' : '○ '}
              {f.label} <span className="text-slate-500">({f.effect})</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-xs">
          {decision.interlocks.map((i) => (
            <div
              key={i.id}
              className={`bg-[#061320] border rounded-lg p-3 ${i.pass ? 'border-slate-800' : 'border-rose-500/60'}`}
            >
              <div
                className={`flex items-center justify-between font-mono text-[11px] font-bold ${
                  i.pass ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                <span>{i.label}</span>
                <span>
                  {i.pass ? 'PASS' : 'FAIL'} ({r2(i.value)} {i.unit} {i.pass ? '<' : '≥'} {i.limit})
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {i.id === 'heartbeat' &&
                  'Age of the last YSI EXO2 Modbus message. Without matrix context the sensor estimate cannot be compensated.'}
                {i.id === 'eisVariance' &&
                  `Worst coefficient of variation across the 7 replicate electrodes of a channel group (cartridge day ${situation.cartridgeAgeDays}/30).`}
                {i.id === 'deltaP' &&
                  `Vessel pressure drop from flow (x${r2(situation.effectiveFlowMGD / facility.flowRateMGD)}) and NOM loading; limit ${INTERLOCK_LIMITS.deltaPPsi} psi protects valves and bed.`}
                {!i.pass && <span className="block text-rose-300 mt-1">{i.onFail}</span>}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Decision panel */}
      <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 space-y-2">
          <span className="text-[11px] font-mono uppercase text-cyan-400 font-bold">Current EWS decision</span>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-sm ${ACTION_STYLE[decision.action]}`}>
              {decision.action}
            </span>
            {decision.mitigatorRecommended && (
              <span className="px-2 py-0.5 rounded border border-amber-500/50 bg-amber-500/15 text-amber-300 text-[11px] font-mono">
                MitiGATOR™ recommended
              </span>
            )}
          </div>
          <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
            {decision.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
            {decision.blockers.map((b) => (
              <li key={b} className="text-rose-300">
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-7 grid grid-cols-2 gap-3 text-xs">
          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3">
            <span className="text-slate-400 block">Limiting species (binding MCL)</span>
            <span className="font-mono text-white font-bold">{limiting.speciesId}</span>
          </div>
          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3">
            <span className="text-slate-400 block">Lead-outlet 4 ppt forecast</span>
            <span className="font-mono text-white font-bold">
              day {forecastDay} ±{band}
            </span>
            {extrapolating && <span className="block text-[10px] text-amber-300">extrapolation beyond day {situation.fit.lastDataDay}</span>}
          </div>
          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3">
            <span className="text-slate-400 block">Conservative time left (forecast − band − today)</span>
            <span className={`font-mono font-bold ${decision.withinServiceWindow ? 'text-amber-300' : 'text-emerald-300'}`}>
              {conservativeRemaining} d (window ≤ {SERVICE_LEAD_TIME_DAYS} d)
            </span>
          </div>
          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3">
            <span className="text-slate-400 block">PFBA mid-bed tracer</span>
            <span className={`font-mono font-bold ${tracer.midBedPpt >= 4 ? 'text-amber-300' : 'text-slate-200'}`}>
              {r2(tracer.midBedPpt)} ppt {tracer.midBedPpt >= 4 ? '(alert, no actuation)' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Pipeline nodes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nodes.map((n) => (
          <div key={n.step} className="rounded-xl p-4 border bg-[#0B1D30] border-cyan-500/30">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-mono text-cyan-400 uppercase">{n.role}</span>
                <h3 className="text-sm font-bold text-white mt-0.5">{n.name}</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-right">
                {n.status}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">{n.detail}</p>
          </div>
        ))}
      </div>

      {/* Screen summary, service and modelled impact */}
      <div className="bg-[#0B1D30] border border-emerald-500/40 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Instantaneous screen, media service &amp; modelled impact</h3>
              <p className="text-xs text-slate-400">
                {facility.shortName} (representative profile) • day {operatingDay} • {situation.bedVolumes.toLocaleString('en-US')} BV •
                Q = {situation.effectiveFlowMGD} MGD
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs">
          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="font-mono text-[11px] text-cyan-400 uppercase font-bold">1. Screen of simulated final effluent</div>
            <div className="flex justify-between">
              <span className="text-slate-400">PFOA / PFOS (4 ppt):</span>
              <span className={`font-mono font-bold ${regMetrics.epaInstantaneousScreenPass ? 'text-emerald-400' : 'text-rose-400'}`}>
                {finalEffluent.PFOA} / {finalEffluent.PFOS} ppt
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Hazard Index (2024 rule):</span>
              <span className="font-mono text-white">{regMetrics.hazardIndex}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">EU Sum of PFAS (partial):</span>
              <span className="font-mono text-amber-300">
                {regMetrics.euSumPartialNgL} ng/L ({regMetrics.euAnalytesCovered}/{regMetrics.euAnalytesRequired})
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              Instantaneous screen only. EPA compliance uses running annual averages of quarterly lab samples; the EU
              Sum of PFAS needs all 20 analytes.
            </p>
          </div>

          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="font-mono text-[11px] text-amber-400 uppercase font-bold">2. Media service</div>
            <div className="flex justify-between">
              <span className="text-slate-400">State:</span>
              <span className="font-mono text-white">
                {situation.rotated ? 'Rotated, service scheduled' : `Lead vessel in service (${decision.action})`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Service lead time:</span>
              <span className="font-mono text-white">{SERVICE_LEAD_TIME_DAYS} d (assumption)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">MitiGATOR™:</span>
              <span className="font-mono text-cyan-300">
                {mitigatorDispatched ? 'Dispatched (demo)' : decision.mitigatorRecommended ? 'Recommended' : 'Standby'}
              </span>
            </div>
          </div>

          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="font-mono text-[11px] text-emerald-400 uppercase font-bold">3. Modelled impact (assumptions)</div>
            <div className="flex justify-between">
              <span className="text-slate-400">Bed-life extension:</span>
              <span className="font-mono text-emerald-400 font-bold">
                {Math.round(BASE_ECONOMICS.bedLifeExtension * 100)}% (hypothesis; break-even 6%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Media kept in use / vessel:</span>
              <span className="font-mono text-white">~{savedMediaKg.toLocaleString('en-US')} kg per cycle</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Emissions factor:</span>
              <span className="font-mono text-white">{BASE_ECONOMICS.co2PerTonneMedia} tCO₂e / t (reactivated GAC)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit log */}
      <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
            Audit log (who, when, what)
          </h3>
          <span className="text-[11px] font-mono text-slate-400">{auditLog.length} events • newest first</span>
        </div>
        {auditLog.length === 0 ? (
          <p className="text-xs text-slate-400">
            No events yet. Run the EWS decision, try a manual override or a scenario preset; each action is logged with
            actor, time and reason.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">Time (UTC)</th>
                  <th className="py-2 px-2">Day</th>
                  <th className="py-2 px-2">Actor</th>
                  <th className="py-2 px-2">Source</th>
                  <th className="py-2 px-2">Action</th>
                  <th className="py-2 px-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {auditLog.map((e) => (
                  <tr key={e.id}>
                    <td className="py-1.5 px-2 font-mono text-slate-500">{e.id}</td>
                    <td className="py-1.5 px-2 font-mono text-slate-300 whitespace-nowrap">{e.timestampIso.slice(11, 19)}</td>
                    <td className="py-1.5 px-2 font-mono text-slate-300">{e.operatingDay}</td>
                    <td className="py-1.5 px-2 text-slate-300">{e.actor}</td>
                    <td className="py-1.5 px-2 font-mono text-cyan-300">{e.source}</td>
                    <td className="py-1.5 px-2 font-mono font-bold text-white">
                      {e.action === 'BLOCKED' ? (
                        <span className="text-rose-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> BLOCKED
                        </span>
                      ) : e.action === 'ROTATE_LEAD_LAG' ? (
                        <span className="text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> ROTATE
                        </span>
                      ) : (
                        e.action
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-slate-400">{e.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
          <Zap className="w-3 h-3" /> Validation data end at day {LAST_OBSERVATION_DAY} in the Twin Lab; the operational twin used here
          assimilates one mid-bed point every 15 days up to today.
        </p>
      </div>
    </div>
  );
};
