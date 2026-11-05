import React, { useState } from 'react';
import { CheckCircle2, Database, XCircle } from 'lucide-react';
import externalReportJson from '../../simulation/external_validation.json';

type Species = 'PFBA' | 'PFBS' | 'PFOA' | 'PFOS';
type Method = 'STATIC' | 'TWIN' | 'TWIN_HYBRID' | 'INDEPENDENT' | 'DATA_ONLY' | 'TWIN_ASYM';

interface SummaryRow {
  meanPrimaryTestNrmse: number;
  meanPrimaryAbsDay50Error: number;
}

interface ExternalReport {
  dataset: { samplingDays: number[]; meanInfluentNgL: Record<Species, number> };
  protocol: { displayCase: { source: string; target: string; cutoff: number }; cutoffDays: number[] };
  inSample: Record<'preAS' | 'postAS', Record<Species, { thomasNrmse: number; epaPsdmNrmse: number }>> & {
    columnToColumnNrmse: Record<Species, number>;
  };
  cases: {
    source: string;
    target: string;
    cutoffDay: number;
    curveDays?: number[];
    curves?: Record<'STATIC' | 'TWIN' | 'DATA_ONLY' | 'ORACLE', Record<Species, number[]>>;
    observed?: Record<Species, { day: number; effluent: number; influent: number; known: boolean }[]>;
  }[];
  summary: Record<string, Record<Method, SummaryRow> & { ORACLE: { meanPrimaryTestNrmse: number } }> & {
    postHoc4NgL: { forecasts: number; byMethod: Record<Method, { early: number; inside: number; late: number }>; twinBandOverlaps: number };
  };
  cleanWaterPrior: Record<string, { ratioSpread: number }>;
}

const report = externalReportJson as unknown as ExternalReport;
const METHOD_LABEL: Record<Method, string> = {
  STATIC: 'Sibling-column curve, unchanged',
  TWIN: 'Twin (default, shared factors)',
  TWIN_HYBRID: 'Twin, PINN-style option',
  INDEPENDENT: 'Each species fitted alone',
  DATA_ONLY: 'Early samples only, no prior',
  TWIN_ASYM: 'Twin, asymmetric curve (added later)',
};
const METHODS: Method[] = ['STATIC', 'TWIN', 'TWIN_HYBRID', 'TWIN_ASYM', 'INDEPENDENT', 'DATA_ONLY'];
const CURVE_STYLE: { key: 'STATIC' | 'TWIN' | 'DATA_ONLY'; label: string; color: string; dash?: string }[] = [
  { key: 'STATIC', label: 'Sibling-column curve', color: '#94a3b8', dash: '5 4' },
  { key: 'TWIN', label: 'Twin (data ≤ cut-off)', color: '#22d3ee' },
  { key: 'DATA_ONLY', label: 'Early samples only', color: '#f59e0b', dash: '2 3' },
];

const pct = (x: number) => `${Math.round(x * 100)}%`;
const d1 = (x: number) => `${Math.round(x * 10) / 10}`;

