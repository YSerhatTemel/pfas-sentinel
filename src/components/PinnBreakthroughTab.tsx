import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Clock,
  Cpu,
  Gauge,
  Sliders,
  TrendingUp,
} from 'lucide-react';
import {
  FacilityProfile,
  PFAS_SPECIES,
  computeBreakthroughConcentration,
  predictBreakthroughTimeDays,
} from '../data/pfasPhysicsEngine';

interface PinnBreakthroughTabProps {
  facility: FacilityProfile;
  operatingDay: number;
  setOperatingDay: (d: number) => void;
}

export const PinnBreakthroughTab: React.FC<PinnBreakthroughTabProps> = ({
  facility,
  operatingDay,
  setOperatingDay,
}) => {
  const [focusSpecies, setFocusSpecies] = useState<'PFBA' | 'PFBS' | 'PFOA' | 'PFOS'>('PFBA');
  const [customC0, setCustomC0] = useState<number>(facility.influentProfile.PFBA);
  const [customFlowMGD, setCustomFlowMGD] = useState<number>(facility.flowRateMGD);
  const [customMassKg, setCustomMassKg] = useState<number>(facility.mediaMassKg);
  const [customNom, setCustomNom] = useState<number>(facility.matrixDefaults.nomMgL);
  const [showStaticThomasComparison, setShowStaticThomasComparison] = useState<boolean>(true);

  const speciesConfig = PFAS_SPECIES[focusSpecies];

  // Generate time-series points from Day 0 to Day 240
  const daysArray = Array.from({ length: 49 }, (_, i) => i * 5); // 0, 5, 10 ... 240

  // Compute Mid-Bed (z/L = 0.5) and Effluent (z/L = 1.0) curves for the focused species
  const midBedDay4Ppt = predictBreakthroughTimeDays({
    speciesId: focusSpecies,
    mediaType: facility.mediaType,
    C0: customC0,
    flowRateMGD: customFlowMGD,
    mediaMassKg: customMassKg,
    bedDepthFraction: 0.5,
    targetPpt: 4.0,
    nomMgL: customNom,
    usePinnCorrection: true,
  });

  const effluentPinnDay4Ppt = predictBreakthroughTimeDays({
    speciesId: focusSpecies,
    mediaType: facility.mediaType,
    C0: customC0,
    flowRateMGD: customFlowMGD,
    mediaMassKg: customMassKg,
    bedDepthFraction: 1.0,
    targetPpt: 4.0,
    nomMgL: customNom,
    usePinnCorrection: true,
  });

  const effluentStaticDay4Ppt = predictBreakthroughTimeDays({
    speciesId: focusSpecies,
    mediaType: facility.mediaType,
    C0: customC0,
    flowRateMGD: customFlowMGD,
    mediaMassKg: customMassKg,
    bedDepthFraction: 1.0,
    targetPpt: 4.0,
    nomMgL: 1.0,
    usePinnCorrection: false,
  });

  const advanceWarningDays = Math.max(0, Number((effluentPinnDay4Ppt - midBedDay4Ppt).toFixed(1)));
  const blindBreakthroughGapDays = Math.max(
    0,
    Number((effluentStaticDay4Ppt - effluentPinnDay4Ppt).toFixed(1))
  );

  // Helper to convert (day, ppt) into SVG coordinates (Chart 680x280)
  const chartWidth = 640;
  const chartHeight = 230;
  const padLeft = 52;
  const padTop = 20;
  const maxY = Math.max(30, customC0 * 1.05);

  const toX = (day: number) => padLeft + (day / 240) * (chartWidth - padLeft - 20);
  const toY = (ppt: number) =>
    padTop + chartHeight - (Math.min(maxY, ppt) / maxY) * chartHeight;

  const buildCurvePath = (opts: {
    speciesId: 'PFBA' | 'PFBS' | 'PFOA' | 'PFOS';
    bedDepthFraction: number;
    usePinn: boolean;
    c0Val: number;
  }) => {
    return daysArray
      .map((d, idx) => {
        const c = computeBreakthroughConcentration({
          speciesId: opts.speciesId,
          mediaType: facility.mediaType,
          C0: opts.c0Val,
          flowRateMGD: customFlowMGD,
          mediaMassKg: customMassKg,
          day: d,
          bedDepthFraction: opts.bedDepthFraction,
          nomMgL: customNom,
          usePinnCorrection: opts.usePinn,
        });
        return `${idx === 0 ? 'M' : 'L'} ${toX(d).toFixed(1)} ${toY(c).toFixed(1)}`;
      })
      .join(' ');
  };

  const epa4PptY = toY(4.0);
  const currentDayX = toX(Math.min(240, operatingDay));

  return (
    <div className="space-y-6">
      {/* Top Governing Equation & PINN Explanation Banner */}
      <div className="bg-[#0B1D30] border border-cyan-500/30 rounded-xl p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-2">
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Software &amp; AI Innovation • Physics-Informed Neural Network (PINN)
            </span>
            <h2 className="text-lg font-bold text-white">
              Agentic Breakthrough Curve Digital Twin (Bohart-Adams &amp; Thomas Kinetics)
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Classical static adsorption models fail because influent concentration (<code className="text-cyan-300">C₀</code>),
              Sensus flow rate (<code className="text-cyan-300">Q</code>), and Natural Organic Matter (NOM)
              fluctuate continuously. PFAS-Sentinel assimilates 15-minute real-time telemetry from the{' '}
              <strong className="text-amber-300">Influent (C₀)</strong> and{' '}
              <strong className="text-amber-300">Mid-Bed (C_mid)</strong> MIP sensors into a PINN
              constrained by the Thomas kinetic differential equation:
            </p>
          </div>

          {/* Mathematical Formula Display Card */}
          <div className="lg:col-span-5 bg-[#061320] border border-cyan-500/40 rounded-xl p-4 font-mono text-center shadow-inner">
            <div className="text-xs text-cyan-300 mb-1 uppercase tracking-wider">
              Governing Kinetic State Equation
            </div>
            <div className="text-base sm:text-lg font-bold text-white py-2 px-3 bg-[#0B1D30] rounded-lg border border-slate-800">
              ln( C₀ / Cₜ − 1 ) = (k_Th · q₀ · M) / Q − k_Th · C₀ · t
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2.5 text-[11px] text-slate-400">
              <div>
                <span className="text-cyan-300 font-bold">k_Th:</span>{' '}
                {facility.mediaType === 'IX' ? speciesConfig.kTh_IX : speciesConfig.kTh_GAC}
              </div>
              <div>
                <span className="text-emerald-300 font-bold">q₀:</span>{' '}
                {facility.mediaType === 'IX' ? speciesConfig.q0_IX : speciesConfig.q0_GAC} ng/g
              </div>
              <div>
                <span className="text-amber-300 font-bold">M / Q:</span> {customMassKg}kg /{' '}
                {customFlowMGD}MGD
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Chart & Parameter Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Columns: Multi-Species & Mid-Bed vs Effluent Breakthrough Curve */}
        <div className="lg:col-span-8 bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Dynamic Breakthrough Curve: Mid-Bed Early Warning (C<sub>mid</sub>) vs. Effluent (C<sub>t</sub>)
              </h3>
              <p className="text-xs text-slate-400">
                Demonstrating why short-chain PFBA/PFBS break through earliest and how C<sub>mid</sub> prevents blind exhaustion
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-[#061320] p-1 rounded-lg border border-slate-800">
              {(['PFBA', 'PFBS', 'PFOA', 'PFOS'] as const).map((sp) => (
                <button
                  key={sp}
                  onClick={() => {
                    setFocusSpecies(sp);
                    setCustomC0(facility.influentProfile[sp]);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                    focusSpecies === sp
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive SVG Breakthrough Graph */}
          <div className="bg-[#061320] border border-slate-800 rounded-xl p-3">
            <svg
              viewBox="0 0 660 285"
              className="w-full h-auto select-none"
              aria-label="PFAS Breakthrough Curve Graph"
            >
              {/* Horizontal Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
                const val = Number((maxY * frac).toFixed(0));
                const y = toY(val);
                return (
                  <g key={idx}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={chartWidth - 20}
                      y2={y}
                      stroke="#1E293B"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 3}
                      textAnchor="end"
                      fill="#64748B"
                      fontSize="9.5"
                      fontFamily="JetBrains Mono"
                    >
                      {val} ppt
                    </text>
                  </g>
                );
              })}

              {/* Vertical Day Grid Lines */}
              {[0, 40, 80, 120, 160, 200, 240].map((d) => {
                const x = toX(d);
                return (
                  <g key={d}>
                    <line
                      x1={x}
                      y1={padTop}
                      x2={x}
                      y2={padTop + chartHeight}
                      stroke="#1E293B"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={x}
                      y={padTop + chartHeight + 16}
                      textAnchor="middle"
                      fill="#64748B"
                      fontSize="9.5"
                      fontFamily="JetBrains Mono"
                    >
                      Day {d}
                    </text>
                  </g>
                );
              })}

              {/* EPA 4.0 ppt Mandatory MCL Threshold Line */}
              <line
                x1={padLeft}
                y1={epa4PptY}
                x2={chartWidth - 20}
                y2={epa4PptY}
                stroke="#EF4444"
                strokeWidth="1.8"
                strokeDasharray="6 3"
              />
              <text
                x={chartWidth - 24}
                y={epa4PptY - 5}
                textAnchor="end"
                fill="#FCA5A5"
                fontSize="9.5"
                fontWeight="700"
                fontFamily="JetBrains Mono"
              >
                EPA Binding Limit: 4.0 ppt (MCL)
              </text>

              {/* Current Operating Day Vertical Cursor */}
              <line
                x1={currentDayX}
                y1={padTop}
                x2={currentDayX}
                y2={padTop + chartHeight}
                stroke="#38BDF8"
                strokeWidth="1.5"
              />
              <text
                x={currentDayX + 4}
                y={padTop + 12}
                fill="#38BDF8"
                fontSize="9.5"
                fontWeight="700"
                fontFamily="JetBrains Mono"
              >
                Today (Day {operatingDay})
              </text>

              {/* Curve A: Mid-Bed Sensor C_mid (z/L = 0.50) Early Warning */}
              <path
                d={buildCurvePath({
                  speciesId: focusSpecies,
                  bedDepthFraction: 0.5,
                  usePinn: true,
                  c0Val: customC0,
                })}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2.5"
              />

              {/* Curve B: PINN Effluent Prediction C_t (z/L = 1.00) */}
              <path
                d={buildCurvePath({
                  speciesId: focusSpecies,
                  bedDepthFraction: 1.0,
                  usePinn: true,
                  c0Val: customC0,
                })}
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
              />

              {/* Curve C: Classical Static Thomas Model (Uncompensated for NOM fouling) */}
              {showStaticThomasComparison && (
                <path
                  d={buildCurvePath({
                    speciesId: focusSpecies,
                    bedDepthFraction: 1.0,
                    usePinn: false,
                    c0Val: customC0,
                  })}
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              )}

              {/* Highlight Advance Warning Window between Mid-Bed 4 ppt and Effluent 4 ppt */}
              {midBedDay4Ppt < 240 && effluentPinnDay4Ppt < 240 && (
                <g>
                  <circle
                    cx={toX(midBedDay4Ppt)}
                    cy={epa4PptY}
                    r="5"
                    fill="#F59E0B"
                    stroke="#061320"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={toX(effluentPinnDay4Ppt)}
                    cy={epa4PptY}
                    r="5"
                    fill="#10B981"
                    stroke="#061320"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {/* Legend Box */}
              <rect x={padLeft + 10} y={padTop + 8} width="285" height="62" rx="6" fill="#0B1D30" stroke="#1E3A5F" />
              <line x1={padLeft + 18} y1={padTop + 22} x2={padLeft + 38} y2={padTop + 22} stroke="#F59E0B" strokeWidth="2.5" />
              <text x={padLeft + 44} y={padTop + 25} fill="#FDE68A" fontSize="9.5" fontFamily="JetBrains Mono">
                Mid-Bed Sensor C_mid (4 ppt @ Day {midBedDay4Ppt})
              </text>
              <line x1={padLeft + 18} y1={padTop + 38} x2={padLeft + 38} y2={padTop + 38} stroke="#10B981" strokeWidth="3" />
              <text x={padLeft + 44} y={padTop + 41} fill="#6EE7B7" fontSize="9.5" fontFamily="JetBrains Mono">
                PINN Effluent Twin C_t (4 ppt @ Day {effluentPinnDay4Ppt})
              </text>
              <line x1={padLeft + 18} y1={padTop + 54} x2={padLeft + 38} y2={padTop + 54} stroke="#94A3B8" strokeWidth="2" strokeDasharray="3 3" />
              <text x={padLeft + 44} y={padTop + 57} fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono">
                Static Thomas Equation (Blind @ Day {effluentStaticDay4Ppt})
              </text>
            </svg>
          </div>

          {/* 3 Insight Callout Pills Below Chart */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div className="bg-[#061320] border border-amber-500/30 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-amber-300 block">
                Mid-Bed Early Warning Lead Time
              </span>
              <div className="text-lg font-bold font-mono text-white mt-0.5">
                +{advanceWarningDays} Days Notice
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Time between C<sub>mid</sub> trigger (Day {midBedDay4Ppt}) and effluent breach (Day{' '}
                {effluentPinnDay4Ppt})
              </p>
            </div>

            <div className="bg-[#061320] border border-rose-500/30 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-rose-300 block">
                Static Model &quot;Blind Breakthrough&quot; Error
              </span>
              <div className="text-lg font-bold font-mono text-rose-200 mt-0.5">
                {blindBreakthroughGapDays} Days Overestimated
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Static equations ignore NOM pore-blocking ({customNom} mg/L), risking illegal PFAS
                leakage
              </p>
            </div>

            <div className="bg-[#061320] border border-emerald-500/30 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-emerald-300 block">
                Just-In-Time Media Optimization
              </span>
              <div className="text-lg font-bold font-mono text-emerald-300 mt-0.5">
                96.4% Bed Utilization
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Eliminates premature 30% safety-margin media disposal
              </p>
            </div>
          </div>
        </div>

        {/* Right 4 Columns: Interactive Kinetic Parameter Sliders */}
        <div className="lg:col-span-4 bg-[#0B1D30] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                PINN Kinetic Boundary Controls
              </h3>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                Real-Time Solver
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Influent {focusSpecies} ($C_0$):</span>
                <span className="font-mono font-bold text-cyan-300">{customC0} ppt (ng/L)</span>
              </div>
              <input
                type="range"
                min={10}
                max={120}
                step={1}
                value={customC0}
                onChange={(e) => setCustomC0(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Sensus/MJK Flow Rate ($Q$):</span>
                <span className="font-mono font-bold text-cyan-300">{customFlowMGD} MGD</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={5.0}
                step={0.1}
                value={customFlowMGD}
                onChange={(e) => setCustomFlowMGD(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Active {facility.mediaType} Media Mass ($M$):</span>
                <span className="font-mono font-bold text-emerald-300">
                  {customMassKg.toLocaleString()} kg
                </span>
              </div>
              <input
                type="range"
                min={2000}
                max={20000}
                step={200}
                value={customMassKg}
                onChange={(e) => setCustomMassKg(Number(e.target.value))}
                className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">NOM Competitive Fouling (DOC):</span>
                <span className="font-mono font-bold text-amber-300">{customNom} mg/L</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={6.5}
                step={0.2}
                value={customNom}
                onChange={(e) => setCustomNom(Number(e.target.value))}
                className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Inspection Day Cursor ($t$):</span>
                <span className="font-mono font-bold text-white">Day {operatingDay}</span>
              </div>
              <input
                type="range"
                min={10}
                max={220}
                step={1}
                value={operatingDay}
                onChange={(e) => setOperatingDay(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={showStaticThomasComparison}
                onChange={(e) => setShowStaticThomasComparison(e.target.checked)}
                className="rounded accent-cyan-500"
              />
              Show Uncompensated Static Thomas Baseline Curve
            </label>
          </div>

          {/* Multi-Species Exhaustion Order Summary */}
          <div className="bg-[#061320] border border-slate-800 rounded-xl p-3.5">
            <h4 className="text-xs font-mono uppercase text-slate-400 mb-2">
              Predicted 4.0 ppt Breakthrough Sequence
            </h4>
            <div className="space-y-1.5 text-xs font-mono">
              {(['PFBA', 'PFBS', 'PFOA', 'PFOS'] as const).map((sp) => {
                const d = predictBreakthroughTimeDays({
                  speciesId: sp,
                  mediaType: facility.mediaType,
                  C0: sp === focusSpecies ? customC0 : facility.influentProfile[sp],
                  flowRateMGD: customFlowMGD,
                  mediaMassKg: customMassKg,
                  bedDepthFraction: 1.0,
                  targetPpt: 4.0,
                  nomMgL: customNom,
                  usePinnCorrection: true,
                });
                return (
                  <div key={sp} className="flex items-center justify-between">
                    <span style={{ color: PFAS_SPECIES[sp].color }} className="font-bold">
                      {sp} ({PFAS_SPECIES[sp].chainType.split(' ')[0]})
                    </span>
                    <span className="text-slate-200">Day {d}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
