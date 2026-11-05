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
import { FacilityProfile, PFAS_SPECIES, SPECIES_ORDER, computeBedVolumes, truthConcentration } from '../data/pfasPhysicsEngine';
import type { Situation, ScenarioId } from '../data/situation';

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
  situation: Situation;
  mitigatorDispatched: boolean;
  onToggleManualRotation: () => void;
  onToggleMitigator: () => void;
  onTriggerScenario: (scenario: ScenarioId) => void;
  activeScenario: ScenarioId;
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

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
  situation,
  mitigatorDispatched,
  onToggleManualRotation,
  onToggleMitigator,
  onTriggerScenario,
  activeScenario,
}) => {
  const { effectiveFlowMGD, effectiveEbctMinutes, effectiveNomMgL, regMetrics, plant } = situation;
  const leadLagSwitched = situation.rotated;
  const speciesList = SPECIES_ORDER;

  // Live values come from the simulated plant (testbench); forecasts from the operational twin.
  // ct = final train effluent after the lag vessel; rawEffluent = lead-vessel outlet (inter-vessel port).
  const speciesTelemetry = SPECIES_ORDER.map((sp) => {
    const s = situation.train[sp];
    return {
      species: PFAS_SPECIES[sp],
      c0: s.c0,
      cMid: r2(s.midBedPpt),
      rawEffluent: r2(s.leadOutletPpt),
      ct: r2(s.finalEffluentPpt),
      isRollupActive: s.isRollupActive,
      breakthroughDayEffluent: r1(s.forecastLeadOutlet4PptDay),
      breakthroughDayMidBed: r1(s.forecastMidBed4PptDay),
      remainingDays: r1(s.remainingDays),
      effectiveRunDays: s.effectiveRunDays,
    };
  });

  const activeTelemetry = speciesTelemetry.find((t) => t.species.id === selectedSpecies) || speciesTelemetry[0];
  // Compliance-limiting species (binding MCL) drives the breakthrough window; PFBA is the MTZ tracer.
  const criticalTelemetry = speciesTelemetry.find((t) => t.species.id === situation.limiting.speciesId) || speciesTelemetry[2];
  const critical = situation.limiting;
  const bandDays = r1(critical.uncertaintyBandDays);
  const isMidBedWarning = situation.tracer.midBedPpt >= 4.0;
  const isEffluentBreachRisk = situation.decision.withinServiceWindow;
  const effluentMap = situation.finalEffluent;

  // Saturation profile along the current lead vessel (z = 15% .. 100%) and the lag vessel (z = 1 + ...)
  const depthSlices = [0.15, 0.35, 0.5, 0.75, 1.0].map((z) => {
    const conc = truthConcentration(plant, selectedSpecies, z, activeTelemetry.effectiveRunDays);
    return { z, conc: r2(conc), satPct: Math.min(135, Math.round((conc / activeTelemetry.c0) * 100)) };
  });
  const lagSlices = [0.25, 0.6, 1.0].map((z) => {
    const conc = truthConcentration(plant, selectedSpecies, 1 + z, activeTelemetry.effectiveRunDays);
    return { z, conc: r2(conc), satPct: Math.min(100, Math.max(3, Math.round((conc / Math.max(1, activeTelemetry.c0)) * 100))) };
  });
  const lagVesselEffectiveDay = Math.round(activeTelemetry.effectiveRunDays);

  const pinnAssimilatedBreachDay = r1(critical.forecastLeadOutlet4PptDay);
  const pinnRemainingDays = r1(critical.remainingDays);
  const remainingWholeDays = Math.max(0, Math.floor(pinnRemainingDays));
  const remainingHours = Math.max(0, Math.round((pinnRemainingDays - remainingWholeDays) * 24));

  return (
    <div className="space-y-6">
      {/* Top Scenario & Simulation Control Bar */}
      <div className="bg-[#0B1D30] border border-cyan-500/30 rounded-xl p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md text-xs font-mono uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Interactive Sandbox (simulated plant)
            </span>
            <span className="text-sm text-slate-300 font-medium">
              Inject simulated field scenarios:
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
              1. Baseline Operation (Day {facility.currentOperatingDay})
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
              3. AFFF Plume Surge (emergency test)
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
                  Day {operatingDay} ({computeBedVolumes(operatingDay, effectiveEbctMinutes).toLocaleString('en-US')} BV)
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={400}
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
              onClick={onToggleManualRotation}
              title="Logged manual override; blocked only by the hydraulic interlock"
              className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                leadLagSwitched
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-cyan-500/40'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${leadLagSwitched ? 'animate-spin' : ''}`} />
              {leadLagSwitched ? 'Rotated (undo demo)' : 'Manual Override: Rotate Lead-Lag'}
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
            <span>NOM: {effectiveNomMgL} mg/L</span>
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
              {isMidBedWarning ? 'PFBA TRACER ALERT' : 'NO TRACER ALERT'}
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
                Node 03 • Final Effluent (after lag)
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
                  <AlertTriangle className="w-3 h-3" />{' '}
                  {activeTelemetry.species.id === 'PFOA' || activeTelemetry.species.id === 'PFOS'
                    ? '> 4 ppt (SCREEN)'
                    : 'TRACER ALERT'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3" />{' '}
                  {activeTelemetry.species.id === 'PFOA' || activeTelemetry.species.id === 'PFOS'
                    ? '< 4.0 ppt (SCREEN)'
                    : '< 4.0 ppt TRACER'}
                </>
              )}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 truncate max-w-[165px]" title={activeTelemetry.species.statutoryLimitLabel}>
              {activeTelemetry.species.id === 'PFOA' || activeTelemetry.species.id === 'PFOS'
                ? `Lead outlet: ${activeTelemetry.rawEffluent} ppt`
                : activeTelemetry.species.id === 'PFBS'
                ? `Lead outlet: ${activeTelemetry.rawEffluent} ppt`
                : `Lead outlet: ${activeTelemetry.rawEffluent} ppt`}
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
                Forecast Breakthrough Window
              </p>
              <h3 className="text-2xl font-bold font-mono text-white mt-1">
                {leadLagSwitched ? (
                  <span className="text-emerald-400 text-lg">
                    LAG POLISHING ({pinnRemainingDays > 0 ? `+${remainingWholeDays}d` : 'ACTIVE'})
                  </span>
                ) : pinnRemainingDays > 0 ? (
                  <>
                    {remainingWholeDays}d {remainingHours}h{' '}
                    <span className="text-xs font-normal text-cyan-300">
                      (±{bandDays}d)
                    </span>
                  </>
                ) : (
                  <span className="text-rose-400 text-lg">BREAKTHROUGH NOW</span>
                )}
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              Limiting (MCL): {criticalTelemetry.species.name}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Lead outlet 4 ppt ≈ day {pinnAssimilatedBreachDay} ±{bandDays}d (
              {computeBedVolumes(pinnAssimilatedBreachDay, effectiveEbctMinutes).toLocaleString('en-US')} BV)
            </span>
            <span className="text-cyan-300 font-mono" title="The operational twin only uses mid-bed data available up to today">
              Data to day {situation.fit.lastDataDay}
            </span>
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
                  Treatment-Train Digital Twin (concept for Xylem Vue powered by GoAigua)
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
                1. Blind sensor estimator (NIP + YSI) → 2. Breakthrough twin → 3. Interlocked EWS
              </text>
              <text x="200" y="68" fill="#10B981" fontSize="10" fontFamily="JetBrains Mono">
                Status: {leadLagSwitched ? 'LEAD-LAG ROTATED (EVOQUA MEDIA SERVICE)' : isEffluentBreachRisk ? 'PFOA/PFOS BREACH INSIDE SERVICE WINDOW' : isMidBedWarning ? 'PFBA TRACER ALERT (NO ACTUATION)' : 'MONITORING (SIMULATED TELEMETRY)'}
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
              <text x="45" y="263" fill="#38BDF8" fontSize="9.5" fontWeight="700" fontFamily="JetBrains Mono">
                YSI EXO2 (fDOM) + SENSUS
              </text>
              <text x="45" y="279" fill="#E2E8F0" fontSize="10" fontFamily="JetBrains Mono">
                Flow Q: {effectiveFlowMGD} MGD
              </text>
              <text x="45" y="294" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono">
                pH {facility.matrixDefaults.pH} | {facility.matrixDefaults.tempC}°C
              </text>
              <text x="45" y="308" fill="#FCD34D" fontSize="9" fontFamily="JetBrains Mono">
                fDOM: {Math.round(effectiveNomMgL * 24.5)} QSU (NOM Proxy)
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
                      Lag z={Math.round(slice.z * 100)}% (lead run {lagVesselEffectiveDay}d)
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
                {leadLagSwitched ? 'Fresh media (new lag)' : 'Polishing lag vessel'}
              </text>
              <text x="570" y="317" fill="#94A3B8" fontSize="8.5" fontFamily="JetBrains Mono">
                Final effluent = lag outlet
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
                {activeTelemetry.ct < 4.0 ? 'BELOW 4 ppt (SCREEN)' : 'ABOVE 4 ppt (SCREEN)'}
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
                {mitigatorDispatched ? 'DISPATCHED (demo)' : 'STANDBY (contingency)'}
              </text>
              <text x="715" y="167" fill="#94A3B8" fontSize="8.5" fontFamily="JetBrains Mono">
                Evoqua O&amp;M Logistics Sync
              </text>
            </svg>
          </div>

          {/* Instantaneous regulatory screen of simulated final effluent (not a compliance determination) */}
          <div className="mt-4 pt-3 border-t border-slate-800/90 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-[#061320] border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase block">
                  EPA MCL screen (PFOA/PFOS 4 ppt kept | others: rescission proposed)
                </span>
                <span className="font-mono font-bold text-white">
                  C8: {effluentMap.PFOA}/{effluentMap.PFOS}p • C6/GenX: {regMetrics.effPfhxs}/{regMetrics.effGenx}p
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                  regMetrics.pfoaBelowMcl &&
                  regMetrics.pfosBelowMcl &&
                  regMetrics.coContaminantsBelow10Ppt
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                4.0 / 10.0 ppt
              </span>
            </div>

            <div className="bg-[#061320] border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-purple-400 uppercase block">
                  EPA Hazard Index (2024 rule; rescission proposed)
                </span>
                <span className="font-mono font-bold text-white">
                  HI = {regMetrics.hazardIndex} (PFBS: {effluentMap.PFBS} ppt)
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                  regMetrics.hazardIndexBelowOne
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
                  EU DWD Sum of PFAS (100 ng/L) — partial estimate
                </span>
                <span className="font-mono font-bold text-white">
                  Σ {regMetrics.euAnalytesCovered} of {regMetrics.euAnalytesRequired}: {regMetrics.euSumPartialNgL} ng/L
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                  regMetrics.euPartialBelowLimit
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                Partial
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span>
              <strong className="text-cyan-300">Benchmark Context:</strong> {facility.benchmarkNote} Regulatory values here are an instantaneous screen of simulated data, not a compliance determination (EPA compliance uses running annual averages).
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
                          ? `Lead outlet 4 ppt in ${item.remainingDays}d`
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
                            item.cMid >= 4.0 ? 'text-amber-400 font-bold' : 'text-slate-200'
                          }
                        >
                          {item.cMid} ppt
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">FINAL Ct (AFTER LAG)</span>
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

          {/* Early-warning status and logged operator actions */}
          <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                Early-Warning Status
              </h3>
              <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {situation.decision.action}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Many {facility.mediaType} vessels have a{' '}
              <strong className="text-cyan-300">mid-bed sample port (z/L = 0.50)</strong> that is sampled
              by hand today (assumed monthly, with days-to-weeks lab turnaround). The proposed sensor on that
              port would track short-chain <strong className="text-amber-300">PFBA/PFBS</strong> as early
              tracers for the twin. Rotation is scheduled only when the conservative{' '}
              <strong className="text-rose-300">PFOA/PFOS</strong> breach forecast enters the{' '}
              60-day service window and every interlock passes.
            </p>
            <p className="text-[11px] text-slate-400 mb-3">{situation.decision.reasons.join(' ')}</p>

            <div className="space-y-2">
              <button
                onClick={onToggleManualRotation}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-between border transition-all ${
                  leadLagSwitched
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-[#10263F] text-cyan-200 border-cyan-500/30 hover:bg-cyan-500/20'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  {leadLagSwitched ? 'Lead-lag rotated (click to undo demo)' : 'Manual override: rotate lead-lag'}
                </span>
                <span className="font-mono text-[11px]">{leadLagSwitched ? 'ROTATED' : 'LOGGED'}</span>
              </button>

              <button
                onClick={onToggleMitigator}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-between border transition-all ${
                  mitigatorDispatched
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-[#10263F] text-amber-200 border-amber-500/30 hover:bg-amber-500/20'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  {mitigatorDispatched ? 'MitiGATOR™ mobile unit dispatched (demo)' : 'Dispatch MitiGATOR™ contingency (logged)'}
                </span>
                <span className="font-mono text-[11px]">{mitigatorDispatched ? 'DISPATCHED' : 'DISPATCH'}</span>
              </button>
              <p className="text-[10px] text-slate-500">
                Full interlocks, fault injection and the audit log are in the Early-Warning System tab.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