export const ExternalValidationCard: React.FC = () => {
  const [species, setSpecies] = useState<Species>('PFOS');
  const display = report.protocol.displayCase;
  const shown = report.cases.find((c) => c.curves && c.observed);
  const cutoffs = report.protocol.cutoffDays;
  const s = report.summary;
  const range = (m: Method, key: keyof SummaryRow) => {
    const v = cutoffs.map((c) => s[String(c)][m][key]);
    return [Math.min(...v), Math.max(...v)];
  };
  const inSampleThomas = (['preAS', 'postAS'] as const).flatMap((c) => Object.values(report.inSample[c]).map((v) => v.thomasNrmse));
  const inSamplePsdm = (['preAS', 'postAS'] as const).flatMap((c) => Object.values(report.inSample[c]).map((v) => v.epaPsdmNrmse));
  const twinD50 = range('TWIN', 'meanPrimaryAbsDay50Error');
  const staticD50 = range('STATIC', 'meanPrimaryAbsDay50Error');
  const indepD50 = range('INDEPENDENT', 'meanPrimaryAbsDay50Error');
  const dataD50 = range('DATA_ONLY', 'meanPrimaryAbsDay50Error');
  const twinN = range('TWIN', 'meanPrimaryTestNrmse');
  const staticN = range('STATIC', 'meanPrimaryTestNrmse');
  const post = s.postHoc4NgL;

  if (!shown || !shown.curves || !shown.observed || !shown.curveDays) return null;
  const days = shown.curveDays;
  const obs = shown.observed[species];
  const W = 600;
  const H = 210;
  const padL = 44;
  const padT = 14;
  const maxY = Math.max(10, ...obs.map((p) => p.effluent), ...obs.map((p) => p.influent)) * 1.08;
  const x = (d: number) => padL + (d / 400) * (W - padL - 14);
  const y = (v: number) => padT + H - (Math.min(maxY, Math.max(0, v)) / maxY) * H;
  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(days[i]).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY);

  return (
    <div id="external-check" className="bg-[#0B1D30] border border-emerald-500/30 rounded-xl p-5 space-y-4 scroll-mt-44">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 max-w-3xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            External check 1: measured pilot data (U.S. EPA)
          </h3>
          <p className="text-xs text-slate-400">
            Two identical F400 GAC columns at a New Jersey groundwater utility, fed the same well water and sampled{' '}
            {report.dataset.samplingDays.length} times over {Math.max(...report.dataset.samplingDays)} days (Haupert et al.
            2023; EPA dataset doi:10.23719/1529105, public domain). These are measured data. They were not used to build or
            tune the twin. The twin starts from curves fitted to the other column, the way a utility would start from a pilot,
            an RSSCT or the previous bed. It then learns from the outlet samples taken on or before a cut-off day.
          </p>
        </div>
        <span className="text-[10px] font-mono px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
          Real data • outlet only • EBCT ≈ 3.5 min
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#061320] border border-slate-800 rounded-xl p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-mono text-slate-400">
              {display.target === 'postAS' ? 'Post-AS' : 'Pre-AS'} column, cut-off day {display.cutoff}
            </span>
            <div className="flex gap-1">
              {(['PFBA', 'PFBS', 'PFOA', 'PFOS'] as Species[]).map((sp) => (
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
          <svg viewBox={`0 0 ${W} ${H + padT + 26}`} className="w-full h-auto" role="img" aria-label={`${species} measured outlet concentrations and forecasts`}>
            <rect x={padL} y={padT} width={x(display.cutoff) - padL} height={H} fill="#10b981" opacity={0.06} />
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W - 14} y1={y(t)} y2={y(t)} stroke="#1e293b" strokeWidth={1} />
                <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="#64748b">
                  {Math.round(t)}
                </text>
              </g>
            ))}
            {[0, 100, 200, 300, 400].map((d) => (
              <text key={d} x={x(d)} y={padT + H + 14} textAnchor="middle" fontSize={9} fill="#64748b">
                {d === 0 ? 'Day 0' : d}
              </text>
            ))}
            <line x1={padL} x2={W - 14} y1={y(4)} y2={y(4)} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1} />
            <text x={W - 16} y={y(4) - 3} textAnchor="end" fontSize={9} fill="#fb7185">
              4 ng/L
            </text>
            <line x1={x(display.cutoff)} x2={x(display.cutoff)} y1={padT} y2={padT + H} stroke="#10b981" strokeDasharray="2 3" />
            <text x={x(display.cutoff) + 4} y={padT + 9} fontSize={9} fill="#34d399">
              cut-off: day {display.cutoff}
            </text>
            {CURVE_STYLE.map((c) => (
              <path key={c.key} d={path(shown.curves![c.key][species])} fill="none" stroke={c.color} strokeWidth={c.key === 'TWIN' ? 2.2 : 1.6} strokeDasharray={c.dash} />
            ))}
            {obs.map((p) => (
              <circle
                key={p.day}
                cx={x(p.day)}
                cy={y(p.effluent)}
                r={3.2}
                fill={p.known ? '#34d399' : '#061320'}
                stroke={p.known ? '#34d399' : '#e2e8f0'}
                strokeWidth={1.3}
              />
            ))}
            <text x={padL} y={padT + H + 24} fontSize={9} fill="#64748b">
              ng/L • filled = known at the cut-off, ringed = later measured samples (test)
            </text>
          </svg>
          <div className="flex flex-wrap gap-3 mt-1 text-[10px] font-mono">
            {CURVE_STYLE.map((c) => (
              <span key={c.key} className="flex items-center gap-1.5" style={{ color: c.color }}>
                <svg width="18" height="6" aria-hidden="true">
                  <line x1="0" x2="18" y1="3" y2="3" stroke={c.color} strokeWidth="2" strokeDasharray={c.dash} />
                </svg>
                {c.label}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-[#061320] border border-slate-800 rounded-xl p-3 text-xs">
          <div className="font-mono font-bold text-emerald-300 uppercase mb-2">
            PFOA + PFOS, both directions, cut-off day {cutoffs.join(' / ')}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left font-normal pb-1">Method</th>
                  <th className="text-right font-normal pb-1 pl-2">Day-50 error</th>
                  <th className="text-right font-normal pb-1 pl-2">Later samples</th>
                </tr>
              </thead>
              <tbody>
                {METHODS.map((m) => (
                  <tr key={m} className={`border-t border-slate-800/70 ${m === 'TWIN' ? 'text-cyan-300' : m === 'TWIN_ASYM' ? 'text-violet-300' : 'text-slate-300'}`}>
                    <td className="py-1 pr-2">{METHOD_LABEL[m]}</td>
                    <td className="py-1 pl-2 text-right whitespace-nowrap">
                      {cutoffs.map((c) => d1(s[String(c)][m].meanPrimaryAbsDay50Error)).join(' / ')} d
                    </td>
                    <td className="py-1 pl-2 text-right whitespace-nowrap">
                      {cutoffs.map((c) => Math.round(s[String(c)][m].meanPrimaryTestNrmse * 100)).join(' / ')}%
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-800/70 text-slate-500">
                  <td className="py-1 pr-2">Best curve of this form, all data (reference)</td>
                  <td className="py-1 pl-2 text-right">—</td>
                  <td className="py-1 pl-2 text-right whitespace-nowrap">
                    {cutoffs.map((c) => Math.round(s[String(c)].ORACLE.meanPrimaryTestNrmse * 100)).join(' / ')}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Day-50 error: the day the outlet reaches 50% of influent, against a curve of the same form fitted to all data of
            that column. Later samples: error on the samples after the cut-off, as % of mean influent. The two columns differ
            from each other by {pct(Math.min(...Object.values(report.inSample.columnToColumnNrmse)))}–
            {pct(Math.max(...Object.values(report.inSample.columnToColumnNrmse)))} of influent on the same days.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="bg-[#061320] border border-emerald-500/30 rounded-xl p-3.5 space-y-2">
          <div className="font-mono font-bold text-emerald-300 uppercase">What the real data support</div>
          <p className="text-slate-300 flex gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Sharing two bed-condition factors across species (the tracer idea) beat fitting each species alone: day-50 error{' '}
              {d1(twinD50[0])}–{d1(twinD50[1])} days vs {d1(indepD50[0])}–{d1(indepD50[1])}, and{' '}
              {d1(dataD50[0])}–{d1(dataD50[1])} for a curve fitted to the early samples without a prior.
            </span>
          </p>
          <p className="text-slate-300 flex gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              The twin's curve form fits the measured curves about as closely as EPA's own fitted pore and surface diffusion
              model (in-sample error {pct(Math.min(...inSampleThomas))}–{pct(Math.max(...inSampleThomas))} vs{' '}
              {pct(Math.min(...inSamplePsdm))}–{pct(Math.max(...inSamplePsdm))} of influent).
            </span>
          </p>
        </div>
        <div className="bg-[#061320] border border-rose-500/30 rounded-xl p-3.5 space-y-2">
          <div className="font-mono font-bold text-rose-300 uppercase">What they do not support (yet)</div>
          <p className="text-slate-300 flex gap-2">
            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span>
              With a good site-specific starting curve, learning from the new column did not beat leaving the curve unchanged
              (later-sample error {pct(twinN[0])}–{pct(twinN[1])} vs {pct(staticN[0])}–{pct(staticN[1])}; day-50 error{' '}
              {d1(twinD50[0])}–{d1(twinD50[1])} vs {d1(staticD50[0])} days).
            </span>
          </p>
          <p className="text-slate-300 flex gap-2">
            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span>
              The 4 ng/L crossing is the weak spot. Measured curves start at zero and approach the influent level only slowly;
              a symmetric curve fitted to the whole run starts too high and puts PFOS above 4 ng/L on day 0, while the samples
              stay below 4 ng/L through day 14. In {post.forecasts} forecasts still open at the cut-off, the twin was
              inside the sampling interval {post.byMethod.TWIN.inside} times, late {post.byMethod.TWIN.late} and early{' '}
              {post.byMethod.TWIN.early}. A curve through the early samples alone was inside {post.byMethod.DATA_ONLY.inside}{' '}
              times but missed the later curve badly. This check was added after the first run.
            </span>
          </p>
          <p className="text-slate-300 flex gap-2">
            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span>
              Clean-water isotherms (EPA batch data for F400) are not usable starting values: the correction they would need
              differs about {Math.round(report.cleanWaterPrior['200x325'].ratioSpread / 10) * 10}-fold between species, so one shared factor
              cannot fix them. Starting values must come from site water (RSSCT, pilot or the previous bed).
            </span>
          </p>
        </div>
      </div>
      <p className="text-[10px] text-slate-500">
        Limits: one site, one carbon, two columns on the same water, 14-day sampling, a short 3.5-minute contact time (full-scale
        beds use 10–20 min) and no mid-bed port. The asymmetric curve (row added after these results) is tested on independent full-scale data in the next card.
        Code and protocol: <code>simulation/external_validation.py</code>.
      </p>
    </div>
  );
};
