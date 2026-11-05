import React, { useState } from 'react';
import { CheckCircle2, Factory, XCircle } from 'lucide-react';
import fullScaleJson from '../../simulation/external_validation_fullscale.json';

type Primary = 'PFOA' | 'PFOS';
type Method = 'STATIC' | 'TWIN' | 'INDEPENDENT' | 'MIDBED_ONLY' | 'STATIC_ASYM' | 'TWIN_ASYM';

interface FullScaleReport {
  dataset: { influentNgL: Record<string, Record<string, number>> };
  cases: {
    source: number;
    target: number;
    cutoffKBV: number;
    display: null | {
      kBV: number[];
      curves: Record<'STATIC' | 'TWIN' | 'TWIN_ASYM', Record<Primary, number[]>>;
      observed: Record<Primary, Record<'halfway' | 'between', [number, number][]>>;
    };
  }[];
  summary: Record<string, Record<Method, number>> & {
    fourNgLPrimary: { forecasts: number; byMethod: Record<Method, { early: number; inside: number; late: number }> };
  };
  scalingCheck: Record<string, Record<string, { sym: { outletT50FromHalfwayKBV: number; outletT50FromBetweenKBV: number } }>>;
  postHocMidbedLead: Record<string, Record<string, { ratioToOutlet: number | null }>>;
}

const report = fullScaleJson as unknown as FullScaleReport;
const LABEL: Record<Method, string> = {
  STATIC: "Other site's curve, unchanged",
  TWIN: 'Twin (default, shared factors)',
  TWIN_ASYM: 'Twin, asymmetric curve',
  INDEPENDENT: 'Each species fitted alone',
  MIDBED_ONLY: 'Halfway-port data only, no prior',
  STATIC_ASYM: "Other site's asymmetric curve",
};
const ORDER: Method[] = ['STATIC', 'TWIN', 'TWIN_ASYM', 'INDEPENDENT', 'MIDBED_ONLY', 'STATIC_ASYM'];
const pct = (x: number) => `${Math.round(x * 100)}%`;

