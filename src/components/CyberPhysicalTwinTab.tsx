import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Droplets,
  FastForward,
  Gauge,
  Layers,
  Play,
  Pause,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Truck,
  Waves,
  Zap,
} from 'lucide-react';
import {
  FacilityProfile,
  PFAS_SPECIES,
  computeBedVolumes,
  computeBreakthroughConcentration,
  predictBreakthroughTimeDays,
  computeRegulatoryComplianceMetrics,
} from '../data/pfasPhysicsEngine';

interface CyberPhysicalTwinTabProps {
  facility: FacilityProfile;
  operatingDay: number;
  setOperatingDay: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  selectedSpecies: 'PFOA' | 'PFOS' | 'PFBS' | 'PFBA';
  setSelectedSpecies: (s: 'PFOA' | 'PFOS' | 'PFBS' | 'PFBA') => void;
  flowMultiplier: number;
  setFlowMultiplier: (v: number) => void;
  c0Multiplier: number;
  setC0Multiplier: (v: number) => void;
  leadLagSwitched: boolean;
  setLeadLagSwitched: (v: boolean) => void;
  mitigatorDispatched: boolean;
  setMitigatorDispatched: (v: boolean) => void;
  onTriggerScenario: (scenario: 'normal' | 'short-chain' | 'afff-surge' | 'matrix-storm') => void;
  activeScenario: 'normal' | 'short-chain' | 'afff-surge' | 'matrix-storm';
}

