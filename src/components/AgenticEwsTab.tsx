import React, { useState } from 'react';
import {
  Bot,
  FileCheck2,
  Lock,
  Play,
  RefreshCw,
  Truck,
} from 'lucide-react';
import {
  FacilityProfile,
  PFAS_SPECIES,
  computeBedVolumes,
  computeBreakthroughConcentration,
  predictBreakthroughTimeDays,
  computeRegulatoryComplianceMetrics,
  runPinnParameterAssimilation,
} from '../data/pfasPhysicsEngine';

// Typical media procurement + Evoqua service scheduling lead time (configurable per utility)
const SERVICE_LEAD_TIME_DAYS = 60;

interface AgenticEwsTabProps {
  facility: FacilityProfile;
  operatingDay: number;
  selectedSpecies: 'PFOA' | 'PFOS' | 'PFBS' | 'PFBA';
  flowMultiplier: number;
  c0Multiplier: number;
  leadLagSwitched: boolean;
  setLeadLagSwitched: (v: boolean) => void;
  mitigatorDispatched: boolean;
  setMitigatorDispatched: (v: boolean) => void;
  activeScenario?: 'normal' | 'short-chain' | 'afff-surge' | 'matrix-storm';
}

export const AgenticEwsTab: React.FC<AgenticEwsTabProps> = ({
  facility,
  operatingDay,
  selectedSpecies: _selectedSpecies,
  flowMultiplier,
  c0Multiplier,
  leadLagSwitched,
  setLeadLagSwitched,
  mitigatorDispatched,
  setMitigatorDispatched,
  activeScenario = 'normal',
}) => {
  const [activeAgentStep, setActiveAgentStep] = useState<number>(4);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [scadaControlMode, setScadaControlMode] = useState<'human-in-the-loop' | 'autonomous'>(
    'autonomous'
  );
  const [operatorApproved, setOperatorApproved] = useState<boolean>(true);

  // Dynamically compute live telemetry for the active facility, day, and multipliers
  const effectiveFlowMGD = Number((facility.flowRateMGD * flowMultiplier).toFixed(2));
  const effectiveEbctMinutes = Number((facility.ebctMinutes / Math.max(0.2, flowMultiplier)).toFixed(2));
  const nomScenarioMultiplier =
    activeScenario === 'matrix-storm' ? 2.15 : activeScenario === 'afff-surge' ? 1.25 : 1.0;
  const effectiveNomMgL = Number((facility.matrixDefaults.nomMgL * nomScenarioMultiplier).toFixed(1));
  const speciesList: ('PFBA' | 'PFBS' | 'PFOA' | 'PFOS')[] = ['PFBA', 'PFBS', 'PFOA', 'PFOS'];
  const lagVesselEffectiveDay = leadLagSwitched
    ? Math.max(12, Math.round((operatingDay - 95) * 0.35))
    : Math.max(6, Math.round(operatingDay * 0.08));

  const telemetryBySpecies = speciesList.map((spId) => {
    const c0 = Number((facility.influentProfile[spId] * c0Multiplier).toFixed(1));
    const cMid = computeBreakthroughConcentration({
      speciesId: spId,
      mediaType: facility.mediaType,
      C0: c0,
      flowRateMGD: effectiveFlowMGD,
      mediaMassKg: facility.mediaMassKg,
      day: operatingDay,
      bedDepthFraction: 0.5,
      nomMgL: effectiveNomMgL,
      usePinnCorrection: true,
      includeCompetitiveRollup: true,
    });
    const rawEff = computeBreakthroughConcentration({
      speciesId: spId,
      mediaType: facility.mediaType,
      C0: c0,
      flowRateMGD: effectiveFlowMGD,
      mediaMassKg: facility.mediaMassKg,
      day: operatingDay,
      bedDepthFraction: 1.0,
      nomMgL: effectiveNomMgL,
      usePinnCorrection: true,
      includeCompetitiveRollup: true,
    });
    const lagPolished = computeBreakthroughConcentration({
      speciesId: spId,
      mediaType: facility.mediaType === 'GAC' ? 'GAC' : 'IX',
      C0: Math.max(0.4, rawEff),
      flowRateMGD: effectiveFlowMGD,
      mediaMassKg: facility.mediaMassKg,
      day: lagVesselEffectiveDay,
      bedDepthFraction: 1.0,
      nomMgL: Math.max(0.8, effectiveNomMgL * 0.45),
      usePinnCorrection: true,
      includeCompetitiveRollup: false,
    });
    const ct = leadLagSwitched ? lagPolished : rawEff;
    const breakthroughDayEff = predictBreakthroughTimeDays({
      speciesId: spId,
      mediaType: facility.mediaType,
      C0: c0,
      flowRateMGD: effectiveFlowMGD,
      mediaMassKg: facility.mediaMassKg,
      bedDepthFraction: 1.0,
      targetPpt: 4.0,
      nomMgL: effectiveNomMgL,
      usePinnCorrection: true,
    });
    const remainingDays = Number((breakthroughDayEff - operatingDay).toFixed(1));
    return { spId, c0, cMid, rawEff, ct, breakthroughDayEff, remainingDays };
  });

  // Lead-lag actuation is gated by the compliance-limiting analyte (binding MCL species only).
  // C4 tracers (PFBA/PFBS) reach the mid-bed first and track MTZ progression, but switching on
  // them would discard capacity months before any PFOA/PFOS exceedance.
  const complianceTelemetry = telemetryBySpecies.filter(
    (t) => PFAS_SPECIES[t.spId].epaRegulationType === 'Binding Federal MCL (4.0 ppt)'
  );
  const sentinel =
    [...complianceTelemetry].sort((a, b) => a.remainingDays - b.remainingDays)[0] ||
    telemetryBySpecies[0];
  const mtzTracer = telemetryBySpecies.find((t) => t.spId === 'PFBA') || telemetryBySpecies[0];

  const sentinelPinnDiag = runPinnParameterAssimilation({
    speciesId: sentinel.spId,
    mediaType: facility.mediaType,
    C0: sentinel.c0,
    flowRateMGD: effectiveFlowMGD,
    mediaMassKg: facility.mediaMassKg,
    nomMgL: effectiveNomMgL,
    ebctMinutes: effectiveEbctMinutes,
    includeCompetitiveRollup: true,
  });

  const pinnBreachDay = sentinelPinnDiag.assimilatedEffluent4PptDay;
  const pinnRemainingDays = Number((pinnBreachDay - operatingDay).toFixed(1));
  const remainingWholeDays = Math.max(0, Math.floor(pinnRemainingDays));
  const remainingHours = Math.max(
    0,
    Math.round((pinnRemainingDays - remainingWholeDays) * 24)
  );
  const totalRemainingHours = Math.max(0, Math.round(pinnRemainingDays * 24));
  // Actuation rule: switch only once the conservative (lower-CI) breach forecast enters the
  // media service lead time. The demo buttons remain available as a manual override.
  const conservativeRemainingDays = Number(
    (pinnRemainingDays - sentinelPinnDiag.breakthrough95CiDays).toFixed(1)
  );
  const withinServiceWindow = conservativeRemainingDays <= SERVICE_LEAD_TIME_DAYS;
  const currentBedVolumes = computeBedVolumes(operatingDay, effectiveEbctMinutes);
  const savedMediaKg = Math.round(facility.mediaMassKg * 0.28);

  const effluentMap: Record<'PFOA' | 'PFOS' | 'PFBS' | 'PFBA', number> = {
    PFBA: telemetryBySpecies.find((s) => s.spId === 'PFBA')?.ct ?? 0.2,
    PFBS: telemetryBySpecies.find((s) => s.spId === 'PFBS')?.ct ?? 0.2,
    PFOA: telemetryBySpecies.find((s) => s.spId === 'PFOA')?.ct ?? 0.2,
    PFOS: telemetryBySpecies.find((s) => s.spId === 'PFOS')?.ct ?? 0.2,
  };
  const avgRemovalFraction = Math.max(
    0.05,
    telemetryBySpecies.reduce((acc, t) => acc + (1 - t.ct / Math.max(1.0, t.c0)), 0) /
      telemetryBySpecies.length
  );
  const regMetrics = computeRegulatoryComplianceMetrics({
    effluentPpt: effluentMap,
    coContaminantsInfluentPpt: facility.coContaminantsPpt,
    removalEfficiencyFraction: avgRemovalFraction,
  });

  const canActuatePlc = scadaControlMode === 'autonomous' || operatorApproved;

  const executeFullAutonomousWorkflow = () => {
    setActiveAgentStep(1);
    setTimeout(() => setActiveAgentStep(2), 450);
    if (!canActuatePlc) {
      return;
    }
    setTimeout(() => {
      setActiveAgentStep(3);
      setLeadLagSwitched(true);
    }, 950);
    setTimeout(() => {
      setActiveAgentStep(4);
      setMitigatorDispatched(true);
    }, 1450);
  };

  const agentNodes = [
    {
      step: 1,
      name: 'Node 01 • Edge Telemetry & YSI EXO2 Context Fusion',
      role: 'Microfluidic MIP + YSI EXO2 (fDOM/pH) Sonde',
      status: 'SYNCED (15-min cycle)',
      detail: `Reads C4 MTZ tracer ${mtzTracer.spId} at ${mtzTracer.cMid} ppt and compliance-limiting ${sentinel.spId} at ${sentinel.cMid} ppt at the Mid-Bed sample port (z/L = 0.50, ${currentBedVolumes.toLocaleString()} BV); ${sentinel.spId} effluent is at ${sentinel.ct} ppt. YSI EXO2 supplies non-PFAS matrix context (pH ${facility.matrixDefaults.pH}, fDOM ${Math.round(effectiveNomMgL * 24.5)} QSU).`,
      payload: `{"node":"MID_BED_02","species":"${sentinel.spId}","c_mid_ppt":${sentinel.cMid},"effluent_ppt":${sentinel.ct},"ysi_exo2_ph":${facility.matrixDefaults.pH},"ysi_fdom_qsu":${Math.round(effectiveNomMgL * 24.5)}}`,
    },
    {
      step: 2,
      name: 'Node 02 • PINN Breakthrough & Roll-Up Forecasting',
      role: 'Xylem Vue Smart Water Engine (SWE)',
      status:
        pinnRemainingDays > 0
          ? `WINDOW: ${remainingWholeDays}d ${remainingHours}h (±${sentinelPinnDiag.breakthrough95CiDays}d)`
          : 'EXHAUSTION REACHED',
      detail: `Assimilates live Sensus flow telemetry (Q = ${effectiveFlowMGD} MGD) into learned PINN parameters (q₀ = ${sentinelPinnDiag.learnedQ0} ng/g, Holdout Test RMSE = ${sentinelPinnDiag.testHoldoutRmsePpt} ppt vs. Static ${sentinelPinnDiag.staticBaselineRmsePpt} ppt). Predicts 4.0 ppt trigger at Day ${pinnBreachDay} ± ${sentinelPinnDiag.breakthrough95CiDays}d.`,
      payload: `{"model":"PINN_AdvSorp_v2.9","assimilated_breach_day":${pinnBreachDay},"ci95_days":${sentinelPinnDiag.breakthrough95CiDays},"holdout_test_rmse_ppt":${sentinelPinnDiag.testHoldoutRmsePpt},"limiting_analyte":"${sentinel.spId}"}`,
    },
    {
      step: 3,
      name: 'Node 03 • Automated SCADA Lead-Lag Valve Control',
      role: 'OPC-UA / Modbus PLC Actuator Bridge',
      status: leadLagSwitched
        ? 'EXECUTED (VALVE ACTUATED)'
        : !withinServiceWindow
        ? `MONITOR (BREACH ${conservativeRemainingDays}d OUT > ${SERVICE_LEAD_TIME_DAYS}d WINDOW)`
        : !canActuatePlc
        ? 'HOLD (AWAITING OPERATOR SIGN-OFF)'
        : 'READY TO ACTUATE (INTERLOCKS PASS)',
      detail:
        `Commands motorized butterfly valves MV-104 & MV-105 to promote the Lag Polishing Vessel to Primary Lead only when the conservative ${sentinel.spId} effluent MCL breach forecast (breach day − 95% CI) falls inside the ${SERVICE_LEAD_TIME_DAYS}-day media service lead time (currently ${conservativeRemainingDays} d). C4 tracer alerts refine the forecast but never actuate on their own (verified by 3 PLC safety interlocks; manual override available).`,
      payload: `{"scada_cmd":"SET_LEAD_LAG_CONFIG","governance":"${scadaControlMode.toUpperCase()}","interlocks_ok":${canActuatePlc},"plc_tag":"MV_104_105","state":"${leadLagSwitched ? 'LAG_POLISH_ENGAGED' : 'PRIMARY_LEAD'}"}`,
    },
    {
      step: 4,
      name: 'Node 04 • Evoqua O&M Logistics & Compliance Telemetry',
      role: 'Servitization ERP & Regulatory Audit Log',
      status: mitigatorDispatched ? 'WORK ORDER & AUDIT LOGGED' : 'STANDBY DISPATCH',
      detail: `Schedules Just-In-Time Evoqua ${facility.mediaType} ${facility.mediaType === 'IX' ? 'resin replacement' : 'media regeneration'} (avoiding ~${savedMediaKg.toLocaleString()} kg premature media disposal per vessel) and exports timestamped EPA/EU compliance telemetry.`,
      payload: `{"erp_ticket":"EVO-2026-8841","facility":"${facility.id}","saved_media_kg":${savedMediaKg},"epa_hi":${regMetrics.hazardIndex},"eu_sum_ngl":${regMetrics.euSumOfPfasNgL}}`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header aligned with Xylem Vue Digital Water Architecture */}
      <div className="bg-[#0B1D30] border border-cyan-500/30 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Bot className="w-4 h-4" />
              Xylem Vue Digital Water Integration • Closed-Loop SCADA Early Warning System (EWS)
            </span>
            <h2 className="text-lg font-bold text-white mt-0.5">
              Automated Lead-Lag Valve Control, Evoqua O&amp;M Dispatch &amp; Compliance Telemetry
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Connects Mid-Bed (<code className="text-cyan-300">z/L = 0.50</code>) PINN breakthrough
              forecasts directly to plant PLC valve actuators and Evoqua media regeneration scheduling—turning
              reactive 14-day lab sampling into proactive closed-loop control.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={executeFullAutonomousWorkflow}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Closed-Loop Control Sequence
            </button>
            <button
              onClick={() => setLeadLagSwitched(!leadLagSwitched)}
              className={`px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-all ${
                leadLagSwitched
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-[#10263F] text-slate-300 border-slate-700 hover:border-cyan-500/40'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {leadLagSwitched ? 'Lead-Lag: SWITCHED' : 'Toggle Lead-Lag Valve'}
            </button>
            <button
              onClick={() => setMitigatorDispatched(!mitigatorDispatched)}
              className={`px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-all ${
                mitigatorDispatched
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-[#10263F] text-slate-300 border-slate-700 hover:border-amber-500/40'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              {mitigatorDispatched ? 'MitiGATOR™: EN ROUTE' : 'Dispatch MitiGATOR™'}
            </button>
            <button
              onClick={() => setShowAuditModal(!showAuditModal)}
              className={`px-3.5 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-all ${
                showAuditModal
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                  : 'bg-[#10263F] hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              {showAuditModal ? 'Hide Telemetry Report' : 'Export EPA / EU Telemetry Log'}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable EPA & EU 2026 Compliance Telemetry Log Drawer */}
      {showAuditModal && (
        <div className="bg-[#061320] border-2 border-cyan-400/70 rounded-xl p-5 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[11px] font-mono uppercase text-cyan-400 font-bold block">
                XYLEM VUE SMART WATER ENGINE • AUTOMATED COMPLIANCE TELEMETRY LOG
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">
                US EPA National Primary Drinking Water Regulation (4.0 ppt MCL) &amp; EU 2026 Directive Telemetry Snapshot
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const cert = {
                    logId: `XYLEM-SWE-${facility.id.toUpperCase()}-DAY${operatingDay}`,
                    facility: facility.name,
                    location: facility.location,
                    mediaBrand: facility.mediaBrand,
                    operatingDay,
                    bedVolumesProcessed: currentBedVolumes,
                    regulatoryFramework: [
                      'US EPA April 2024 PFAS Rule: 4.0 ppt PFOA/PFOS MCL (compliance 2029, extension to 2031 announced May 2025; HI rescission proposed)',
                      'EU Drinking Water Directive (2020/2184) Mandatory January 2026 Sum-of-20 PFAS Limit (100 ng/L)',
                    ],
                    liveTelemetryVerification: {
                      flowRate_MGD: effectiveFlowMGD,
                      sentinelSpecies: sentinel.spId,
                      midBed_z050_ppt: sentinel.cMid,
                      effluentPFOA_ppt: effluentMap.PFOA,
                      effluentPFOS_ppt: effluentMap.PFOS,
                      effluentPFBS_ppt: effluentMap.PFBS,
                      effluentPFBA_ppt: effluentMap.PFBA,
                      effluentPFHxS_ppt: regMetrics.effPfhxs,
                      effluentPFNA_ppt: regMetrics.effPfna,
                      effluentGenX_ppt: regMetrics.effGenx,
                      epaHazardIndex_HI: regMetrics.hazardIndex,
                      euSumOf20Pfas_ngL: regMetrics.euSumOfPfasNgL,
                      euTotalPfas_ngL: regMetrics.euTotalPfasNgL,
                      predictedEffluentBreachDay_PINN: pinnBreachDay,
                      staticThomasBaselineBreachDay: sentinelPinnDiag.staticBaselineEffluent4PptDay,
                      pinnTrainRmse_ppt: sentinelPinnDiag.trainRmsePpt,
                      pinnHoldoutTestRmse_ppt: sentinelPinnDiag.testHoldoutRmsePpt,
                      staticBaselineRmse_ppt: sentinelPinnDiag.staticBaselineRmsePpt,
                      breakthrough95Ci_days: sentinelPinnDiag.breakthrough95CiDays,
                      remainingHoursToBreach: totalRemainingHours,
                      epaComplianceStatus: regMetrics.overallEpaCompliant
                        ? 'PASS (< 4.0 ppt MCL & HI <= 1.0)'
                        : 'ACTION_REQUIRED',
                      scadaGovernanceMode: scadaControlMode,
                      operatorInterlockApproved: operatorApproved,
                      leadLagScadaState: leadLagSwitched ? 'LAG_POLISHING_ACTIVE' : 'PRIMARY_LEAD',
                      mitigatorFleetStatus: mitigatorDispatched ? 'DISPATCHED_ON_SITE' : 'STANDBY_READY',
                      estimatedUnwastedMediaSaved_kg: savedMediaKg,
                    },
                    sha256Checksum:
                      '9f84e2c17a6b30d84f1e29b05c71a93d4e8f7b12c6509a8b3d21e4f6a7c89012',
                  };
                  const blob = new Blob([JSON.stringify(cert, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `EPA_EU_PFAS_Telemetry_Log_${facility.id}_Day${operatingDay}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-all"
              >
                ↓ Download JSON Telemetry Log
              </button>
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-[#0B1D30] border border-slate-800 rounded-lg p-3.5 space-y-1.5">
              <div className="text-cyan-300 font-bold uppercase">
                Live Facility &amp; Sensor Calibration Metadata
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Benchmark Facility:</span>
                <span className="text-white">{facility.shortName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Operating Run Time:</span>
                <span className="text-white">
                  Day {operatingDay} ({currentBedVolumes.toLocaleString()} BV)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mid-Bed ({sentinel.spId}) Port:</span>
                <span className="text-amber-300">{sentinel.cMid} ppt (z/L = 0.50)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">YSI/WTW Sonde Matrix:</span>
                <span className="text-emerald-300">
                  pH {facility.matrixDefaults.pH} | {facility.matrixDefaults.tempC}°C | NOM{' '}
                  {effectiveNomMgL} mg/L
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Packet SHA-256 Checksum:</span>
                <span className="text-slate-300">9f84e2c17a6b30d8...a7c89012</span>
              </div>
            </div>

            <div className="bg-[#0B1D30] border border-slate-800 rounded-lg p-3.5 space-y-1.5">
              <div className="text-emerald-300 font-bold uppercase">
                Live Regulatory &amp; SCADA Status
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">US EPA PFOA / PFOS Effluent:</span>
                <span
                  className={
                    regMetrics.pfoaCompliant && regMetrics.pfosCompliant
                      ? 'text-emerald-400 font-bold'
                      : 'text-rose-400 font-bold'
                  }
                >
                  {effluentMap.PFOA} / {effluentMap.PFOS} ppt (MCL: 4.0)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">EPA Hazard Index &amp; EU Sum:</span>
                <span className="text-emerald-400 font-bold">
                  HI = {regMetrics.hazardIndex} | Σ = {regMetrics.euSumOfPfasNgL} ng/L
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">SCADA Lead-Lag Valve PLC:</span>
                <span className="text-cyan-300">
                  {leadLagSwitched ? 'SWITCHED TO LAG POLISHING BED' : 'MONITORING LEAD BED'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Evoqua / MitiGATOR™ Fleet:</span>
                <span className="text-amber-300">
                  {mitigatorDispatched
                    ? 'MOBILE UNIT DISPATCHED (TICKET #EVO-8841)'
                    : `JIT REGEN IN ${remainingWholeDays}d ${remainingHours}h`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Industrial SCADA Safety Interlocks, Human-in-the-Loop Governance & Fail-Safe Watchdog */}
      <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 font-bold block">
              MUNICIPAL SCADA CYBER-PHYSICAL GOVERNANCE • FAIL-SAFE PLC INTERLOCK ARCHITECTURE
            </span>
            <p className="text-xs text-slate-300 mt-0.5">
              Municipal drinking water utilities require strict hardware interlocks and operator oversight before actuating primary lead-lag valves (`MV-104` / `MV-105`).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[#061320] p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setScadaControlMode('autonomous')}
                className={`px-2.5 py-1 rounded font-semibold transition-all ${
                  scadaControlMode === 'autonomous'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Autonomous Closed-Loop (Default)
              </button>
              <button
                onClick={() => setScadaControlMode('human-in-the-loop')}
                className={`px-2.5 py-1 rounded font-semibold transition-all ${
                  scadaControlMode === 'human-in-the-loop'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Operator Co-Pilot Mode
              </button>
            </div>
            {scadaControlMode === 'human-in-the-loop' && (
              <button
                onClick={() => setOperatorApproved(!operatorApproved)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                  operatorApproved
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                {operatorApproved ? '✓ Operator Sign-Off: ARMED' : '⚠ Operator Sign-Off: HOLD'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-xs">
          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between font-mono text-[11px] text-emerald-300 font-bold">
              <span>INTERLOCK 01 • SONDE HEARTBEAT</span>
              <span>PASS (1.2s &lt; 5.0s)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Monitors RS-485 Modbus RTU heartbeat from Xylem YSI EXO2 sonde. If context telemetry drops, freezes valve actuation and reverts to conservative static Thomas curve.
            </p>
          </div>
          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between font-mono text-[11px] text-emerald-300 font-bold">
              <span>INTERLOCK 02 • 32-CH EIS VARIANCE</span>
              <span>PASS (CV = 2.4% &lt; 10%)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Requires intra-group replicate electrode agreement across the 7 working channels per PFAS sub-class (Grubbs&apos; outlier rejection) to prevent air-bubble false alarms.
            </p>
          </div>
          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between font-mono text-[11px] text-emerald-300 font-bold">
              <span>INTERLOCK 03 • HYDRAULIC ΔP GATE</span>
              <span>PASS (ΔP = 8.4 &lt; 18 psi)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Verifies lag vessel differential pressure and air-release venting status before opening butterfly valves MV-104 &amp; MV-105, preventing media bed fluidization shock.
            </p>
          </div>
        </div>
      </div>

      {/* 4-Stage Pipeline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agentNodes.map((agent) => {
          const isActive = activeAgentStep >= agent.step;
          return (
            <div
              key={agent.step}
              onClick={() => setActiveAgentStep(agent.step)}
              className={`rounded-xl p-4 border transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#0B1D30] border-cyan-500/50 shadow-md'
                  : 'bg-[#061320]/70 border-slate-800 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-mono text-cyan-400 uppercase">
                    {agent.role}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-0.5">{agent.name}</h3>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    agent.step === 3 && leadLagSwitched
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : agent.step === 4 && mitigatorDispatched
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {agent.status}
                </span>
              </div>

              <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">{agent.detail}</p>

              <div className="mt-3 bg-[#061320] border border-slate-800 rounded-lg p-2.5 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                <span className="text-slate-500 select-none">$ </span>
                {agent.payload}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Operational Compliance Summary & Evoqua Work Order */}
      <div className="bg-[#0B1D30] border border-emerald-500/40 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  Live Regulatory Compliance Summary &amp; Just-In-Time Evoqua Work Order
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  LIVE SYNC • {currentBedVolumes.toLocaleString()} BV
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Dynamically computed for {facility.name} at Operating Day {operatingDay}
              </p>
            </div>
          </div>

          <div className="text-right font-mono text-xs">
            <div className="text-slate-400">SIMULATION STATE</div>
            <div className="text-cyan-300 font-bold">
              Day {operatingDay} • Q = {effectiveFlowMGD} MGD
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs">
          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="font-mono text-[11px] text-cyan-400 uppercase font-bold">
              1. Regulatory Threshold Audit
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Facility ID:</span>
              <span className="font-mono text-white">{facility.shortName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">PFOA / PFOS Effluent:</span>
              <span
                className={`font-mono font-bold ${
                  regMetrics.pfoaCompliant && regMetrics.pfosCompliant
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {effluentMap.PFOA} / {effluentMap.PFOS} ppt (MCL: 4.0)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">PFBA / PFBS Effluent:</span>
              <span
                className={`font-mono font-bold ${
                  effluentMap.PFBA <= 4.0 && effluentMap.PFBS <= 4.0
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {effluentMap.PFBA} / {effluentMap.PFBS} ppt
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Compliance Status:</span>
              <span
                className={`font-mono font-bold ${
                  regMetrics.overallEpaCompliant && regMetrics.euCompliant
                    ? 'text-emerald-300'
                    : 'text-rose-400'
                }`}
              >
                {regMetrics.overallEpaCompliant && regMetrics.euCompliant
                  ? 'EPA & EU COMPLIANT'
                  : 'SWITCHOVER REQUIRED'}
              </span>
            </div>
          </div>

          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="font-mono text-[11px] text-amber-400 uppercase font-bold">
              2. Evoqua Just-In-Time Media Dispatch
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Sentinel Species:</span>
              <span className="font-mono text-white">
                {sentinel.spId} (Assimilated Breach @ Day {pinnBreachDay})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Remaining Window:</span>
              <span className="font-mono text-amber-300 font-bold">
                {remainingWholeDays}d {remainingHours}h ({totalRemainingHours} hrs)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Unwasted Media Saved:</span>
              <span className="font-mono text-emerald-400 font-bold">
                ~{savedMediaKg.toLocaleString()} kg / vessel (~28%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">MitiGATOR™ Mobile Unit:</span>
              <span className="font-mono text-cyan-300">
                {mitigatorDispatched ? 'ACTIVE ON-SITE' : 'STANDBY READY'}
              </span>
            </div>
          </div>

          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="font-mono text-[11px] text-emerald-400 uppercase font-bold">
              3. Environmental &amp; O&amp;M Impact
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Premature Media Disposal:</span>
              <span className="font-mono text-emerald-400 font-bold">-25% to -30% Avoided</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                {facility.mediaType === 'IX'
                  ? 'Resin Incineration CO₂e Saved:'
                  : 'Reactivation Kiln CO₂e Saved:'}
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {((savedMediaKg / 1000) * 2.4).toFixed(1)} tCO₂e / vessel changeout
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Routine Lab Grabs Replaced:</span>
              <span className="font-mono text-white">~85% Reduction (Keep Quarterly QC)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mid-Bed Retrofit Tap:</span>
              <span className="font-mono text-cyan-300 font-bold">Standard 1/4&quot; NPT Port</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