export const FullScaleCheckCard: React.FC = () => {
  const [species, setSpecies] = useState<Primary>('PFOS');
  const shown = report.cases.find((c) => c.display);
  if (!shown || !shown.display) return null;
  const disp = shown.display;
  const s = report.summary;
  const cut = Object.keys(s).filter((k) => k !== 'fourNgLPrimary').sort();
  const four = s.fourNgLPrimary;
  const ratios = Object.values(report.postHocMidbedLead).flatMap((site) =>
    (['PFOA', 'PFOS'] as const).map((sp) => site[sp]?.ratioToOutlet).filter((v): v is number => typeof v === 'number'),
  );
  const spread = Object.values(report.scalingCheck).flatMap((site) =>
    Object.values(site).map((v) => v.sym.outletT50FromHalfwayKBV / v.sym.outletT50FromBetweenKBV),
  );
  const twinRange = cut.map((k) => s[k].TWIN);
  const asymRange = cut.map((k) => s[k].TWIN_ASYM);

  const W = 600;
  const H = 210;
  const padL = 44;
  const padT = 14;
  const maxK = disp.kBV[disp.kBV.length - 1];
  const obs = disp.observed[species];
  const c0 = report.dataset.influentNgL[String(shown.target)][species];
  const maxY = Math.max(c0, ...obs.halfway.map((p) => p[1]), ...obs.between.map((p) => p[1])) * 1.1;
  const x = (k: number) => padL + (k / maxK) * (W - padL - 14);
  const y = (v: number) => padT + H - (Math.min(maxY, Math.max(0, v)) / maxY) * H;
  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(disp.kBV[i]).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const curveStyle = [
    { key: 'STATIC' as const, label: "Other site's curve", color: '#94a3b8', dash: '5 4' },
    { key: 'TWIN' as const, label: 'Twin', color: '#22d3ee', dash: undefined },
    { key: 'TWIN_ASYM' as const, label: 'Twin, asymmetric', color: '#a78bfa', dash: '2 3' },
  ];
  const xticks = Array.from({ length: Math.floor(maxK / 5) + 1 }, (_, i) => i * 5);

  return (
    <div id="fullscale-check" className="bg-[#0B1D30] border border-emerald-500/30 rounded-xl p-5 space-y-4 scroll-mt-44">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 max-w-3xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Factory className="w-4 h-4 text-emerald-400" />
            External check 2: full-scale lead-lag plant with a mid-bed port
          </h3>
          <p className="text-xs text-slate-400">
            Two full-scale lead-lag GAC trains of one water system, sampled weekly at the lead vessel&apos;s halfway port and
            between the vessels — the layout PFAS-Sentinel is designed for (Crew 2021, Penn State, doi:10.26207/qc55-h661,
            CC BY-SA 4.0). The report has charts only; the points were read from their vector drawing coordinates and checked
            against the author&apos;s stated values. The twin learns from the halfway port and forecasts the lead outlet, starting
            from the other site&apos;s curve. Protocol written before the data were extracted.
          </p>
        </div>
        <span className="text-[10px] font-mono px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
          Real data • full scale • mid-bed port
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#061320] border border-slate-800 rounded-xl p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-mono text-slate-400">
              Site {shown.target}, learning until {Math.round(shown.cutoffKBV * 1000).toLocaleString('en-US')} bed volumes
            </span>
            <div className="flex gap-1">
              {(['PFOA', 'PFOS'] as Primary[]).map((sp) => (
                <button
                  key={sp}
                  onClick={() => setSpecies(sp)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                    species === sp ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200' : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>
          <svg viewBox={`0 0 ${W} ${H + padT + 26}`} className="w-full h-auto" role="img" aria-label={`${species} at the halfway port and the lead outlet with forecasts`}>
            <rect x={padL} y={padT} width={x(shown.cutoffKBV) - padL} height={H} fill="#10b981" opacity={0.06} />
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line x1={padL} x2={W - 14} y1={y(f * maxY)} y2={y(f * maxY)} stroke="#1e293b" />
                <text x={padL - 6} y={y(f * maxY) + 3} textAnchor="end" fontSize={9} fill="#64748b">
                  {Math.round(f * maxY)}
                </text>
              </g>
            ))}
            {xticks.map((k) => (
              <text key={k} x={x(k)} y={padT + H + 14} textAnchor="middle" fontSize={9} fill="#64748b">
                {k === 0 ? '0 BV' : `${k}k`}
              </text>
            ))}
            <line x1={padL} x2={W - 14} y1={y(4)} y2={y(4)} stroke="#f43f5e" strokeDasharray="3 3" />
            <text x={W - 16} y={y(4) - 3} textAnchor="end" fontSize={9} fill="#fb7185">
              4 ng/L
            </text>
            <line x1={x(shown.cutoffKBV)} x2={x(shown.cutoffKBV)} y1={padT} y2={padT + H} stroke="#10b981" strokeDasharray="2 3" />
            <text x={x(shown.cutoffKBV) + 4} y={padT + 9} fontSize={9} fill="#34d399">
              cut-off
            </text>
            {curveStyle.map((c) => (
              <path key={c.key} d={path(disp.curves[c.key][species])} fill="none" stroke={c.color} strokeWidth={c.key === 'TWIN' ? 2 : 1.6} strokeDasharray={c.dash} />
            ))}
            {obs.halfway.map(([k, v], i) => (
              <rect key={`h${i}`} x={x(k) - 2.2} y={y(v) - 2.2} width={4.4} height={4.4} fill={k <= shown.cutoffKBV ? '#f59e0b' : '#f59e0b55'} />
            ))}
            {obs.between.map(([k, v], i) => (
              <circle key={`b${i}`} cx={x(k)} cy={y(v)} r={2.6} fill="#061320" stroke="#e2e8f0" strokeWidth={1.1} />
            ))}
            <text x={padL} y={padT + H + 24} fontSize={9} fill="#64748b">
              ng/L vs bed volumes • squares = halfway port (learned up to the cut-off) • rings = lead outlet (forecast target)
            </text>
          </svg>
          <div className="flex flex-wrap gap-3 mt-1 text-[10px] font-mono">
            {curveStyle.map((c) => (
              <span key={c.key} className="flex items-center gap-1.5" style={{ color: c.color }}>
                <svg width="18" height="6" aria-hidden="true">
                  <line x1="0" x2="18" y1="3" y2="3" stroke={c.color} strokeWidth="2" strokeDasharray={c.dash} />
                </svg>
                {c.label} (lead outlet)
              </span>
            ))}
          </div>
        </div>

        <div className="bg-[#061320] border border-slate-800 rounded-xl p-3 text-xs">
          <div className="font-mono font-bold text-emerald-300 uppercase mb-2">PFOA + PFOS at the lead outlet, both directions</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left font-normal pb-1">Method</th>
                  <th className="text-right font-normal pb-1 pl-2">Later samples, cut-off 1/3 / 1/2</th>
                  <th className="text-right font-normal pb-1 pl-2">4 ng/L: in / early / late</th>
                </tr>
              </thead>
              <tbody>
                {ORDER.map((m) => (
                  <tr key={m} className={`border-t border-slate-800/70 ${m === 'TWIN' ? 'text-cyan-300' : m === 'TWIN_ASYM' ? 'text-violet-300' : 'text-slate-300'}`}>
                    <td className="py-1 pr-2">{LABEL[m]}</td>
                    <td className="py-1 pl-2 text-right whitespace-nowrap">{cut.map((k) => Math.round(s[k][m] * 100)).join(' / ')}%</td>
                    <td className="py-1 pl-2 text-right whitespace-nowrap">
                      {four.byMethod[m].inside} / {four.byMethod[m].early} / {four.byMethod[m].late}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Later samples: error on the lead-outlet samples after the cut-off, as % of mean influent. 4 ng/L: forecast day of the
            lead-outlet crossing against the observed sampling interval, in the {four.forecasts} cases still open at the cut-off.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="bg-[#061320] border border-emerald-500/30 rounded-xl p-3.5 space-y-2">
          <div className="font-mono font-bold text-emerald-300 uppercase">What this plant supports</div>
          <p className="text-slate-300 flex gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">The mid-bed port gives early warning.</strong> At both trains the halfway port crossed 4 ng/L at{' '}
              {pct(Math.min(...ratios))}–{pct(Math.max(...ratios))} of the bed volumes at which the lead outlet did (PFOA, PFOS). A
              model-free comparison, added after the protocol&apos;s results.
            </span>
          </p>
          <p className="text-slate-300 flex gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              The asymmetric curve form, first seen on the EPA data, is confirmed here for the bulk of the curve: later-sample error{' '}
              {asymRange.map(pct).join(' / ')} vs {twinRange.map(pct).join(' / ')} for the symmetric twin.
            </span>
          </p>
        </div>
        <div className="bg-[#061320] border border-rose-500/30 rounded-xl p-3.5 space-y-2">
          <div className="font-mono font-bold text-rose-300 uppercase">What it does not support (yet)</div>
          <p className="text-slate-300 flex gap-2">
            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">The twin&apos;s 4 ng/L outlet forecast was late in {four.byMethod.TWIN.late} of {four.forecasts} cases</strong>,
              in every variant — the unsafe direction. The twin assumes the front keeps its shape between the halfway port and the
              outlet; here the outlet&apos;s 50% point came {Math.min(...spread).toFixed(1)}–{Math.max(...spread).toFixed(1)} times earlier than
              that assumption predicts. Until a model passes this test, the halfway-port crossing itself is the robust signal and
              operator sign-off stays the default.
            </span>
          </p>
          <p className="text-slate-300 flex gap-2">
            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span>
              Learning from another site&apos;s curve did not help: the unchanged curve beat the symmetric twin. Limits: charted data,
              influent known only as averages, bed volumes ±10%, low concentrations near the 1 ng/L reporting step.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
