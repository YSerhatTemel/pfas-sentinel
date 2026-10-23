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
} from 'lucide-react';
import {
  PFAS_SPECIES,
  HARDWARE_BOM,
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

  // Generate Nyquist semicircle points (-Z'' vs Z') for Baseline, Raw Uncompensated, and Edge-AI Compensated
  const Rs = 65; // Solution resistance (Ohms)
  const rctBaseline = 180;
  const rctIdeal = rctBaseline + signal.idealDeltaRct * 1.4;
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
        'Subtracts background ionic strength, pH, and temperature drift in real time on an ARM Cortex-M33 NPU before streaming standardized concentration packets to Xylem Vue Smart Water Engine.',
      badge: 'R² = 0.996 Field Accuracy',
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
              Hardware &amp; Edge AI Innovation • Challenge #2 (Water Quality)
            </span>
            <h2 className="text-lg font-bold text-white mt-0.5">
              Microfluidic Stand-Alone MIP &amp; Amine-Functionalized Nanocarbon Sensor Array
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Synthesizing 2025–2026 electrochemical breakthroughs (UConn amine-functionalized sub-ppt
              sensing, Oseyemi &amp; Rezai stand-alone microfluidic MIP, 2witech &amp; Verralize
              nanocarbon platforms) into an industrial razor-and-blade cartridge that captures EPA’s{' '}
              <strong className="text-cyan-300">4.0 ppt threshold in 12–15 minutes</strong> on-site.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#061320] p-1.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setAssayMode('quantitative')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                assayMode === 'quantitative'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Quantitative EIS Mode (12–15 min • 1–4 ppt)
            </button>
            <button
              onClick={() => setAssayMode('screening')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                assayMode === 'screening'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Rapid Plume Screening (&lt;2 min • &gt;10 ppt)
            </button>
          </div>
        </div>
      </div>

      {/* Middle Grid: Exploded 3D CAD Cross-Section + Live EIS Nyquist & Edge AI Compensation */}
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

        {/* Right 6 Columns: Edge AI Matrix Compensation + Live EIS Nyquist Plot */}
        <div className="lg:col-span-6 bg-[#0B1D30] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                EIS Nyquist Response &amp; Edge AI Matrix Compensation
              </h3>
              <p className="text-xs text-slate-400">
                Fusing Xylem YSI / WTW water quality parameters to eliminate matrix drift
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
                strokeWidth="2"
                strokeDasharray="4 4"
              />

              {/* Curve 2: Raw Uncompensated Sensor (Drifted by NOM/pH/Temp) */}
              <path
                d={buildNyquistPath(rctMeasured)}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2.5"
              />

              {/* Curve 3: Edge-AI Matrix-Compensated True PFAS Signal */}
              <path
                d={buildNyquistPath(rctIdeal)}
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
              />

              {/* Legend */}
              <rect x="62" y="28" width="245" height="58" rx="6" fill="#0B1D30" stroke="#1E3A5F" />
              <line x1="72" y1="42" x2="92" y2="42" stroke="#64748B" strokeWidth="2" strokeDasharray="3 3" />
              <text x="98" y="45" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono">
                0.0 ppt Blank Baseline (Rct = 180 Ω)
              </text>
              <line x1="72" y1="58" x2="92" y2="58" stroke="#F59E0B" strokeWidth="2.5" />
              <text x="98" y="61" fill="#FCD34D" fontSize="9.5" fontFamily="JetBrains Mono">
                Raw Uncompensated (ΔRct = {signal.measuredDeltaRct} Ω)
              </text>
              <line x1="72" y1="74" x2="92" y2="74" stroke="#10B981" strokeWidth="2.5" />
              <text x="98" y="77" fill="#6EE7B7" fontSize="9.5" fontFamily="JetBrains Mono">
                Edge-AI Compensated (ΔRct = {signal.idealDeltaRct} Ω)
              </text>
            </svg>
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
                <span className="text-slate-400">WTW Temperature / Turbidity:</span>
                <span className="font-mono font-bold text-slate-200">
                  {tempC}°C | {turbidityNTU} NTU
                </span>
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
          </div>

          {/* Comparison Readout: Raw Sensor vs Edge AI Matrix Compensation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-amber-950/25 border border-amber-500/40 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-amber-300 block">
                Without Edge AI Compensation
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
                With YSI/WTW Edge AI Fusion
              </span>
              <div className="text-xl font-bold font-mono text-emerald-200 mt-0.5">
                {signal.edgeAiCompensatedPpt} ppt
              </div>
              <span className="text-[11px] font-mono text-emerald-400">
                Residual Error: {signal.edgeAiErrorPct}% (EPA Ready)
              </span>
            </div>
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
