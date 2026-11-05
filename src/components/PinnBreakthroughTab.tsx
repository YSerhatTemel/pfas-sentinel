import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Cpu, FlaskConical, Sliders, TrendingUp } from 'lucide-react';
import {
  FacilityProfile,
  LAST_OBSERVATION_DAY,
  PFAS_SPECIES,
  PUBLISHED_LITERATURE_BREAKTHROUGH_BENCHMARKS,
  SPECIES_ORDER,
  TARGET_PPT,
  TRAIN_DAYS,
  getValidationFit,
  pdeResidualRms,
  plantSpecFor,
  staticPriorConcentration,
  truthConcentration,
  twinConcentration,
} from '../data/pfasPhysicsEngine';
import type { SpeciesId } from '../data/pfasPhysicsEngine';
import validationReport from '../../simulation/validation_report.json';
import { ExternalValidationCard } from './ExternalValidationCard';
import { FullScaleCheckCard } from './FullScaleCheckCard';

interface PinnBreakthroughTabProps {
  facility: FacilityProfile;
  operatingDay: number;
  setOperatingDay: (d: number) => void;
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const TRAIN_END = TRAIN_DAYS[TRAIN_DAYS.length - 1];
const fmtDay = (d: number) => (d >= 1500 ? '>1500' : `${r1(d)}`);

export const PinnBreakthroughTab: React.FC<PinnBreakthroughTabProps> = ({ facility, operatingDay, setOperatingDay }) => {
  const [focusSpecies, setFocusSpecies] = useState<SpeciesId>('PFOA');
  const [customC0, setCustomC0] = useState<number>(facility.influentProfile.PFOA);
  const [customFlowMGD, setCustomFlowMGD] = useState<number>(facility.flowRateMGD);
  const [customMassKg, setCustomMassKg] = useState<number>(facility.mediaMassKg);
  const [customNom, setCustomNom] = useState<number>(facility.matrixDefaults.nomMgL);
  const [showStatic, setShowStatic] = useState<boolean>(true);
  const [includeRollup, setIncludeRollup] = useState<boolean>(true);
  const [showObservations, setShowObservations] = useState<boolean>(true);
  const [showTestbench, setShowTestbench] = useState<boolean>(true);
  const [experimental, setExperimental] = useState<boolean>(false);

  useEffect(() => {
    setCustomC0(facility.influentProfile[focusSpecies]);
    setCustomFlowMGD(facility.flowRateMGD);
    setCustomMassKg(facility.mediaMassKg);
    setCustomNom(facility.matrixDefaults.nomMgL);
  }, [facility.id]);

  const plant = plantSpecFor(facility, {
    flowRateMGD: customFlowMGD,
    mediaMassKg: customMassKg,
    nomMgL: customNom,
    includeRollup,
    c0Override: { [focusSpecies]: customC0 },
  });
  const fit = getValidationFit(plant, experimental);
  const res = fit.species[focusSpecies];
  const pde = pdeResidualRms(plant, fit.theta);
  const speciesConfig = PFAS_SPECIES[focusSpecies];

  const daysArray = Array.from({ length: 81 }, (_, i) => i * 5);
  const chartWidth = 640;
  const chartHeight = 230;
  const padLeft = 52;
  const padTop = 20;
  const peakTruth = Math.max(...daysArray.map((d) => truthConcentration(plant, focusSpecies, 1, d)));
  const maxY = Math.max(35, customC0 * 1.1, peakTruth * 1.05);
  const toX = (day: number) => padLeft + (Math.min(400, day) / 400) * (chartWidth - padLeft - 20);
  const toY = (ppt: number) => padTop + chartHeight - (Math.min(maxY, ppt) / maxY) * chartHeight;
  const path = (fn: (d: number) => number) =>
    daysArray.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(d).toFixed(1)} ${toY(fn(d)).toFixed(1)}`).join(' ');

  const twinMid = (d: number) => twinConcentration(fit, focusSpecies, 0.5, d);
  const twinOut = (d: number) => twinConcentration(fit, focusSpecies, 1, d);
  const staticOut = (d: number) => staticPriorConcentration(plant, focusSpecies, 1, d);
  const truthOut = (d: number) => truthConcentration(plant, focusSpecies, 1, d);

  const advanceWarningDays = r1(res.effluent4PptDay - res.midBed4PptDay);
  const twinError = r1(res.effluent4PptDay - res.testbenchEffluent4PptDay);
  const staticError = r1(res.staticEffluent4PptDay - res.testbenchEffluent4PptDay);
  const peakRollupPct = Math.round((peakTruth / Math.max(1, customC0)) * 100);

  const ablation = validationReport.ablation as Record<
    string,
    { allSpecies: { maeDays: number; biasDays: number; p90AbsDays: number }; pfoaPfos: { maeDays: number; maxAbsDays: number } }
  >;
  const unc = validationReport.uncertainty;
  const ops = validationReport.operational;
  const historyCards = fit.history.filter((h) => [1, 50, 100, 150, 200, 250].includes(h.epoch));

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#0B1D30] border border-cyan-500/30 rounded-xl p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-2">
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Breakthrough Twin Lab • validation protocol on a synthetic testbench
            </span>
            <h2 className="text-lg font-bold text-white">Physics-based breakthrough twin with shared bed-condition assimilation</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              A hidden <strong className="text-white">virtual plant</strong> (NOM fouling that differs by species, a
              breakthrough shape the model does not have, roll-up and sensor-grade noise) generates mid-bed and outlet
              data. In this testbench the twin starts from vendor (clean-water) values that are off by a bed condition
              mostly shared across species — the case the twin is built for — and learns two shared bed-condition factors
              from the <strong className="text-amber-300">mid-bed data of all four species up to day {TRAIN_END}</strong>. Because PFBA and
              PFBS reach the mid-bed first, their data inform the slower <strong className="text-rose-300">PFOA/PFOS</strong> forecast.
              Days 155–{LAST_OBSERVATION_DAY} are held out; later days are extrapolation.
            </p>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              Real clean-water isotherms are much further off than this, and differently for each species (external check at
              the bottom of this tab). At a real site the starting values must come from site water: an RSSCT, a pilot or
              the previous bed. On full-scale data the twin's 4 ng/L outlet forecast was still late (external check 2).
            </p>
          </div>
          <div className="lg:col-span-5 bg-[#061320] border border-cyan-500/40 rounded-xl p-4 font-mono text-center">
            <div className="text-[11px] text-cyan-300 mb-1 uppercase tracking-wider">Model &amp; loss</div>
            <div className="text-xs font-bold text-white py-2 px-2.5 bg-[#0B1D30] rounded-lg border border-slate-800">
              Ĉ(z,t) = C₀·σ(−ξ) [+ G·N_W]  •  ξ = k·q·M·z/Q − k·C₀·t
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              σ(−ξ) is the travelling-wave solution of ∂C/∂t + u·∂C/∂z = 0 (u = Q·C₀/(q·M)); k, q share e^φ across species
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 text-[11px] text-slate-400">
              <div>
                <span className="text-cyan-300 font-bold">k / k_prior:</span> {r2(res.learnedKth / res.priorKth)}
              </div>
              <div>
                <span className="text-emerald-300 font-bold">q / q_prior:</span> {r2(res.learnedQ0 / res.priorQ0)}
              </div>
              <div>
                <span className="text-amber-300 font-bold">Band:</span> ±{r1(res.uncertaintyBandDays)} d
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart */}
        <div className="lg:col-span-8 bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Mid-bed (z/L = 0.50) and outlet (z/L = 1.00) breakthrough
              </h3>
              <p className="text-xs text-slate-400">
                Points are synthetic observations from the testbench (not LC-MS/MS data). {experimental ? 'PINN-style option ON.' : ''}
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-[#061320] p-1 rounded-lg border border-slate-800">
              {SPECIES_ORDER.map((sp) => (
                <button
                  key={sp}
                  onClick={() => {
                    setFocusSpecies(sp);
                    setCustomC0(facility.influentProfile[sp]);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                    focusSpecies === sp ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#061320] border border-slate-800 rounded-xl p-3">
            <svg viewBox="0 0 660 285" className="w-full h-auto select-none" aria-label="Breakthrough curves">
              {/* Train / test / extrapolation regions */}
              <rect x={toX(0)} y={padTop} width={toX(TRAIN_END) - toX(0)} height={chartHeight} fill="#0EA5E9" opacity="0.05" />
              <rect x={toX(TRAIN_END)} y={padTop} width={toX(LAST_OBSERVATION_DAY) - toX(TRAIN_END)} height={chartHeight} fill="#A855F7" opacity="0.07" />
              <rect x={toX(LAST_OBSERVATION_DAY)} y={padTop} width={toX(400) - toX(LAST_OBSERVATION_DAY)} height={chartHeight} fill="#F59E0B" opacity="0.05" />
              <text x={toX(TRAIN_END / 2)} y={padTop - 6} textAnchor="middle" fill="#38BDF8" fontSize="8.5" fontFamily="JetBrains Mono">
                TRAIN (mid-bed ≤ day {TRAIN_END})
              </text>
              <text x={(toX(TRAIN_END) + toX(LAST_OBSERVATION_DAY)) / 2} y={padTop - 6} textAnchor="middle" fill="#D8B4FE" fontSize="8.5" fontFamily="JetBrains Mono">
                TEST
              </text>
              <text x={(toX(LAST_OBSERVATION_DAY) + toX(400)) / 2} y={padTop - 6} textAnchor="middle" fill="#FCD34D" fontSize="8.5" fontFamily="JetBrains Mono">
                EXTRAPOLATION (no data)
              </text>

              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const val = Math.round(maxY * frac);
                const y = toY(val);
                return (
                  <g key={frac}>
                    <line x1={padLeft} y1={y} x2={chartWidth - 20} y2={y} stroke="#1E293B" strokeDasharray="3 3" />
                    <text x={padLeft - 8} y={y + 3} textAnchor="end" fill="#64748B" fontSize="9.5" fontFamily="JetBrains Mono">
                      {val} ppt
                    </text>
                  </g>
                );
              })}
              {[0, 50, 100, 150, 200, 250, 300, 350, 400].map((d) => (
                <text key={d} x={toX(d)} y={padTop + chartHeight + 16} textAnchor="middle" fill="#64748B" fontSize="9.5" fontFamily="JetBrains Mono">
                  Day {d}
                </text>
              ))}

              <line x1={padLeft} y1={toY(TARGET_PPT)} x2={chartWidth - 20} y2={toY(TARGET_PPT)} stroke="#EF4444" strokeWidth="1.6" strokeDasharray="6 3" />
              <text x={chartWidth - 24} y={toY(TARGET_PPT) - 5} textAnchor="end" fill="#FCA5A5" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">
                {speciesConfig.id === 'PFOA' || speciesConfig.id === 'PFOS' ? 'Lead-outlet trigger = 4.0 ppt (MCL level)' : '4.0 ppt tracer level (no actuation)'}
              </text>
              <line x1={toX(operatingDay)} y1={padTop} x2={toX(operatingDay)} y2={padTop + chartHeight} stroke="#38BDF8" strokeWidth="1.2" />

              {showTestbench && <path d={path(truthOut)} fill="none" stroke="#E2E8F0" strokeWidth="1.2" strokeDasharray="1 3" />}
              {showStatic && <path d={path(staticOut)} fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="4 4" />}
              <path d={path(twinMid)} fill="none" stroke="#F59E0B" strokeWidth="2.5" />
              <path d={path(twinOut)} fill="none" stroke="#10B981" strokeWidth="3" />

              {showObservations &&
                res.points.map((pt) => (
                  <g key={pt.day}>
                    {pt.split === 'TEST' && <circle cx={toX(pt.day)} cy={toY(pt.observedMidBedPpt)} r="6.5" fill="none" stroke="#A855F7" strokeWidth="1.2" />}
                    <circle cx={toX(pt.day)} cy={toY(pt.observedMidBedPpt)} r="3.5" fill="#061320" stroke="#FBBF24" strokeWidth="2" />
                    <circle cx={toX(pt.day)} cy={toY(pt.observedEffluentPpt)} r="3.5" fill="#061320" stroke="#34D399" strokeWidth="2" />
                  </g>
                ))}

              <rect x={padLeft + 8} y={padTop + 6} width="300" height="88" rx="6" fill="#0B1D30" stroke="#1E3A5F" />
              <line x1={padLeft + 16} y1={padTop + 20} x2={padLeft + 36} y2={padTop + 20} stroke="#F59E0B" strokeWidth="2.5" />
              <text x={padLeft + 42} y={padTop + 23} fill="#FDE68A" fontSize="9" fontFamily="JetBrains Mono">
                Twin, mid-bed (4 ppt @ day {fmtDay(res.midBed4PptDay)})
              </text>
              <line x1={padLeft + 16} y1={padTop + 35} x2={padLeft + 36} y2={padTop + 35} stroke="#10B981" strokeWidth="3" />
              <text x={padLeft + 42} y={padTop + 38} fill="#6EE7B7" fontSize="9" fontFamily="JetBrains Mono">
                Twin, outlet (day {fmtDay(res.effluent4PptDay)} ±{r1(res.uncertaintyBandDays)})
              </text>
              <line x1={padLeft + 16} y1={padTop + 50} x2={padLeft + 36} y2={padTop + 50} stroke="#94A3B8" strokeWidth="2" strokeDasharray="3 3" />
              <text x={padLeft + 42} y={padTop + 53} fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono">
                Static vendor curve (day {fmtDay(res.staticEffluent4PptDay)})
              </text>
              <line x1={padLeft + 16} y1={padTop + 65} x2={padLeft + 36} y2={padTop + 65} stroke="#E2E8F0" strokeWidth="1.2" strokeDasharray="1 3" />
              <text x={padLeft + 42} y={padTop + 68} fill="#E2E8F0" fontSize="9" fontFamily="JetBrains Mono">
                Hidden testbench plant (day {fmtDay(res.testbenchEffluent4PptDay)})
              </text>
              <circle cx={padLeft + 26} cy={padTop + 81} r="3.5" fill="#061320" stroke="#34D399" strokeWidth="2" />
              <text x={padLeft + 42} y={padTop + 84} fill="#E2E8F0" fontSize="9" fontFamily="JetBrains Mono">
                Synthetic observations (ringed = held-out test)
              </text>
            </svg>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div className="bg-[#061320] border border-amber-500/30 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-amber-300 block">Mid-bed lead time</span>
              <div className="text-lg font-bold font-mono text-white mt-0.5">+{advanceWarningDays} days</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Same species: mid-bed 4 ppt → outlet 4 ppt</p>
            </div>
            <div className="bg-[#061320] border border-rose-500/30 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-rose-300 block">Outlet forecast error vs hidden plant</span>
              <div className="text-lg font-bold font-mono text-white mt-0.5">
                {twinError > 0 ? '+' : ''}
                {twinError} d <span className="text-xs text-slate-400">(static {staticError > 0 ? '+' : ''}{staticError} d)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {peakRollupPct > 102 ? `Testbench roll-up peak ${peakRollupPct}% of C₀ (flagged, not forecast).` : 'Negative = early (conservative).'}
              </p>
            </div>
            <div className="bg-[#061320] border border-emerald-500/30 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-emerald-300 block">Held-out test RMSE (days 155–210)</span>
              <div className="text-lg font-bold font-mono text-emerald-300 mt-0.5">
                {r2(res.testRmsePpt)} ppt <span className="text-xs text-slate-400">vs {r2(res.staticTestRmsePpt)} static</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Train RMSE {r2(res.trainRmsePpt)} ppt (mid-bed, days 30–{TRAIN_END})</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="lg:col-span-4 bg-[#0B1D30] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Plant &amp; testbench controls
              </h3>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                {fit.config.epochs} Adam epochs
              </span>
            </div>
            {[
              { label: `Influent ${focusSpecies} (C₀)`, value: `${customC0} ppt`, min: 10, max: 120, step: 1, v: customC0, set: setCustomC0 },
              { label: 'Flow rate (Q)', value: `${customFlowMGD} MGD`, min: 0.5, max: 5, step: 0.1, v: customFlowMGD, set: setCustomFlowMGD },
              { label: `${facility.mediaType} media mass (M)`, value: `${customMassKg.toLocaleString('en-US')} kg`, min: 2000, max: 20000, step: 200, v: customMassKg, set: setCustomMassKg },
              { label: 'Testbench NOM (hidden fouling driver)', value: `${customNom} mg/L`, min: 0.5, max: 6.5, step: 0.2, v: customNom, set: setCustomNom },
              { label: 'Day cursor (t)', value: `Day ${operatingDay}`, min: 10, max: 400, step: 1, v: operatingDay, set: setOperatingDay },
            ].map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">{c.label}:</span>
                  <span className="font-mono font-bold text-cyan-300">{c.value}</span>
                </div>
                <input
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={c.v}
                  onChange={(e) => c.set(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded"
                />
              </div>
            ))}
            <div className="space-y-1.5 pt-1 border-t border-slate-800/80 text-xs text-slate-300">
              {[
                { label: 'Short-chain roll-up in the testbench', v: includeRollup, set: setIncludeRollup },
                { label: 'Show synthetic observations', v: showObservations, set: setShowObservations },
                { label: 'Show static vendor curve', v: showStatic, set: setShowStatic },
                { label: 'Show hidden testbench plant', v: showTestbench, set: setShowTestbench },
                { label: 'PINN-style option: neural correction + PDE penalty', v: experimental, set: setExperimental },
              ].map((c) => (
                <label key={c.label} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={c.v} onChange={(e) => c.set(e.target.checked)} className="rounded accent-cyan-500" />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="bg-[#061320] border border-slate-800 rounded-xl p-3.5 space-y-2">
            <h4 className="text-xs font-mono uppercase text-slate-400">Outlet 4 ppt: twin vs hidden plant</h4>
            {SPECIES_ORDER.map((sp) => {
              const s = fit.species[sp];
              return (
                <div key={sp} className="flex items-center justify-between text-xs font-mono">
                  <span style={{ color: PFAS_SPECIES[sp].color }} className="font-bold">
                    {sp}
                  </span>
                  <span className="text-slate-200">
                    {fmtDay(s.effluent4PptDay)} ±{r1(s.uncertaintyBandDays)} <span className="text-slate-500">(plant {fmtDay(s.testbenchEffluent4PptDay)})</span>
                  </span>
                </div>
              );
            })}
            <button
              onClick={() => {
                const header = 'Day,Species,Twin_MidBed_ppt,Twin_Outlet_ppt,Static_Outlet_ppt,Testbench_Outlet_ppt\n';
                const rows = daysArray
                  .map((d) => `${d},${focusSpecies},${r2(twinMid(d))},${r2(twinOut(d))},${r2(staticOut(d))},${r2(truthOut(d))}`)
                  .join('\n');
                const blob = new Blob(['# Synthetic in-silico data (PFAS-Sentinel testbench)\n' + header + rows], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `pfas_sentinel_${facility.id}_${focusSpecies}_twin_curves.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="w-full py-2 px-3 rounded-lg bg-[#10263F] hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono text-xs font-semibold"
            >
              ↓ Export curves (.CSV)
            </button>
          </div>
        </div>
      </div>

