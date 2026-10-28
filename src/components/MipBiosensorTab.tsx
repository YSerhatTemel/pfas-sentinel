import React, { useState } from 'react';
import {
  Cpu,
  Layers,
  Microscope,
  Sliders,
  Zap,
  CheckCircle2,
  AlertCircle,
  Package,
  Sparkles,
  Activity,
  FlaskConical,
  CircuitBoard,
} from 'lucide-react';
import {
  PFAS_SPECIES,
  HARDWARE_BOM,
  RESEARCH_SYNTHESIS_PILLARS,
  EMPIRICAL_MATRIX_VALIDATION_BENCHMARKS,
  MIP_CROSS_SELECTIVITY_MATRIX,
  computeMipElectrochemicalSignal,
} from '../data/pfasPhysicsEngine';

export const MipBiosensorTab: React.FC = () => {
  const [selectedSpecies, setSelectedSpecies] = useState<'PFOA' | 'PFOS' | 'PFBS' | 'PFBA'>('PFOA');
  const [truePpt, setTruePpt] = useState<number>(4.0);
  const [tempC, setTempC] = useState<number>(14.5);
  const [pH, setPH] = useState<number>(7.2);
  const [turbidityNTU, setTurbidityNTU] = useState<number>(1.8);
  const [conductivityUsCm, setConductivityUsCm] = useState<number>(420);
  const [nomMgL, setNomMgL] = useState<number>(3.4);
  const [assayMode, setAssayMode] = useState<'quantitative' | 'screening'>('quantitative');
  const [formFactor, setFormFactor] = useState<'flow-cell' | 'sample-cup'>('flow-cell');
  const [activeCadLayer, setActiveCadLayer] = useState<number>(2);

  const signal = computeMipElectrochemicalSignal({
    truePpt,
    speciesId: selectedSpecies,
    tempC,
    pH,
    turbidityNTU,
    conductivityUsCm,
    nomMgL,
  });

  // Generate Nyquist semicircle points (-Z'' vs Z') for Baseline, NIP Reference, Raw Uncompensated, and Inverse Edge-AI Purified
  const Rs = 65; // Solution resistance (Ohms)
  const rctBaseline = 180;
  const rctNipBlank = rctBaseline + Math.max(8, signal.nipBlankDeltaRct) * 1.4;
  const rctPurified = rctBaseline + signal.purifiedDeltaRct * 1.4;
  const rctMeasured = rctBaseline + signal.measuredDeltaRct * 1.4;

  const buildNyquistPath = (rct: number) => {
    const points: string[] = [];
    for (let i = 0; i <= 30; i++) {
      const theta = (Math.PI * i) / 30;
      const zReal = Rs + (rct / 2) * (1 - Math.cos(theta));
      const zImag = (rct / 2) * Math.sin(theta);
      // Add Warburg diffusion tail at low frequencies (i >= 27)
      const warburg = i > 26 ? (i - 26) * 11 : 0;
      const x = 50 + (zReal + warburg) * 0.85;
      const y = 220 - (zImag + warburg * 0.9) * 0.85;
      points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return points.join(' ');
  };

  const cadLayers = [
    {
      id: 1,
      title: 'Layer 1: COC Microfluidic Laminar Flow Cell & 0.22 μm Pre-Filter',
      subtitle: 'In-line NPT 1/4" tap or field "Razor-and-Blade" Sensing Lid',
      detail:
        'Cyclic Olefin Copolymer (COC) micro-channels create high surface-to-volume laminar flow over the sensing array, accelerating mass transport so 1–4 ppt equilibrium binding occurs in 12–15 minutes (<2 min rapid screening).',
      badge: 'Hydrodynamic Pre-Concentration',
    },
    {
      id: 2,
      title: 'Layer 2: Stand-Alone Molecularly Imprinted Polymer (MIP) Membrane',
      subtitle: '3D Steric & Electrostatic Fluorophilic Cavities (Oseyemi & Rezai 2025)',
      detail:
        'Self-supporting nanoporous polymer templated specifically for C8 (PFOA, PFOS) and C4 (PFBS, PFBA) headgroups and fluorocarbon tails. Physically excludes bulky humic acids (NOM) while rejecting chloride/sulfate co-ions.',
      badge: 'Ka ≈ 10⁸ M⁻¹ Selectivity',
    },
    {
      id: 3,
      title: 'Layer 3: Amine-Functionalized Nanocarbon 32-Ch Electrode Array',
      subtitle: 'Electrostatic protonated amine (-NH₃⁺) attraction + Redox Gate Effect',
      detail:
        'Amine-functionalized graphene/CNT nanocomposite (inspired by UConn & Verralize architectures) amplifies charge-transfer resistance (ΔRct) of the embedded [Fe(CN)₆]³⁻/⁴⁻ mediator when PFAS molecules occupy MIP cavities.',
      badge: 'LOD: 0.8 ppt (ng/L)',
    },
    {
      id: 4,
      title: 'Layer 4: Differential NIP Reference + AD5940 EIS Edge AI Module',
      subtitle: '4 Non-Imprinted Polymer (NIP) blank channels + YSI/WTW Telemetry Fusion',
      detail:
        'Performs Two-Stage Inverse De-Embedding: subtracts NIP blank impedance (Channels 29–32), applies Arrhenius temperature, Henderson-Hasselbalch amine protonation, and Gouy-Chapman Debye screening corrections on an ARM Cortex-M33 NPU.',
      badge: 'Inverse R² = 0.996',
    },
  ];

  const disposableCost = HARDWARE_BOM.filter((b) =>
    b.lifecycleRole.includes('Disposable')
  ).reduce((acc, item) => acc + item.unitCostUsd, 0);

  const readerPodCost = HARDWARE_BOM.filter((b) =>
    b.lifecycleRole.includes('Reusable')
  ).reduce((acc, item) => acc + item.unitCostUsd, 0);

  return (
    <div className="space-y-6">
      {/* Top Architecture Banner */}
      <div className="bg-[#0B1D30] border border-cyan-500/30 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 block">
              Hardware &amp; Non-Circular Inverse Calibration • Challenge #2 (TRL 3 In-Silico Architecture)
            </span>
            <h2 className="text-lg font-bold text-white mt-0.5">
              Microfluidic Stand-Alone MIP &amp; Amine-Functionalized Nanocarbon Sensor Array
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Synthesizing 2024–2025 peer-reviewed electrochemical architectures (UConn amine-functionalized
              sensing, Oseyemi &amp; Rezai Sept 2025 stand-alone microfluidic MIP, Rowan University &amp;
              Verralize multiplexed platforms) into a proposed industrial cartridge targeting EPA’s{' '}
              <strong className="text-cyan-300">4.0 ppt threshold in 12–15 minutes</strong> via
              differential NIP subtraction and 4×4 cross-selectivity deconvolution.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#061320] p-1.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setAssayMode('quantitative')}
                className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  assayMode === 'quantitative'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Quantitative EIS (12–15m • 1–4 ppt)
              </button>
              <button
                onClick={() => setAssayMode('screening')}
                className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  assayMode === 'screening'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Rapid Screening (&lt;2m • &gt;10 ppt)
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-[#061320] p-1.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setFormFactor('flow-cell')}
                className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  formFactor === 'flow-cell'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                In-Line Microfluidic Flow Cell
              </button>
              <button
                onClick={() => setFormFactor('sample-cup')}
                className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  formFactor === 'sample-cup'
                    ? 'bg-purple-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sample Cup &amp; Sensing Lid
              </button>
            </div>
          </div>
        </div>

        {/* Active Form Factor & Assay Mode Status Strip */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <span className="text-cyan-300">
            Active Format:{' '}
            <strong className="text-white">
              {formFactor === 'flow-cell'
                ? 'In-Line NPT 1/4" Microfluidic Flow Cell (Connected to Influent C₀, Mid-Bed C_mid & Effluent C_t)'
                : 'Portable Disposable Sample Cup + 32-Ch Multiplexed Sensing Lid ("Razor-and-Blade" Field Kit)'}
            </strong>
          </span>
          <span className="text-emerald-300">
            Interrogation:{' '}
            <strong className="text-white">
              {assayMode === 'quantitative'
                ? '12–15 Min Pre-Concentration + [Fe(CN)₆]³⁻/⁴⁻ EIS Gate-Effect (LOD: 0.8–4.0 ppt)'
                : '<2 Min High-Speed DPV/EIS Plume Triage for AFFF Emergency Response'}
            </strong>
          </span>
        </div>
      </div>

      {/* Middle Grid: Exploded 3D CAD Cross-Section + Live EIS Nyquist & Inverse Edge AI De-Embedding */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Columns: Interactive 3D CAD Exploded Cartridge View */}
        <div className="lg:col-span-6 bg-[#0B1D30] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                3D CAD Exploded Cartridge Architecture (Click Layer to Inspect)
              </h3>
              <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                32-Ch Multiplexed
              </span>
            </div>

            {/* Interactive Isometric Exploded SVG Diagram */}
            <div className="bg-[#061320] border border-slate-800 rounded-xl p-3 mb-4">
              <svg
                viewBox="0 0 540 310"
                className="w-full h-auto select-none"
                aria-label="Exploded 3D CAD View of PFAS-Sentinel MIP Cartridge"
              >
                {/* Layer 1: Microfluidic Cap */}
                <g
                  onClick={() => setActiveCadLayer(1)}
                  className="cursor-pointer transition-opacity hover:opacity-95"
                >
                  <polygon
                    points="270,18 440,58 270,98 100,58"
                    fill={activeCadLayer === 1 ? '#0284C7' : '#0F2942'}
                    fillOpacity={activeCadLayer === 1 ? '0.55' : '0.8'}
                    stroke="#38BDF8"
                    strokeWidth={activeCadLayer === 1 ? '2.5' : '1.2'}
                  />
                  {/* Microfluidic Serpentine Channels */}
                  <path
                    d="M 190 58 Q 230 42, 270 58 T 350 58"
                    fill="none"
                    stroke="#7DD3FC"
                    strokeWidth="2.5"
                    className="animate-flow"
                  />
                  <text x="205" y="55" fill="#F8FAFC" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono">
                    1. COC Microfluidic Flow Cell
                  </text>
                </g>

                {/* Layer 2: Stand-Alone MIP Membrane */}
                <g
                  onClick={() => setActiveCadLayer(2)}
                  className="cursor-pointer transition-opacity hover:opacity-95"
                >
                  <polygon
                    points="270,88 440,128 270,168 100,128"
                    fill={activeCadLayer === 2 ? '#D97706' : '#1E293B'}
                    fillOpacity={activeCadLayer === 2 ? '0.55' : '0.85'}
                    stroke="#F59E0B"
                    strokeWidth={activeCadLayer === 2 ? '2.5' : '1.5'}
                  />
                  {/* MIP Cavities Illustration */}
                  {[190, 230, 270, 310, 350].map((cx, i) => (
                    <circle
                      key={i}
                      cx={cx}
                      cy={128}
                      r="6"
                      fill="#061320"
                      stroke="#FBBF24"
                      strokeWidth="1.5"
                    />
                  ))}
                  <text x="180" y="122" fill="#FEF3C7" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono">
                    2. Stand-Alone MIP Cavity Membrane
                  </text>
                </g>

                {/* Layer 3: Amine-Functionalized Nanocarbon Electrode Array */}
                <g
                  onClick={() => setActiveCadLayer(3)}
                  className="cursor-pointer transition-opacity hover:opacity-95"
                >
                  <polygon
                    points="270,158 440,198 270,238 100,198"
                    fill={activeCadLayer === 3 ? '#059669' : '#0F172A'}
                    fillOpacity={activeCadLayer === 3 ? '0.55' : '0.9'}
                    stroke="#10B981"
                    strokeWidth={activeCadLayer === 3 ? '2.5' : '1.5'}
                  />
                  <text x="168" y="198" fill="#D1FAE5" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono">
                    3. Amine-Nanocarbon 32-Electrode Array
                  </text>
                </g>

                {/* Layer 4: Gold Contact PCB & AD5940 Edge AI Base */}
                <g
                  onClick={() => setActiveCadLayer(4)}
                  className="cursor-pointer transition-opacity hover:opacity-95"
                >
                  <polygon
                    points="270,225 440,265 270,302 100,265"
                    fill={activeCadLayer === 4 ? '#4F46E5' : '#091526'}
                    fillOpacity={activeCadLayer === 4 ? '0.55' : '0.95'}
                    stroke="#818CF8"
                    strokeWidth={activeCadLayer === 4 ? '2.5' : '1.5'}
                  />
                  <text x="172" y="268" fill="#E0E7FF" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono">
                    4. NIP Reference + AD5940 EIS Edge Pod
                  </text>
                </g>
              </svg>
            </div>

            {/* Layer Selector Tabs & Detailed Spec Box */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {cadLayers.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setActiveCadLayer(layer.id)}
                  className={`py-1.5 px-2 rounded text-xs font-mono font-semibold border transition-all ${
                    activeCadLayer === layer.id
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                      : 'bg-[#061320] text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  Layer {layer.id}
                </button>
              ))}
            </div>

            {cadLayers
              .filter((l) => l.id === activeCadLayer)
              .map((layer) => (
                <div
                  key={layer.id}
                  className="bg-[#061320] border border-cyan-500/30 rounded-lg p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-white">{layer.title}</h4>
                    <span className="text-[10px] font-mono bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30 shrink-0">
                      {layer.badge}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-amber-300 mt-0.5">{layer.subtitle}</p>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">{layer.detail}</p>
                </div>
              ))}
          </div>
        </div>

        {/* Right 6 Columns: Inverse Edge AI Matrix De-Embedding + Live EIS Nyquist Plot */}
        <div className="lg:col-span-6 bg-[#0B1D30] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                EIS Nyquist &amp; Two-Stage Inverse Edge AI De-Embedding
              </h3>
              <p className="text-xs text-slate-400">
                Differential NIP reference (CH29–32) + Arrhenius/Debye/Henderson-Hasselbalch NPU inversion
              </p>
            </div>

            <div className="flex gap-1 bg-[#061320] p-1 rounded-lg border border-slate-800">
              {(['PFOA', 'PFOS', 'PFBS', 'PFBA'] as const).map((sp) => (
                <button
                  key={sp}
                  onClick={() => setSelectedSpecies(sp)}
                  className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                    selectedSpecies === sp
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>

          {/* Live Nyquist Plot (-Z'' vs Z') */}
          <div className="bg-[#061320] border border-slate-800 rounded-xl p-3">
            <svg
              viewBox="0 0 500 250"
              className="w-full h-auto"
              aria-label="Electrochemical Impedance Spectroscopy Nyquist Plot"
            >
              {/* Grid lines */}
              {[60, 110, 160, 210].map((y) => (
                <line
                  key={y}
                  x1="50"
                  y1={y}
                  x2="475"
                  y2={y}
                  stroke="#1E293B"
                  strokeDasharray="3 3"
                />
              ))}
              {[120, 200, 280, 360, 440].map((x) => (
                <line
                  key={x}
                  x1={x}
                  y1="25"
                  x2={x}
                  y2="220"
                  stroke="#1E293B"
                  strokeDasharray="3 3"
                />
              ))}

              {/* Axes */}
              <line x1="50" y1="220" x2="480" y2="220" stroke="#64748B" strokeWidth="1.5" />
              <line x1="50" y1="25" x2="50" y2="220" stroke="#64748B" strokeWidth="1.5" />
              <text x="230" y="242" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono">
                Z&apos; Real Impedance (Ω)
              </text>
              <text
                x="15"
                y="140"
                fill="#94A3B8"
                fontSize="10"
                fontFamily="JetBrains Mono"
                transform="rotate(-90, 15, 140)"
              >
                -Z&apos;&apos; Imag (Ω)
              </text>

              {/* Curve 1: Blank Zero-PFAS Baseline */}
              <path
                d={buildNyquistPath(rctBaseline)}
                fill="none"
                stroke="#64748B"
                strokeWidth="1.8"
                strokeDasharray="4 4"
              />

              {/* Curve 2: NIP Blank Reference Channels (CH29-32 Matrix-Only Drift) */}
              <path
                d={buildNyquistPath(rctNipBlank)}
                fill="none"
                stroke="#A855F7"
                strokeWidth="2"
                strokeDasharray="6 3"
              />

              {/* Curve 3: Raw Uncompensated MIP Working Channel */}
              <path
                d={buildNyquistPath(rctMeasured)}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2.5"
              />

              {/* Curve 4: Inverse Edge-AI De-Embedded Pure PFAS Signal */}
              <path
                d={buildNyquistPath(rctPurified)}
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
              />

              {/* Legend */}
              <rect x="60" y="22" width="268" height="72" rx="6" fill="#0B1D30" stroke="#1E3A5F" />
              <line x1="68" y1="35" x2="88" y2="35" stroke="#64748B" strokeWidth="2" strokeDasharray="3 3" />
              <text x="94" y="38" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono">
                0.0 ppt Blank Baseline (Rct = 180 Ω)
              </text>
              <line x1="68" y1="50" x2="88" y2="50" stroke="#A855F7" strokeWidth="2" strokeDasharray="4 2" />
              <text x="94" y="53" fill="#D8B4FE" fontSize="9" fontFamily="JetBrains Mono">
                CH29–32 NIP Blank Drift (ΔRct = {signal.nipBlankDeltaRct} Ω)
              </text>
              <line x1="68" y1="65" x2="88" y2="65" stroke="#F59E0B" strokeWidth="2.5" />
              <text x="94" y="68" fill="#FCD34D" fontSize="9" fontFamily="JetBrains Mono">
                Raw Uncompensated MIP (ΔRct = {signal.measuredDeltaRct} Ω)
              </text>
              <line x1="68" y1="80" x2="88" y2="80" stroke="#10B981" strokeWidth="2.5" />
              <text x="94" y="83" fill="#6EE7B7" fontSize="9" fontFamily="JetBrains Mono">
                Inverse Edge-AI Purified (ΔRct = {signal.purifiedDeltaRct} Ω)
              </text>
            </svg>
          </div>

          {/* Physical Electrochemistry Telemetry Strip (Debye Length, Amine Protonation, NIP Subtraction) */}
          <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px]">
            <div className="bg-[#061320] border border-slate-800 rounded-lg p-2">
              <span className="text-slate-400 block text-[9.5px]">DEBYE LENGTH (κ⁻¹)</span>
              <span className="text-cyan-300 font-bold">{signal.debyeLengthNm} nm</span>
            </div>
            <div className="bg-[#061320] border border-slate-800 rounded-lg p-2">
              <span className="text-slate-400 block text-[9.5px]">-NH₃⁺ PROTONATION</span>
              <span className="text-purple-300 font-bold">{signal.amineProtonationPct}%</span>
            </div>
            <div className="bg-[#061320] border border-slate-800 rounded-lg p-2">
              <span className="text-slate-400 block text-[9.5px]">NIP SUBTRACTED</span>
              <span className="text-emerald-300 font-bold">{signal.nipBlankDeltaRct} Ω</span>
            </div>
          </div>

          {/* Interactive Matrix Interference Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#061320] p-3.5 rounded-xl border border-slate-800">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">True Spiked {selectedSpecies}:</span>
                <span className="font-mono font-bold text-cyan-300">{truePpt.toFixed(1)} ppt</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={25}
                step={0.5}
                value={truePpt}
                onChange={(e) => setTruePpt(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Humic Acid / NOM Interferent:</span>
                <span className="font-mono font-bold text-amber-300">{nomMgL.toFixed(1)} mg/L</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={8.0}
                step={0.5}
                value={nomMgL}
                onChange={(e) => setNomMgL(Number(e.target.value))}
                className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">YSI Water pH:</span>
                <span className="font-mono font-bold text-slate-200">{pH.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={5.5}
                max={9.0}
                step={0.1}
                value={pH}
                onChange={(e) => setPH(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">WTW Temperature:</span>
                <span className="font-mono font-bold text-slate-200">{tempC}°C</span>
              </div>
              <input
                type="range"
                min={5}
                max={32}
                step={1}
                value={tempC}
                onChange={(e) => setTempC(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">YSI Conductivity:</span>
                <span className="font-mono font-bold text-slate-200">
                  {conductivityUsCm} μS/cm
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={1200}
                step={20}
                value={conductivityUsCm}
                onChange={(e) => setConductivityUsCm(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">WTW Turbidity:</span>
                <span className="font-mono font-bold text-slate-200">{turbidityNTU} NTU</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={10.0}
                step={0.1}
                value={turbidityNTU}
                onChange={(e) => setTurbidityNTU(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded"
              />
            </div>
          </div>

          {/* Comparison Readout: Raw Sensor vs Inverse Edge AI Matrix Compensation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-amber-950/25 border border-amber-500/40 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-amber-300 block">
                Without Inverse Edge AI
              </span>
              <div className="text-xl font-bold font-mono text-amber-200 mt-0.5">
                {signal.uncompensatedPpt} ppt
              </div>
              <span className="text-[11px] font-mono text-amber-400">
                Matrix Drift Error: {signal.uncompensatedErrorPct}%
              </span>
            </div>

            <div className="bg-emerald-950/25 border border-emerald-500/40 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-emerald-300 block">
                NIP + Sonde + 4×4 Deconvolved
              </span>
              <div className="text-xl font-bold font-mono text-emerald-200 mt-0.5">
                {signal.edgeAiCompensatedPpt} ppt
              </div>
              <span className="text-[11px] font-mono text-emerald-400">
                Residual Calibration Error: {signal.edgeAiErrorPct}% (Non-Circular)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pin-Level Embedded Hardware Signal Chain & Empirical EPA Method 533 Validation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Embedded Potentiostat & Edge NPU Hardware Block Schematic */}
        <div className="lg:col-span-6 bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CircuitBoard className="w-4 h-4 text-cyan-400" />
                Embedded Potentiostat &amp; Edge NPU Signal Chain (Pin-Level Architecture)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete analog-to-cloud signal path inside the $148 NEMA 4X Reusable Reader Pod
              </p>
            </div>
            <span className="text-[10px] font-mono bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
              AD5940 + Cortex-M33
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="bg-[#061320] border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between font-mono text-[11px] text-cyan-300 font-bold">
                <span>STAGE 1 • 32-CH MULTIPLEXER &amp; ELECTROCHEMICAL CELL</span>
                <span>ADG732BSUZ (R_on = 4.0 Ω)</span>
              </div>
              <p className="text-slate-300 mt-1 text-[11px] leading-relaxed">
                Spring-loaded gold pogo-pins mate with the snap-in $11.80 cartridge. Dual 32:1
                low-capacitance CMOS multiplexers sequentially route Working Electrodes WE01–WE28
                (MIP C4/C8) and WE29–WE32 (NIP Blank) against shared Ag/AgCl Reference &amp; Pt Counter
                electrodes.
              </p>
            </div>

            <div className="bg-[#061320] border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between font-mono text-[11px] text-amber-300 font-bold">
                <span>STAGE 2 • IMPEDANCE ANALOG FRONT-END (EIS / DPV)</span>
                <span>Analog Devices AD5940 (SPI 16 MHz)</span>
              </div>
              <p className="text-slate-300 mt-1 text-[11px] leading-relaxed">
                Applies 10 mV RMS sinusoidal excitation across 0.1 Hz – 200 kHz over a +0.22 V DC bias
                ([Fe(CN)₆]³⁻/⁴⁻ formal potential). Ultra-low-leakage programmable Transimpedance
                Amplifier (TIA) + 16-bit 800 kSPS ADC + hardware Discrete Fourier Transform (DFT)
                engine outputs real (Z&apos;) and imaginary (-Z&apos;&apos;) impedance vectors.
              </p>
            </div>

            <div className="bg-[#061320] border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between font-mono text-[11px] text-emerald-300 font-bold">
                <span>STAGE 3 • EDGE AI NPU &amp; XYLEM VUE TELEMETRY BRIDGE</span>
                <span>STM32U5 / Cortex-M33 + RS-485 Modbus</span>
              </div>
              <p className="text-slate-300 mt-1 text-[11px] leading-relaxed">
                Polls Xylem YSI / WTW sonde (pH, Temp, Cond, Turbidity) over isolated RS-485 Modbus
                RTU, executes the Two-Stage Inverse De-Embedding neural matrix in &lt;4.2 ms, and
                streams signed OPC-UA / MQTT JSON packets to Xylem Vue powered by GoAigua.
              </p>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: In-Silico Multi-Matrix Calibration Stress Test vs. Target EPA Method 533 */}
        <div className="lg:col-span-6 bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-emerald-400" />
                In-Silico Multi-Matrix Calibration Stress Test (Target EPA 533 Reference)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Non-circular forward/inverse simulation across 5 water matrices (MAE: ~4.5%)
              </p>
            </div>
            <span className="text-[10px] font-mono bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
              TRL 3 Simulation Benchmark
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                  <th className="py-2 px-2">Simulated Water Matrix &amp; Conditions</th>
                  <th className="py-2 px-2 text-right">True Spike</th>
                  <th className="py-2 px-2 text-right">Raw Sensor</th>
                  <th className="py-2 px-2 text-right">Calibrated Edge</th>
                  <th className="py-2 px-2 text-right">Sim Recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {EMPIRICAL_MATRIX_VALIDATION_BENCHMARKS.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#10263F]/40">
                    <td className="py-2 px-2">
                      <div className="font-semibold text-white">{row.matrixName}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {row.matrixConditions}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-cyan-300 font-bold">
                      {row.epaMethod533Ppt.toFixed(2)} ppt
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-amber-400">
                      {row.uncompensatedSensorPpt.toFixed(2)} ppt
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-emerald-300 font-bold">
                      {row.pfasSentinelEdgeAiPpt.toFixed(2)} ppt
                    </td>
                    <td className="py-2 px-2 text-right font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {row.recoveryPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 32-Channel Multiplexed Array & 4x4 Cross-Selectivity Deconvolution Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Columns: 32-Channel Multiplexed Electrode Array & 4x4 Selectivity Matrix */}
        <div className="lg:col-span-6 bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                32-Ch Multiplexed Array &amp; 4×4 Cross-Selectivity Deconvolution
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Unmixing C4 vs. C8 structural analogs (-COO⁻ / -SO₃⁻) via Tikhonov matrix inversion + 4 NIP channels
              </p>
            </div>
            <span className="text-[10px] font-mono bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
              Target CV &lt; 5%
            </span>
          </div>

          <div className="grid grid-cols-8 gap-1.5 bg-[#061320] p-3 rounded-xl border border-slate-800">
            {Array.from({ length: 32 }, (_, idx) => {
              const ch = idx + 1;
              const group =
                ch <= 7
                  ? { label: 'PFBA', color: '#F59E0B', sub: 'C4-COO⁻' }
                  : ch <= 14
                  ? { label: 'PFBS', color: '#A855F7', sub: 'C4-SO₃⁻' }
                  : ch <= 21
                  ? { label: 'PFOA', color: '#EF4444', sub: 'C8-COO⁻' }
                  : ch <= 28
                  ? { label: 'PFOS', color: '#00B4D8', sub: 'C8-SO₃⁻' }
                  : { label: 'NIP', color: '#10B981', sub: 'BLANK' };
              const isHighlighted = group.label === selectedSpecies || group.label === 'NIP';
              return (
                <div
                  key={ch}
                  className={`p-1.5 rounded border text-center font-mono transition-all ${
                    isHighlighted
                      ? 'bg-[#10263F] border-cyan-500/50 shadow-sm'
                      : 'bg-[#0B1D30]/60 border-slate-800 opacity-75'
                  }`}
                >
                  <div className="text-[9px] text-slate-400">CH{ch < 10 ? `0${ch}` : ch}</div>
                  <div className="text-[10px] font-bold" style={{ color: group.color }}>
                    {group.label}
                  </div>
                  <div className="text-[7.5px] text-slate-300">{group.sub}</div>
                </div>
              );
            })}
          </div>

          {/* 4x4 Cross-Selectivity Matrix S Table */}
          <div className="mt-3 bg-[#061320] border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300 font-bold mb-1.5">
              <span>4×4 MIP CROSS-REACTIVITY MATRIX S (c_hat = (SᵀS + λI)⁻¹ Sᵀ ΔR_purified)</span>
              <span className="text-emerald-300">8–15% Bleed Resolved</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[10px]">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="py-1">Imprinted Cavity Group</th>
                    <th className="py-1 text-right">PFBA (C4)</th>
                    <th className="py-1 text-right">PFBS (C4)</th>
                    <th className="py-1 text-right">PFOA (C8)</th>
                    <th className="py-1 text-right">PFOS (C8)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {MIP_CROSS_SELECTIVITY_MATRIX.map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-1 text-slate-200">{row.channelGroup}</td>
                      <td className="py-1 text-right text-amber-300">{row.affinityWeights.PFBA.toFixed(2)}</td>
                      <td className="py-1 text-right text-purple-300">{row.affinityWeights.PFBS.toFixed(2)}</td>
                      <td className="py-1 text-right text-rose-300">{row.affinityWeights.PFOA.toFixed(2)}</td>
                      <td className="py-1 text-right text-cyan-300">{row.affinityWeights.PFOS.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 6 Columns: 5 Literature Synthesis Pillars */}
        <div className="lg:col-span-6 bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Peer-Reviewed Hardware &amp; Kinetic Synthesis Pillars
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Grounding our TRL 3 system design in published electrochemical &amp; filtration literature
            </p>
          </div>

          <div className="space-y-2.5">
            {RESEARCH_SYNTHESIS_PILLARS.map((pillar, i) => (
              <div
                key={i}
                className="bg-[#061320] border border-slate-800 rounded-lg p-3 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300">{pillar.institution}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {pillar.year}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">{pillar.technologyFocus}</p>
                <p className="text-[11px] font-mono text-emerald-400">
                  → {pillar.pfasSentinelIntegration}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Bill of Materials (BOM) & Unit Economics */}
      <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-cyan-400" />
              Hardware Bill of Materials (BOM) — &quot;Razor-and-Blade&quot; Cartridge Architecture
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Replacing $350–$500 centralized LC-MS/MS lab assays (14-day delay) with an $11.80
              indexed cartridge and $148 reusable in-line reader pod
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#061320] px-3 py-1.5 rounded-lg border border-cyan-500/30 text-xs font-mono">
              <span className="text-slate-400">Disposable Cartridge BOM: </span>
              <strong className="text-cyan-300">${disposableCost.toFixed(2)} / unit</strong>
            </div>
            <div className="bg-[#061320] px-3 py-1.5 rounded-lg border border-emerald-500/30 text-xs font-mono">
              <span className="text-slate-400">Reusable In-Line Pod BOM: </span>
              <strong className="text-emerald-300">${readerPodCost.toFixed(2)} / node</strong>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[11px]">
                <th className="py-2.5 px-3">Subsystem</th>
                <th className="py-2.5 px-3">Component</th>
                <th className="py-2.5 px-3">Engineering Specification</th>
                <th className="py-2.5 px-3">Commercial Role</th>
                <th className="py-2.5 px-3 text-right">Unit BOM (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {HARDWARE_BOM.map((item, index) => (
                <tr key={index} className="hover:bg-[#10263F]/50">
                  <td className="py-2.5 px-3 font-medium text-cyan-300">{item.subsystem}</td>
                  <td className="py-2.5 px-3 font-semibold text-white">{item.component}</td>
                  <td className="py-2.5 px-3 text-slate-300">{item.specification}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                        item.lifecycleRole.includes('Disposable')
                          ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {item.lifecycleRole}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                    ${item.unitCostUsd.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