export const CyberPhysicalTwinTab: React.FC<CyberPhysicalTwinTabProps> = ({
  facility,
  operatingDay,
  setOperatingDay,
  isPlaying,
  setIsPlaying,
  selectedSpecies,
  setSelectedSpecies,
  flowMultiplier,
  setFlowMultiplier,
  c0Multiplier,
  setC0Multiplier,
  leadLagSwitched,
  setLeadLagSwitched,
  mitigatorDispatched,
  setMitigatorDispatched,
  onTriggerScenario,
  activeScenario,
}) => {
  const effectiveFlowMGD = Number((facility.flowRateMGD * flowMultiplier).toFixed(2));
  const speciesList: ('PFBA' | 'PFBS' | 'PFOA' | 'PFOS')[] = ['PFBA', 'PFBS', 'PFOA', 'PFOS'];

  // Dynamic Lag Vessel run-time when promoted to Primary Polishing mode
  const lagVesselEffectiveDay = leadLagSwitched
    ? Math.max(12, Math.round((operatingDay - 95) * 0.35))
    : Math.max(6, Math.round(operatingDay * 0.08));

  // Calculate concentrations across all 4 PFAS species at Influent (C0), Mid-Bed (C_mid, z/L=0.5), and Effluent (C_t, z/L=1.0)
  const speciesTelemetry = speciesList.map((spId) => {
    const c0 = Number((facility.influentProfile[spId] * c0Multiplier).toFixed(1));
    const effectiveDayForLead = operatingDay;

    const cMid = computeBreakthroughConcentration({
      speciesId: spId,
      mediaType: facility.mediaType,
      C0: c0,
      flowRateMGD: effectiveFlowMGD,
      mediaMassKg: facility.mediaMassKg,
      day: effectiveDayForLead,
      bedDepthFraction: 0.5,
      nomMgL: facility.matrixDefaults.nomMgL,
      usePinnCorrection: true,
      includeCompetitiveRollup: true,
    });

    const rawEffluent = computeBreakthroughConcentration({
      speciesId: spId,
      mediaType: facility.mediaType,
      C0: c0,
      flowRateMGD: effectiveFlowMGD,
      mediaMassKg: facility.mediaMassKg,
      day: effectiveDayForLead,
      bedDepthFraction: 1.0,
      nomMgL: facility.matrixDefaults.nomMgL,
      usePinnCorrection: true,
      includeCompetitiveRollup: true,
    });

    // Dynamic Lag Vessel kinetic computation (instead of static multiplier)
    const lagPolishedEffluent = computeBreakthroughConcentration({
      speciesId: spId,
      mediaType: facility.mediaType === 'GAC' ? 'GAC' : 'IX',
      C0: Math.max(4.5, rawEffluent),
      flowRateMGD: effectiveFlowMGD,
      mediaMassKg: facility.mediaMassKg,
      day: lagVesselEffectiveDay,
      bedDepthFraction: 1.0,
      nomMgL: Math.max(0.8, facility.matrixDefaults.nomMgL * 0.45),
      usePinnCorrection: true,
      includeCompetitiveRollup: false,
    });

    const ct = leadLagSwitched ? lagPolishedEffluent : rawEffluent;
    const isRollupActive = !leadLagSwitched && rawEffluent > c0 * 1.01;

    const breakthroughDayEffluent = predictBreakthroughTimeDays({
      speciesId: spId,
      mediaType: facility.mediaType,
      C0: c0,
      flowRateMGD: effectiveFlowMGD,
      mediaMassKg: facility.mediaMassKg,
      bedDepthFraction: 1.0,
      targetPpt: 4.0,
      nomMgL: facility.matrixDefaults.nomMgL,
      usePinnCorrection: true,
    });

    const breakthroughDayMidBed = predictBreakthroughTimeDays({
      speciesId: spId,
      mediaType: facility.mediaType,
      C0: c0,
      flowRateMGD: effectiveFlowMGD,
      mediaMassKg: facility.mediaMassKg,
      bedDepthFraction: 0.5,
      targetPpt: 4.0,
      nomMgL: facility.matrixDefaults.nomMgL,
      usePinnCorrection: true,
    });

    const remainingDays = Number((breakthroughDayEffluent - operatingDay).toFixed(1));

    return {
      species: PFAS_SPECIES[spId],
      c0,
      cMid,
      rawEffluent,
      ct,
      isRollupActive,
      breakthroughDayEffluent,
      breakthroughDayMidBed,
      remainingDays,
    };
  });

  const activeTelemetry =
    speciesTelemetry.find((t) => t.species.id === selectedSpecies) || speciesTelemetry[0];

  // Earliest breaking species (typically PFBA or PFBS on GAC)
  const criticalTelemetry = [...speciesTelemetry].sort(
    (a, b) => a.remainingDays - b.remainingDays
  )[0];

  const isMidBedWarning = criticalTelemetry.cMid >= 3.0;
  const isEffluentBreachRisk = criticalTelemetry.rawEffluent >= 3.5;

  // Build effluent map for EPA Hazard Index & EU 2026 Sum-of-20 calculation
  const effluentMap: Record<'PFOA' | 'PFOS' | 'PFBS' | 'PFBA', number> = {
    PFBA: speciesTelemetry.find((s) => s.species.id === 'PFBA')?.ct ?? 0.2,
    PFBS: speciesTelemetry.find((s) => s.species.id === 'PFBS')?.ct ?? 0.2,
    PFOA: speciesTelemetry.find((s) => s.species.id === 'PFOA')?.ct ?? 0.2,
    PFOS: speciesTelemetry.find((s) => s.species.id === 'PFOS')?.ct ?? 0.2,
  };
  const avgRemovalFraction = Math.max(
    0.05,
    1 - activeTelemetry.ct / Math.max(1.0, activeTelemetry.c0)
  );
  const regMetrics = computeRegulatoryComplianceMetrics({
    effluentPpt: effluentMap,
    coContaminantsInfluentPpt: facility.coContaminantsPpt,
    removalEfficiencyFraction: avgRemovalFraction,
  });

  // Calculate saturation profile along Lead Vessel depth (15%, 35%, 50%, 75%, 100%)
  const depthSlices = [0.15, 0.35, 0.5, 0.75, 1.0].map((z) => {
    const conc = computeBreakthroughConcentration({
      speciesId: selectedSpecies,
      mediaType: facility.mediaType,
      C0: activeTelemetry.c0,
      flowRateMGD: effectiveFlowMGD,
      mediaMassKg: facility.mediaMassKg,
      day: operatingDay,
      bedDepthFraction: z,
      nomMgL: facility.matrixDefaults.nomMgL,
      usePinnCorrection: true,
      includeCompetitiveRollup: true,
    });
    const satPct = Math.min(135, Math.round((conc / activeTelemetry.c0) * 100));
    return { z, conc, satPct };
  });

  // Dynamic Lag Vessel saturation slices (z = 25%, 60%, 100%)
  const lagSlices = [0.25, 0.6, 1.0].map((z) => {
    const conc = computeBreakthroughConcentration({
      speciesId: selectedSpecies,
      mediaType: facility.mediaType === 'GAC' ? 'GAC' : 'IX',
      C0: Math.max(6.0, activeTelemetry.rawEffluent),
      flowRateMGD: effectiveFlowMGD,
      mediaMassKg: facility.mediaMassKg,
      day: lagVesselEffectiveDay,
      bedDepthFraction: z,
      nomMgL: Math.max(0.8, facility.matrixDefaults.nomMgL * 0.45),
      usePinnCorrection: true,
      includeCompetitiveRollup: false,
    });
    const satPct = Math.min(
      100,
      Math.max(3, Math.round((conc / Math.max(6.0, activeTelemetry.c0)) * 100))
    );
    return { z, conc, satPct };
  });

  const remainingWholeDays = Math.max(0, Math.floor(criticalTelemetry.remainingDays));
  const remainingHours = Math.max(
    0,
    Math.round((criticalTelemetry.remainingDays - remainingWholeDays) * 24)
  );

  return (
    <div className="space-y-6">
      {/* Top Scenario & Simulation Control Bar */}
      <div className="bg-[#0B1D30] border border-cyan-500/30 rounded-xl p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md text-xs font-mono uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Interactive Judge Sandbox
            </span>
            <span className="text-sm text-slate-300 font-medium">
              Inject Real-World Field Scenarios:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onTriggerScenario('normal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                activeScenario === 'normal'
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                  : 'bg-[#10263F] text-slate-300 border-slate-700 hover:border-cyan-500/50'
              }`}
            >
              1. Baseline Operation (Day 118)
            </button>
            <button
              onClick={() => onTriggerScenario('short-chain')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                activeScenario === 'short-chain'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-[#10263F] text-amber-300 border-amber-500/30 hover:border-amber-400'
              }`}
            >
              2. Short-Chain PFBA/PFBS Mid-Bed Alert (Day 148)
            </button>
            <button
              onClick={() => onTriggerScenario('afff-surge')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                activeScenario === 'afff-surge'
                  ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/20'
                  : 'bg-[#10263F] text-rose-300 border-rose-500/30 hover:border-rose-400'
              }`}
            >
              3. Emergency AFFF Plume Surge + MitiGATOR™ Dispatch
            </button>
            <button
              onClick={() => onTriggerScenario('matrix-storm')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                activeScenario === 'matrix-storm'
                  ? 'bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-500/20'
                  : 'bg-[#10263F] text-purple-300 border-purple-500/30 hover:border-purple-400'
              }`}
            >
              4. High-NOM Storm Matrix Drift
            </button>
          </div>
        </div>

        {/* Time, Flow Q & Influent C0 Sliders */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-4 flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold text-xs transition-all shrink-0 ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? 'Pause Twin' : 'Simulate Time'}
            </button>
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Bed Run Time (t / BV):</span>
                <span className="font-mono font-bold text-cyan-300">
                  Day {operatingDay} ({computeBedVolumes(operatingDay, facility.ebctMinutes).toLocaleString()} BV)
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={220}
                value={operatingDay}
                onChange={(e) => setOperatingDay(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Sensus/MJK Flow (Q):</span>
              <span className="font-mono font-bold text-cyan-300">{effectiveFlowMGD} MGD</span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.8}
              step={0.05}
              value={flowMultiplier}
              onChange={(e) => setFlowMultiplier(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          <div className="md:col-span-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Influent PFAS Load (C₀):</span>
              <span className="font-mono font-bold text-amber-300">
                {activeTelemetry.c0} ppt ({Math.round(c0Multiplier * 100)}%)
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.05}
              value={c0Multiplier}
              onChange={(e) => setC0Multiplier(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          <div className="md:col-span-3 flex items-center justify-end gap-2">
            <button
              onClick={() => setLeadLagSwitched(!leadLagSwitched)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                leadLagSwitched
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-cyan-500/40'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${leadLagSwitched ? 'animate-spin' : ''}`} />
              {leadLagSwitched ? 'SCADA Lead-Lag: POLISHING ACTIVE' : 'Actuate SCADA Lead-Lag Switch'}
            </button>
          </div>
        </div>
      </div>

      {/* 4 Primary Real-Time KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Influent C0 */}
        <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Node 01 • Influent (C<sub>0</sub>)
              </p>
              <h3 className="text-2xl font-bold font-mono text-white mt-1">
                {activeTelemetry.c0} <span className="text-sm font-normal text-slate-400">ppt</span>
              </h3>
            </div>
            <span
              className="px-2 py-0.5 rounded text-xs font-mono font-semibold"
              style={{
                backgroundColor: `${activeTelemetry.species.color}20`,
                color: activeTelemetry.species.color,
                border: `1px solid ${activeTelemetry.species.color}50`,
              }}
            >
              {activeTelemetry.species.name} ({activeTelemetry.species.chainType.split(' ')[0]})
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>YSI pH: {facility.matrixDefaults.pH}</span>
            <span>NOM: {facility.matrixDefaults.nomMgL} mg/L</span>
            <span className="text-cyan-400 font-mono">Q: {effectiveFlowMGD} MGD</span>
          </div>
        </div>

        {/* Card 2: Mid-Bed Early Warning C_mid */}
        <div
          className={`rounded-xl p-4 border relative overflow-hidden transition-all ${
            isMidBedWarning
              ? 'bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-500/10'
              : 'bg-[#0B1D30] border-slate-800'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-amber-300 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                Node 02 • Mid-Bed (C<sub>mid</sub>)
              </p>
              <h3 className="text-2xl font-bold font-mono text-white mt-1">
                {activeTelemetry.cMid}{' '}
                <span className="text-sm font-normal text-slate-400">ppt</span>
              </h3>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                isMidBedWarning
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {isMidBedWarning ? 'MTZ FRONT DETECTED' : 'BED HEALTHY'}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">1/4&quot; NPT Port: z/L = 0.50</span>
            <span className="text-amber-300 font-mono">
              {Math.round((activeTelemetry.cMid / activeTelemetry.c0) * 100)}% Saturation
            </span>
          </div>
        </div>

        {/* Card 3: Effluent C_t Compliance */}
        <div
          className={`rounded-xl p-4 border relative overflow-hidden transition-all ${
            activeTelemetry.ct >= 4.0
              ? 'bg-rose-950/40 border-rose-500/70 shadow-lg shadow-rose-500/15'
              : 'bg-[#0B1D30] border-emerald-500/30'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Node 03 • Effluent (C<sub>t</sub>)
              </p>
              <h3 className="text-2xl font-bold font-mono text-white mt-1">
                {activeTelemetry.ct} <span className="text-sm font-normal text-slate-400">ppt</span>
              </h3>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono font-semibold flex items-center gap-1 ${
                activeTelemetry.isRollupActive
                  ? 'bg-rose-500/30 text-rose-200 border border-rose-400 animate-pulse'
                  : activeTelemetry.ct >= 4.0
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {activeTelemetry.isRollupActive ? (
                <>
                  <AlertTriangle className="w-3 h-3" /> C4 ROLL-UP (&gt;C₀)
                </>
              ) : activeTelemetry.ct >= 4.0 ? (
                <>
                  <AlertTriangle className="w-3 h-3" /> TRIGGER EXCEEDED
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3" /> &lt; 4.0 ppt TARGET
                </>
              )}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 truncate max-w-[145px]" title={activeTelemetry.species.epaRegulationType}>
              {activeTelemetry.species.id === 'PFOA' || activeTelemetry.species.id === 'PFOS'
                ? 'EPA Binding MCL: 4.0 ppt'
                : activeTelemetry.species.id === 'PFBS'
                ? `EPA HI: ${regMetrics.hazardIndex} (≤1.0)`
                : 'UCMR5 Sentinel Tracer'}
            </span>
            <span className="text-emerald-400 font-mono">
              {activeTelemetry.isRollupActive
                ? `Roll-Up: ${Math.round((activeTelemetry.ct / activeTelemetry.c0) * 100)}% C₀`
                : `Removal: ${(((activeTelemetry.c0 - activeTelemetry.ct) / activeTelemetry.c0) * 100).toFixed(1)}%`}
            </span>
          </div>
        </div>

        {/* Card 4: PINN Countdown to Breakthrough */}
        <div className="bg-[#0B1D30] border border-cyan-500/30 rounded-xl p-4 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-cyan-300">
                PINN Breakthrough Window
              </p>
              <h3 className="text-2xl font-bold font-mono text-white mt-1">
                {criticalTelemetry.remainingDays > 0 ? (
                  <>
                    {remainingWholeDays}d {remainingHours}h
                  </>
                ) : leadLagSwitched ? (
                  <span className="text-emerald-400 text-lg">LAG VESSEL ACTIVE</span>
                ) : (
                  <span className="text-rose-400 text-lg">BREAKTHROUGH NOW</span>
                )}
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              Sentinel: {criticalTelemetry.species.name}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Exhaustion: Day {criticalTelemetry.breakthroughDayEffluent} (
              {computeBedVolumes(criticalTelemetry.breakthroughDayEffluent, facility.ebctMinutes).toLocaleString()} BV)
            </span>
            <span className="text-cyan-300 font-mono">PINN PDE Twin</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Cyber-Physical Architecture & Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Columns: Interactive Cyber-Physical Plant Schematic */}
        <div className="lg:col-span-8 bg-[#0B1D30] border border-slate-800 rounded-xl p-5 scada-grid relative">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h2 className="text-base font-bold text-white tracking-tight">
                  Xylem Vue powered by GoAigua — Cyber-Physical Treatment Train Digital Twin
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {facility.name} • {facility.mediaBrand}
              </p>
            </div>

            {/* Species Selector Pills */}
            <div className="flex items-center gap-1.5 bg-[#061320] p-1 rounded-lg border border-slate-800">
              {speciesList.map((sp) => (
                <button
                  key={sp}
                  onClick={() => setSelectedSpecies(sp)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-all ${
                    selectedSpecies === sp
                      ? 'bg-cyan-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive SVG Process Flow Diagram (PFD) */}
          <div className="w-full overflow-x-auto bg-[#061320]/90 border border-slate-800/90 rounded-xl p-3">
            <svg
              viewBox="0 0 880 390"
              className="w-full h-auto min-w-[680px] select-none"
              aria-label="PFAS-Sentinel Cyber-Physical Process Flow Schematic"
            >
              <defs>
                <linearGradient id="vesselGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0f2942" />
                  <stop offset="50%" stopColor="#163a5c" />
                  <stop offset="100%" stopColor="#0b1f33" />
                </linearGradient>
                <linearGradient id="cloudGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#082f49" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
              </defs>

              {/* Top Cloud Box: Xylem Vue Smart Water Engine (SWE) */}
              <rect
                x="180"
                y="10"
                width="520"
                height="78"
                rx="10"
                fill="url(#cloudGrad)"
                stroke="#00B4D8"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <text x="200" y="32" fill="#38BDF8" fontSize="12" fontWeight="700" fontFamily="Inter">
                XYLEM VUE POWERED BY GOAIGUA — SMART WATER ENGINE (SWE)
              </text>
              <text x="200" y="50" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono">
                1. Inverse Edge AI (4 NIP + YSI) → 2. PINN PDE &amp; Roll-Up Twin → 3. Agentic SCADA EWS
              </text>
              <text x="200" y="68" fill="#10B981" fontSize="10" fontFamily="JetBrains Mono">
                Status: {leadLagSwitched ? 'AUTONOMOUS LEAD-LAG BYPASS ENGAGED (EVOQUA REGEN ACTIVE)' : isMidBedWarning ? 'MID-BED BREAKTHROUGH ALERT — PREPARING SWITCHOVER' : 'CONTINUOUS 15-MIN TELEMETRY SYNC (ACTIVE)'}
              </text>

              {/* Telemetry Uplinks (Dashed Vertical Lines from Sensors to Xylem Vue Cloud) */}
              <line
                x1="125"
                y1="190"
                x2="230"
                y2="88"
                stroke="#38BDF8"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              <line
                x1="395"
                y1="225"
                x2="440"
                y2="88"
                stroke="#F59E0B"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <line
                x1="745"
                y1="255"
                x2="640"
                y2="88"
                stroke="#10B981"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />

              {/* Pipe 1: Raw Water Influent to Lead Vessel Top */}
              <path
                d="M 25 220 L 210 220 L 210 135 L 285 135"
                fill="none"
                stroke="#1E3A5F"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 25 220 L 210 220 L 210 135 L 285 135"
                fill="none"
                stroke="#00B4D8"
                strokeWidth="4"
                className="animate-flow"
              />

              {/* Sensus / MJK Flowmeter + YSI / WTW Multiparameter Node */}
              <rect
                x="35"
                y="245"
                width="145"
                height="72"
                rx="8"
                fill="#0B1D30"
                stroke="#38BDF8"
                strokeWidth="1.2"
              />
              <text x="45" y="263" fill="#38BDF8" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono">
                YSI / WTW + SENSUS
              </text>
              <text x="45" y="279" fill="#E2E8F0" fontSize="10" fontFamily="JetBrains Mono">
                Flow Q: {effectiveFlowMGD} MGD
              </text>
              <text x="45" y="294" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono">
                pH {facility.matrixDefaults.pH} | {facility.matrixDefaults.tempC}°C
              </text>
              <text x="45" y="308" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono">
                Cond: {facility.matrixDefaults.conductivityUsCm} μS/cm
              </text>

              {/* Node 1: Influent MIP Sensor Pod (C0) */}
              <circle cx="125" cy="220" r="14" fill="#061320" stroke="#00B4D8" strokeWidth="2.5" />
              <text x="117" y="224" fill="#00B4D8" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono">
                C₀
              </text>
              <rect
                x="78"
                y="152"
                width="96"
                height="42"
                rx="6"
                fill="#0B1D30"
                stroke="#00B4D8"
                strokeWidth="1.2"
              />
              <text x="86" y="168" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono">
                INFLUENT MIP #1
              </text>
              <text x="86" y="185" fill="#F8FAFC" fontSize="11" fontWeight="700" fontFamily="JetBrains Mono">
                {activeTelemetry.c0} ppt
              </text>

              {/* VESSEL 1: LEAD GAC / IX COLUMN */}
              <rect
                x="265"
                y="120"
                width="130"
                height="220"
                rx="22"
                fill="url(#vesselGrad)"
                stroke={leadLagSwitched ? '#F59E0B' : '#38BDF8'}
                strokeWidth="2"
              />
              <text x="276" y="142" fill="#F8FAFC" fontSize="10.5" fontWeight="700" fontFamily="Inter">
                {leadLagSwitched ? 'VESSEL 1 (REGEN HOLD)' : `LEAD VESSEL (${facility.mediaType})`}
              </text>

              {/* Dynamic Mass Transfer Zone (MTZ) Saturation Layers inside Lead Vessel */}
              {depthSlices.map((slice, idx) => {
                const yPos = 152 + idx * 32;
                const barColor =
                  slice.satPct > 100
                    ? '#EC4899'
                    : slice.satPct > 75
                    ? '#EF4444'
                    : slice.satPct > 35
                    ? '#F59E0B'
                    : '#10B981';
                return (
                  <g key={slice.z}>
                    <rect
                      x="277"
                      y={yPos}
                      width="106"
                      height="26"
                      rx="4"
                      fill="#061320"
                      stroke="#1E3A5F"
                      strokeWidth="1"
                    />
                    <rect
                      x="279"
                      y={yPos + 2}
                      width={Math.max(6, (102 * Math.min(100, slice.satPct)) / 100)}
                      height="22"
                      rx="3"
                      fill={barColor}
                      fillOpacity="0.45"
                    />
                    <text
                      x="283"
                      y={yPos + 16}
                      fill="#E2E8F0"
                      fontSize="9"
                      fontFamily="JetBrains Mono"
                    >
                      z={Math.round(slice.z * 100)}%: {slice.conc}p ({slice.satPct}%)
                    </text>
                  </g>
                );
              })}

              {/* Node 2: Mid-Bed MIP Sensor (C_mid at z/L = 0.50) */}
              <circle
                cx="395"
                cy="228"
                r="13"
                fill="#061320"
                stroke={isMidBedWarning ? '#F59E0B' : '#10B981'}
                strokeWidth="2.5"
              />
              <text
                x="384"
                y="232"
                fill={isMidBedWarning ? '#F59E0B' : '#10B981'}
                fontSize="9"
                fontWeight="700"
                fontFamily="JetBrains Mono"
              >
                Cmid
              </text>
              <rect
                x="414"
                y="202"
                width="108"
                height="50"
                rx="6"
                fill="#0B1D30"
                stroke={isMidBedWarning ? '#F59E0B' : '#10B981'}
                strokeWidth="1.5"
              />
              <text x="422" y="218" fill="#F59E0B" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">
                MID-BED MIP #2
              </text>
              <text x="422" y="234" fill="#FFFFFF" fontSize="11" fontWeight="700" fontFamily="JetBrains Mono">
                {activeTelemetry.cMid} ppt
              </text>
              <text x="422" y="246" fill="#94A3B8" fontSize="8.5" fontFamily="JetBrains Mono">
                Early Warning Port
              </text>

              {/* Pipe from Lead Vessel Bottom to SCADA Automated Valve */}
              <path
                d="M 330 340 L 330 365 L 485 365 L 485 135 L 555 135"
                fill="none"
                stroke="#1E3A5F"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 330 340 L 330 365 L 485 365 L 485 135 L 555 135"
                fill="none"
                stroke={isEffluentBreachRisk && !leadLagSwitched ? '#EF4444' : '#38BDF8'}
                strokeWidth="4"
                className="animate-flow"
              />

              {/* SCADA Motorized Lead-Lag Valve Node */}
              <circle
                cx="485"
                cy="300"
                r="16"
                fill="#0B1D30"
                stroke={leadLagSwitched ? '#10B981' : '#38BDF8'}
                strokeWidth="2.5"
              />
              <text x="473" y="304" fill="#E2E8F0" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">
                PLC
              </text>

              {/* VESSEL 2: DYNAMIC LAG POLISHING GAC / IX COLUMN */}
              <rect
                x="555"
                y="120"
                width="130"
                height="220"
                rx="22"
                fill="url(#vesselGrad)"
                stroke={leadLagSwitched ? '#10B981' : '#475569'}
                strokeWidth="2"
              />
              <text x="568" y="142" fill="#F8FAFC" fontSize="10.5" fontWeight="700" fontFamily="Inter">
                {leadLagSwitched ? 'LAG VESSEL (ACTIVE LEAD)' : 'LAG VESSEL (POLISH)'}
              </text>

              {/* Dynamic Saturation Slices inside Lag Polishing Vessel */}
              {lagSlices.map((slice, idx) => {
                const yPos = 156 + idx * 42;
                return (
                  <g key={slice.z}>
                    <rect
                      x="568"
                      y={yPos}
                      width="104"
                      height="32"
                      rx="5"
                      fill="#061320"
                      stroke={leadLagSwitched ? '#10B981' : '#1E3A5F'}
                      strokeWidth="1"
                    />
                    <rect
                      x="570"
                      y={yPos + 2}
                      width={Math.max(6, (100 * slice.satPct) / 100)}
                      height="28"
                      rx="4"
                      fill="#10B981"
                      fillOpacity="0.4"
                    />
                    <text
                      x="575"
                      y={yPos + 14}
                      fill="#10B981"
                      fontSize="8.5"
                      fontWeight="700"
                      fontFamily="JetBrains Mono"
                    >
                      Lag z={Math.round(slice.z * 100)}% (t={lagVesselEffectiveDay}d)
                    </text>
                    <text
                      x="575"
                      y={yPos + 26}
                      fill="#E2E8F0"
                      fontSize="9"
                      fontFamily="JetBrains Mono"
                    >
                      {slice.conc} ppt ({slice.satPct}% Sat)
                    </text>
                  </g>
                );
              })}

              <text x="570" y="302" fill="#38BDF8" fontSize="9" fontFamily="JetBrains Mono">
                {leadLagSwitched ? 'Polishing C4 Roll-Up' : 'Standby Guard Bed'}
              </text>
              <text x="570" y="317" fill="#94A3B8" fontSize="8.5" fontFamily="JetBrains Mono">
                Evoqua JIT Sync: OK
              </text>

              {/* Pipe from Lag Vessel to Effluent Distribution */}
              <path
                d="M 618 340 L 618 365 L 745 365 L 745 280 L 855 280"
                fill="none"
                stroke="#1E3A5F"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 618 340 L 618 365 L 745 365 L 745 280 L 855 280"
                fill="none"
                stroke={activeTelemetry.ct >= 4.0 ? '#EF4444' : '#10B981'}
                strokeWidth="4"
                className="animate-flow"
              />

              {/* Node 3: Effluent MIP Sensor Pod (Ct) */}
              <circle
                cx="745"
                cy="280"
                r="14"
                fill="#061320"
                stroke={activeTelemetry.ct >= 4.0 ? '#EF4444' : '#10B981'}
                strokeWidth="2.5"
              />
              <text
                x="738"
                y="284"
                fill={activeTelemetry.ct >= 4.0 ? '#EF4444' : '#10B981'}
                fontSize="10"
                fontWeight="700"
                fontFamily="JetBrains Mono"
              >
                Cₜ
              </text>

              <rect
                x="705"
                y="195"
                width="145"
                height="58"
                rx="6"
                fill="#0B1D30"
                stroke={activeTelemetry.ct >= 4.0 ? '#EF4444' : '#10B981'}
                strokeWidth="1.5"
              />
              <text x="714" y="212" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono">
                EFFLUENT MIP #3 (EPA)
              </text>
              <text
                x="714"
                y="230"
                fill={activeTelemetry.ct >= 4.0 ? '#EF4444' : '#10B981'}
                fontSize="12"
                fontWeight="700"
                fontFamily="JetBrains Mono"
              >
                {activeTelemetry.ct} ppt (HI: {regMetrics.hazardIndex})
              </text>
              <text x="714" y="244" fill="#E2E8F0" fontSize="8.5" fontFamily="JetBrains Mono">
                {activeTelemetry.ct < 4.0 ? 'EPA 2027/2029 COMPLIANT' : 'ACTION REQUIRED'}
              </text>

              {/* Xylem MitiGATOR Mobile Response Fleet Badge */}
              <rect
                x="705"
                y="118"
                width="155"
                height="62"
                rx="8"
                fill={mitigatorDispatched ? '#1E1B4B' : '#0B1D30'}
                stroke={mitigatorDispatched ? '#F59E0B' : '#334155'}
                strokeWidth="1.5"
              />
              <text x="715" y="136" fill="#F59E0B" fontSize="9.5" fontWeight="700" fontFamily="JetBrains Mono">
                XYLEM MitiGATOR™ FLEET
              </text>
              <text x="715" y="152" fill="#E2E8F0" fontSize="9.5" fontFamily="JetBrains Mono">
                {mitigatorDispatched ? 'DISPATCHED (ETA 42m)' : 'STANDBY / JUST-IN-TIME'}
              </text>
              <text x="715" y="167" fill="#94A3B8" fontSize="8.5" fontFamily="JetBrains Mono">
                Evoqua O&amp;M Logistics Sync
              </text>
            </svg>
          </div>

          {/* Live EPA April 2024 Regulatory Breakdown Bar (MCL vs Hazard Index vs Sentinel Tracer) */}
          <div className="mt-4 pt-3 border-t border-slate-800/90 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-[#061320] border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase block">
                  EPA Binding C8 MCL (PFOA/PFOS)
                </span>
                <span className="font-mono font-bold text-white">
                  {effluentMap.PFOA} / {effluentMap.PFOS} ppt
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                  regMetrics.pfoaCompliant && regMetrics.pfosCompliant
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                Limit: 4.0 ppt
              </span>
            </div>

            <div className="bg-[#061320] border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-purple-400 uppercase block">
                  EPA Hazard Index (PFBS+PFHxS+PFNA+GenX)
                </span>
                <span className="font-mono font-bold text-white">
                  HI = {regMetrics.hazardIndex}
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                  regMetrics.hiCompliant
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                Limit: HI ≤ 1.0
              </span>
            </div>

            <div className="bg-[#061320] border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-amber-400 uppercase block">
                  EU 2026 DWD Sum-of-20 &amp; C4 Sentinel
                </span>
                <span className="font-mono font-bold text-white">
                  Σ = {regMetrics.euSumOfPfasNgL} ng/L
                </span>
              </div>
              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-cyan-500/15 text-cyan-300">
                EU: &lt;100 ng/L
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span>
              <strong className="text-cyan-300">Benchmark Context:</strong> {facility.benchmarkNote}
            </span>
          </div>
        </div>

        {/* Right 4 Columns: Multi-Species Live Matrix & Autonomous Agent Actions */}
        <div className="lg:col-span-4 space-y-4">
          {/* Multi-Species Multiplexed Readout Card */}
          <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                32-Ch Multiplexed PFAS Array
              </h3>
              <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                15-Min Assay
              </span>
            </div>

            <div className="space-y-2.5">
              {speciesTelemetry.map((item) => {
                const isSelected = item.species.id === selectedSpecies;
                return (
                  <div
                    key={item.species.id}
                    onClick={() => setSelectedSpecies(item.species.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#10263F] border-cyan-500/60 shadow-sm'
                        : 'bg-[#061320]/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.species.color }}
                        />
                        <span className="font-mono font-bold text-sm text-white">
                          {item.species.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {item.species.id === 'PFBA'
                            ? 'C4 Sentinel Tracer'
                            : item.species.id === 'PFBS'
                            ? 'C4 Hazard Index'
                            : 'C8 EPA 4ppt MCL'}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${
                          item.isRollupActive
                            ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                            : item.remainingDays <= 14
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.isRollupActive
                          ? 'Roll-Up (>C₀)'
                          : item.remainingDays > 0
                          ? `Breakthrough: ${item.remainingDays}d`
                          : 'Exhausted'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block text-[10px]">INFLUENT C₀</span>
                        <span className="text-slate-200">{item.c0} ppt</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">MID-BED Cmid</span>
                        <span
                          className={
                            item.cMid >= 3.0 ? 'text-amber-400 font-bold' : 'text-slate-200'
                          }
                        >
                          {item.cMid} ppt
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">EFFLUENT Ct</span>
                        <span
                          className={
                            item.ct >= 4.0
                              ? 'text-rose-400 font-bold'
                              : 'text-emerald-400 font-bold'
                          }
                        >
                          {item.ct} ppt
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agentic Early Warning & Logistics Quick Action Box */}
          <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                Xylem Vue Autonomous Agent Status
              </h3>
              <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Agentic EWS
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Municipal {facility.mediaType} vessels already feature physical{' '}
              <strong className="text-cyan-300">mid-bed sample ports (z/L = 0.50)</strong>, but
              utilities currently sample them manually once a month (14-day lab delay). Retrofitting
              PFAS-Sentinel onto the existing mid-bed tap captures short-chain{' '}
              <strong className="text-amber-300">PFBA/PFBS</strong> breakthrough and competitive
              roll-up (<code className="text-rose-300">Cₜ &gt; C₀</code>) in 15 minutes—triggering
              automated Lead-Lag valve switchover weeks before effluent breach.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => setLeadLagSwitched(!leadLagSwitched)}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-between border transition-all ${
                  leadLagSwitched
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-[#10263F] text-cyan-200 border-cyan-500/30 hover:bg-cyan-500/20'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  {leadLagSwitched
                    ? 'SCADA Valve Switched to Lag Polishing Vessel'
                    : 'Trigger Autonomous SCADA Lead-Lag Switch'}
                </span>
                <span className="font-mono text-[11px]">
                  {leadLagSwitched ? 'ACTIVE' : 'EXECUTE'}
                </span>
              </button>

              <button
                onClick={() => setMitigatorDispatched(!mitigatorDispatched)}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-between border transition-all ${
                  mitigatorDispatched
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-[#10263F] text-amber-200 border-amber-500/30 hover:bg-amber-500/20'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  {mitigatorDispatched
                    ? 'Xylem MitiGATOR™ Mobile Unit En Route'
                    : 'Dispatch Xylem MitiGATOR™ & Evoqua Media Crew'}
                </span>
                <span className="font-mono text-[11px]">
                  {mitigatorDispatched ? 'DISPATCHED' : 'DISPATCH'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