      {/* Diagnostics and evidence */}
      <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              Assimilation diagnostics
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Exact analytical gradients (checked against finite differences in the test suite), Adam, weak prior on the
              bed-condition factors (±25%).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-[#061320] border border-slate-800 text-slate-300">
              q₀: {Math.round(res.priorQ0)} → <strong className="text-emerald-300">{Math.round(res.learnedQ0)}</strong>
            </span>
            <span className="px-2.5 py-1 rounded bg-[#061320] border border-slate-800 text-slate-300">
              k_Th: {res.priorKth.toFixed(5)} → <strong className="text-cyan-300">{res.learnedKth.toFixed(5)}</strong>
            </span>
            <span className="px-2.5 py-1 rounded bg-[#061320] border border-slate-800 text-slate-300">
              PDE residual RMS: adv {pde.adv.toExponential(1)} • kin {pde.kin.toExponential(1)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono">
          {historyCards.map((h) => (
            <div key={h.epoch} className="bg-[#061320] border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between text-[10px] text-cyan-400">
                <span>EPOCH {h.epoch}</span>
                {h.epoch === fit.config.epochs && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div className="text-sm font-bold text-white mt-1">L = {h.total.toExponential(2)}</div>
              <div className="text-[10px] text-slate-400 mt-1">data {h.data.toExponential(1)}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-3 border-t border-slate-800/80">
          <div className="bg-[#061320] border border-cyan-500/30 rounded-xl p-3.5 text-xs">
            <div className="font-mono font-bold text-cyan-300 uppercase mb-2 flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" /> Ablation (16 random plants)
            </div>
            <table className="w-full text-[11px] font-mono">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left font-normal">Model</th>
                  <th className="text-right font-normal">MAE all</th>
                  <th className="text-right font-normal">MAE PFOA/S</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(ablation).map(([name, v]) => (
                  <tr key={name} className={name.includes('default') ? 'text-emerald-300' : 'text-slate-300'}>
                    <td className="py-0.5">{name}</td>
                    <td className="text-right">{r1(v.allSpecies.maeDays)} d</td>
                    <td className="text-right">{r1(v.pfoaPfos.maeDays)} d</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-500 mt-2">
              Outlet 4 ppt day error vs the hidden plant. Joint fitting (the tracer idea) gives the big gain. The
              PINN-style network only helps with the PDE penalty and adds a small further gain, but forecasts a
              little later; the 2-parameter model stays the decision default.
            </p>
          </div>
          <div className="bg-[#061320] border border-purple-500/30 rounded-xl p-3.5 text-xs space-y-1">
            <div className="font-mono font-bold text-purple-300 uppercase mb-1">Uncertainty band check</div>
            <p className="text-slate-300">
              Nominal 95% band, model-form term calibrated on one set of synthetic plants (coverage{' '}
              {Math.round(unc.coverageCalibrationSet * 100)}%), checked on another:{' '}
              <strong className="text-white">{Math.round(unc.coverageHoldoutSet * 100)}% coverage</strong>.
            </p>
            <p className="text-slate-400">
              Without the model-form term only {Math.round(unc.coverageHoldoutParametricOnly * 100)}% — parametric
              uncertainty alone is overconfident. The band is a decision aid, not a certified interval.
            </p>
          </div>
          <div className="bg-[#061320] border border-emerald-500/30 rounded-xl p-3.5 text-xs space-y-1">
            <div className="font-mono font-bold text-emerald-300 uppercase mb-1">Operational decision test</div>
            <p className="text-slate-300">
              Daily simulation on {ops.plants} plants: the twin rotated a median{' '}
              <strong className="text-white">{Math.round(ops.twin.medianDays)} days</strong> before the PFOA/PFOS lead-outlet
              breach (range {Math.round(ops.twin.minDays)}–{Math.round(ops.twin.maxDays)}; target {ops.serviceLeadTimeDays}), never after it.
            </p>
            <p className="text-slate-400">
              A static vendor curve rotated after the breach in {ops.staticVendorCurve.afterBreach} of {ops.plants} plants.
            </p>
          </div>
        </div>

        <div className="bg-[#061320] border border-slate-800 rounded-xl p-3.5 text-xs space-y-1">
          <span className="font-mono font-bold text-cyan-300 uppercase">Data provenance</span>
          <p className="text-slate-300">
            All observations above are generated by the in-silico testbench in <code>src/data/hybridTwin.ts</code> (mirrored
            in <code>simulation/pfas_sentinel_core.py</code>). The qualitative trends from the studies below informed the
            testbench; no published data points were digitized. The only measured data in this tab are in the two external
            checks below: a U.S. EPA pilot (used as published) and a full-scale lead-lag plant with a mid-bed port (read
            from a public report's vector charts). Validation with the sensor itself at a utility is planned for TRL 4–6.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PUBLISHED_LITERATURE_BREAKTHROUGH_BENCHMARKS.map((lit) => (
            <div key={lit.studyCitation} className="bg-[#061320] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-cyan-300">{lit.studyCitation}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                  Literature anchor
                </span>
              </div>
              <div className="text-[11px] font-mono text-amber-300">{lit.mediaAndScale}</div>
              <p className="text-xs text-slate-300">{lit.keyEmpiricalFinding}</p>
              <p className="text-[11px] font-mono text-emerald-400">→ {lit.pinnModelAgreement}</p>
            </div>
          ))}
        </div>
      </div>

      <ExternalValidationCard />
      <FullScaleCheckCard />
    </div>
  );
};
