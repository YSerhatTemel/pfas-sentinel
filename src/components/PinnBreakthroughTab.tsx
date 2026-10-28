import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Cpu,
  Gauge,
  Sliders,
  TrendingUp,
} from 'lucide-react';
import {
  FacilityProfile,
  PFAS_SPECIES,
  PUBLISHED_LITERATURE_BREAKTHROUGH_BENCHMARKS,
  computeBedVolumes,
  computeBreakthroughConcentration,
  predictBreakthroughTimeDays,
  runPinnParameterAssimilation,
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
  const [includeCompetitiveRollup, setIncludeCompetitiveRollup] = useState<boolean>(true);
  const [showEmpiricalScatter, setShowEmpiricalScatter] = useState<boolean>(true);

  const speciesConfig = PFAS_SPECIES[focusSpecies];

  // Run genuine PINN Gradient Descent PDE + Mid-Bed Telemetry Assimilation Solver
  const pinnDiagnostics = runPinnParameterAssimilation({
    speciesId: focusSpecies,
    mediaType: facility.mediaType,
    C0: customC0,
    flowRateMGD: customFlowMGD,
    mediaMassKg: customMassKg,
    nomMgL: customNom,
    ebctMinutes: facility.ebctMinutes,
    includeCompetitiveRollup,
  });

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

  // Peak roll-up concentration check across the 240-day window
  const peakEffluentPpt = Math.max(
    ...daysArray.map((d) =>
      computeBreakthroughConcentration({
        speciesId: focusSpecies,
        mediaType: facility.mediaType,
        C0: customC0,
        flowRateMGD: customFlowMGD,
        mediaMassKg: customMassKg,
        day: d,
        bedDepthFraction: 1.0,
        nomMgL: customNom,
        usePinnCorrection: true,
        includeCompetitiveRollup,
      })
    )
  );
  const peakRollupRatioPct = Math.round((peakEffluentPpt / Math.max(1, customC0)) * 100);

  // Helper to convert (day, ppt) into SVG coordinates (Chart 680x280)
  const chartWidth = 640;
  const chartHeight = 230;
  const padLeft = 52;
  const padTop = 20;
  const maxY = Math.max(35, customC0 * (includeCompetitiveRollup ? 1.38 : 1.08));

  const toX = (day: number) => padLeft + (day / 240) * (chartWidth - padLeft - 20);
  const toY = (ppt: number) =>
    padTop + chartHeight - (Math.min(maxY, ppt) / maxY) * chartHeight;

  const buildCurvePath = (opts: {
    speciesId: 'PFBA' | 'PFBS' | 'PFOA' | 'PFOS';
    bedDepthFraction: number;
    usePinn: boolean;
    c0Val: number;
    rollup: boolean;
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
          includeCompetitiveRollup: opts.rollup,
        });
        return `${idx === 0 ? 'M' : 'L'} ${toX(d).toFixed(1)} ${toY(c).toFixed(1)}`;
      })
      .join(' ');
  };

  const epa4PptY = toY(4.0);
  const influentC0Y = toY(customC0);
  const currentDayX = toX(Math.min(240, operatingDay));

  return (
    <div className="space-y-6">
      {/* Top Governing Equation & PINN Explanation Banner */}
      <div className="bg-[#0B1D30] border border-cyan-500/30 rounded-xl p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-2">
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Software &amp; AI Innovation • Physics-Informed Neural Network (PINN) PDE Solver
            </span>
            <h2 className="text-lg font-bold text-white">
              Agentic Breakthrough &amp; Chromatographic Roll-Up Digital Twin
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Classical static adsorption models fail because influent concentration (<code className="text-cyan-300">C₀</code>),
              Sensus flow rate (<code className="text-cyan-300">Q</code>), and Natural Organic Matter (NOM)
              fluctuate continuously, while long-chain PFOS/PFOA displace short-chain PFBA/PFBS
              (<strong className="text-rose-300">chromatographic roll-up Cₜ &gt; C₀</strong>).
              PFAS-Sentinel assimilates 15-minute telemetry from{' '}
              <strong className="text-amber-300">Influent (C₀)</strong> and{' '}
              <strong className="text-amber-300">Mid-Bed (C_mid)</strong> into a PINN minimizing both data
              and PDE collocation residuals:
            </p>
          </div>

          {/* Mathematical Formula Display Card */}
          <div className="lg:col-span-5 bg-[#061320] border border-cyan-500/40 rounded-xl p-4 font-mono text-center shadow-inner">
            <div className="text-[11px] text-cyan-300 mb-1 uppercase tracking-wider">
              1D Advection-Sorption PDE &amp; 2-Layer Neural Residual
            </div>
            <div className="text-xs font-bold text-white py-2 px-2.5 bg-[#0B1D30] rounded-lg border border-slate-800">
              L_PINN = ||Ĉ_mid − C_obs||² + λ·||∂Ĉ/∂t + u_MTZ·∂Ĉ/∂z||²
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              where Ĉ(z, t) = C_Thomas(z, t; k_Th, q₀) + N_W(z, t) • u_MTZ = Q·C₀/(q₀·M)
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 text-[11px] text-slate-400">
              <div>
                <span className="text-cyan-300 font-bold">Learned k_Th:</span>{' '}
                {pinnDiagnostics.learnedKth}
              </div>
              <div>
                <span className="text-emerald-300 font-bold">Learned q₀:</span>{' '}
                {pinnDiagnostics.learnedQ0} ng/g
              </div>
              <div>
                <span className="text-amber-300 font-bold">Valid R²:</span>{' '}
                {pinnDiagnostics.empiricalR2}
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
                Dynamic Breakthrough &amp; Roll-Up: Mid-Bed (C<sub>mid</sub>) vs. Effluent (C<sub>t</sub>)
              </h3>
              <p className="text-xs text-slate-400">
                Includes empirical LC-MS/MS validation checkpoints &amp; C4 competitive desorption overshoot (&gt;C₀)
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

              {/* Influent C0 Reference Line (to clearly visualize Roll-Up Ct > C0) */}
              <line
                x1={padLeft}
                y1={influentC0Y}
                x2={chartWidth - 20}
                y2={influentC0Y}
                stroke="#A855F7"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              <text
                x={chartWidth - 24}
                y={influentC0Y - 4}
                textAnchor="end"
                fill="#D8B4FE"
                fontSize="8.5"
                fontFamily="JetBrains Mono"
              >
                Influent C₀ = {customC0} ppt {peakRollupRatioPct > 102 ? `(Roll-Up Peak: ${peakRollupRatioPct}% C₀)` : ''}
              </text>

              {/* EPA 4.0 ppt Mandatory MCL / Trigger Threshold Line */}
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
                {speciesConfig.id === 'PFOA' || speciesConfig.id === 'PFOS'
                  ? 'EPA Binding MCL: 4.0 ppt'
                  : 'Operational Trigger / MCL: 4.0 ppt'}
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
                  rollup: includeCompetitiveRollup,
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
                  rollup: includeCompetitiveRollup,
                })}
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
              />

              {/* Curve C: Classical Static Thomas Model (Uncompensated for NOM fouling & Roll-Up) */}
              {showStaticThomasComparison && (
                <path
                  d={buildCurvePath({
                    speciesId: focusSpecies,
                    bedDepthFraction: 1.0,
                    usePinn: false,
                    c0Val: customC0,
                    rollup: false,
                  })}
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              )}

              {/* Empirical Pilot Column Validation Points (Scatter Overlay) */}
              {showEmpiricalScatter &&
                pinnDiagnostics.empiricalPoints.map((pt, i) => (
                  <g key={i}>
                    <circle
                      cx={toX(pt.day)}
                      cy={toY(pt.measuredMidBedPpt)}
                      r="3.5"
                      fill="#061320"
                      stroke="#FBBF24"
                      strokeWidth="2"
                    />
                    <circle
                      cx={toX(pt.day)}
                      cy={toY(pt.measuredEffluentPpt)}
                      r="3.5"
                      fill="#061320"
                      stroke="#34D399"
                      strokeWidth="2"
                    />
                  </g>
                ))}

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
              <rect x={padLeft + 8} y={padTop + 6} width="295" height="74" rx="6" fill="#0B1D30" stroke="#1E3A5F" />
              <line x1={padLeft + 16} y1={padTop + 20} x2={padLeft + 36} y2={padTop + 20} stroke="#F59E0B" strokeWidth="2.5" />
              <text x={padLeft + 42} y={padTop + 23} fill="#FDE68A" fontSize="9" fontFamily="JetBrains Mono">
                Mid-Bed C_mid (4 ppt @ Day {midBedDay4Ppt})
              </text>
              <line x1={padLeft + 16} y1={padTop + 35} x2={padLeft + 36} y2={padTop + 35} stroke="#10B981" strokeWidth="3" />
              <text x={padLeft + 42} y={padTop + 38} fill="#6EE7B7" fontSize="9" fontFamily="JetBrains Mono">
                PINN + Roll-Up C_t (4 ppt @ Day {effluentPinnDay4Ppt})
              </text>
              <line x1={padLeft + 16} y1={padTop + 50} x2={padLeft + 36} y2={padTop + 50} stroke="#94A3B8" strokeWidth="2" strokeDasharray="3 3" />
              <text x={padLeft + 42} y={padTop + 53} fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono">
                Static Thomas (Blind @ Day {effluentStaticDay4Ppt})
              </text>
              <circle cx={padLeft + 26} cy={padTop + 66} r="3.5" fill="#061320" stroke="#34D399" strokeWidth="2" />
              <text x={padLeft + 42} y={padTop + 69} fill="#E2E8F0" fontSize="9" fontFamily="JetBrains Mono">
                Empirical Pilot Checkpoints (R²={pinnDiagnostics.empiricalR2})
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
                C4 Competitive Roll-Up &amp; Blind Gap
              </span>
              <div className="text-lg font-bold font-mono text-rose-200 mt-0.5">
                {peakRollupRatioPct > 102
                  ? `${peakRollupRatioPct}% C₀ Roll-Up`
                  : `${blindBreakthroughGapDays}d Static Error`}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {peakRollupRatioPct > 102
                  ? `PFOS/NOM displaces ${focusSpecies} to ${peakEffluentPpt} ppt (>C₀)`
                  : `Static model overestimates bed life by ${blindBreakthroughGapDays} days`}
              </p>
            </div>

            <div className="bg-[#061320] border border-emerald-500/30 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-emerald-300 block">
                Empirical Validation Accuracy
              </span>
              <div className="text-lg font-bold font-mono text-emerald-300 mt-0.5">
                RMSE: {pinnDiagnostics.empiricalRmsePpt} ppt
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                R² = {pinnDiagnostics.empiricalR2} across 8 pilot column checkpoints
              </p>
            </div>
          </div>
        </div>

        {/* Right 4 Columns: Interactive Kinetic Parameter Sliders */}
        <div className="lg:col-span-4 bg-[#0B1D30] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                PINN Kinetic Boundary Controls
              </h3>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                24-Epoch Solver
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Influent {focusSpecies} (C₀):</span>
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
                <span className="text-slate-300">Sensus/MJK Flow Rate (Q):</span>
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
                <span className="text-slate-300">Active {facility.mediaType} Media Mass (M):</span>
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
                <span className="text-slate-300">Inspection Day Cursor (t):</span>
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

            <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCompetitiveRollup}
                  onChange={(e) => setIncludeCompetitiveRollup(e.target.checked)}
                  className="rounded accent-rose-500"
                />
                Simulate C4 Competitive Roll-Up (Cₜ &gt; C₀)
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showEmpiricalScatter}
                  onChange={(e) => setShowEmpiricalScatter(e.target.checked)}
                  className="rounded accent-emerald-500"
                />
                Show Empirical LC-MS/MS Pilot Checkpoints
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showStaticThomasComparison}
                  onChange={(e) => setShowStaticThomasComparison(e.target.checked)}
                  className="rounded accent-cyan-500"
                />
                Show Uncompensated Static Thomas Curve
              </label>
            </div>
          </div>

          {/* Multi-Species Exhaustion Order Summary & Dataset Export */}
          <div className="bg-[#061320] border border-slate-800 rounded-xl p-3.5 space-y-3">
            <h4 className="text-xs font-mono uppercase text-slate-400">
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
                const rem = Math.max(0, d - operatingDay);
                const remDays = Math.floor(rem);
                const remHrs = Math.round((rem - remDays) * 24);
                return (
                  <div key={sp} className="flex items-center justify-between">
                    <span style={{ color: PFAS_SPECIES[sp].color }} className="font-bold">
                      {sp} ({PFAS_SPECIES[sp].chainType.split(' ')[0]})
                    </span>
                    <span className="text-slate-200">
                      Day {d} ({rem > 0 ? `${remDays}d ${remHrs}h left` : 'Exhausted'})
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => {
                const header =
                  'Day,Species,Influent_C0_ppt,MidBed_Cmid_ppt,Effluent_PINN_Rollup_Ct_ppt,Effluent_Static_Ct_ppt,Flow_MGD,NOM_mgL\n';
                const rows = daysArray
                  .map((d) => {
                    const cMid = computeBreakthroughConcentration({
                      speciesId: focusSpecies,
                      mediaType: facility.mediaType,
                      C0: customC0,
                      flowRateMGD: customFlowMGD,
                      mediaMassKg: customMassKg,
                      day: d,
                      bedDepthFraction: 0.5,
                      nomMgL: customNom,
                      usePinnCorrection: true,
                      includeCompetitiveRollup,
                    });
                    const cEffPinn = computeBreakthroughConcentration({
                      speciesId: focusSpecies,
                      mediaType: facility.mediaType,
                      C0: customC0,
                      flowRateMGD: customFlowMGD,
                      mediaMassKg: customMassKg,
                      day: d,
                      bedDepthFraction: 1.0,
                      nomMgL: customNom,
                      usePinnCorrection: true,
                      includeCompetitiveRollup,
                    });
                    const cEffStatic = computeBreakthroughConcentration({
                      speciesId: focusSpecies,
                      mediaType: facility.mediaType,
                      C0: customC0,
                      flowRateMGD: customFlowMGD,
                      mediaMassKg: customMassKg,
                      day: d,
                      bedDepthFraction: 1.0,
                      nomMgL: 1.0,
                      usePinnCorrection: false,
                      includeCompetitiveRollup: false,
                    });
                    return `${d},${focusSpecies},${customC0},${cMid},${cEffPinn},${cEffStatic},${customFlowMGD},${customNom}`;
                  })
                  .join('\n');
                const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `pfas_sentinel_${facility.id}_${focusSpecies}_pinn_dataset.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="w-full py-2 px-3 rounded-lg bg-[#10263F] hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono text-xs font-semibold transition-all text-center"
            >
              ↓ Export PINN &amp; Roll-Up Dataset (.CSV)
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Live PINN Gradient Descent Convergence & PDE Collocation Diagnostics */}
      <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              PINN Parameter Assimilation &amp; PDE Collocation Residual Convergence
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live gradient descent optimization of [k_Th, q_0] from Mid-Bed (z/L = 0.50) telemetry + Thomas PDE residuals
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-[#061320] border border-slate-800 text-slate-300">
              Prior Static q₀: <strong>{pinnDiagnostics.priorStaticQ0} ng/g</strong> → Assimilated q₀:{' '}
              <strong className="text-emerald-300">{pinnDiagnostics.learnedQ0} ng/g</strong>
            </span>
            <span className="px-2.5 py-1 rounded bg-[#061320] border border-slate-800 text-slate-300">
              Prior k_Th: <strong>{pinnDiagnostics.priorStaticKth}</strong> → Assimilated k_Th:{' '}
              <strong className="text-cyan-300">{pinnDiagnostics.learnedKth}</strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs font-mono">
          {pinnDiagnostics.lossHistory.map((step) => (
            <div
              key={step.epoch}
              className="bg-[#061320] border border-slate-800 rounded-lg p-3 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-[10px] text-cyan-400">
                <span>EPOCH {step.epoch}</span>
                {step.epoch === pinnDiagnostics.epochsRun && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </div>
              <div className="text-sm font-bold text-white mt-1">
                L = {step.totalLoss.toFixed(3)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                PDE: {step.pdeLoss.toFixed(3)} | Data: {step.dataLoss.toFixed(3)}
              </div>
            </div>
          ))}
        </div>

        {/* Published Peer-Reviewed GAC/IX Literature Benchmark Alignment */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
          {PUBLISHED_LITERATURE_BREAKTHROUGH_BENCHMARKS.map((lit, idx) => (
            <div
              key={idx}
              className="bg-[#061320] border border-slate-800 rounded-xl p-3.5 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-cyan-300">{lit.studyCitation}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                  Literature Fit
                </span>
              </div>
              <div className="text-[11px] font-mono text-amber-300">{lit.mediaAndScale}</div>
              <p className="text-xs text-slate-300">{lit.keyEmpiricalFinding}</p>
              <p className="text-[11px] font-mono text-emerald-400">
                → {lit.pinnModelAgreement}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
