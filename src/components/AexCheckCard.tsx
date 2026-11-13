import React from 'react';
import { CheckCircle2, FlaskConical, XCircle } from 'lucide-react';
import { AEX_CHECK, AEX_PASS_BAR_MAX_LATE, type AexMethod, type AexRunSummary, type Counts } from '../data/aexCheck';

const ROWS: { m: AexMethod; label: string; tone: string }[] = [
  { m: 'STATIC_ASYM', label: "Duplicate train's curve, unchanged", tone: 'text-slate-300' },
  { m: 'TWIN_ASYM', label: 'Twin, shared bed condition (default)', tone: 'text-cyan-300' },
  { m: 'INDEPENDENT', label: 'Same model, each species fitted alone', tone: 'text-slate-300' },
  { m: 'MIDBED_ONLY', label: 'Port data only, no prior', tone: 'text-slate-300' },
  { m: 'STATIC_OUTLET_ASYM', label: "Duplicate train's outlet curve, unchanged", tone: 'text-slate-300' },
  { m: 'TWOPOINT_ASYM', label: 'Two-point twin (port and outlet curves)', tone: 'text-violet-300' },
];

const RUNS: { label: string; s: AexRunSummary; secondary: boolean }[] = [
  { label: 'Registered (EPA workbook)', s: AEX_CHECK.registered, secondary: false },
  { label: 'Times corrected', s: AEX_CHECK.corrected, secondary: true },
  { label: "Authors' detailed data", s: AEX_CHECK.repeat, secondary: true },
];

const VERDICTS: { label: string; passed: (s: AexRunSummary) => boolean; late: (s: AexRunSummary) => string }[] = [
  { label: 'Twin passes', passed: (s) => s.verdicts.twinPasses, late: (s) => `${s.twinLate} of ${s.open}` },
  { label: 'Two-point twin is the fix', passed: (s) => s.verdicts.twopointIsFix, late: (s) => `${s.twopointLate} of ${s.open}` },
  { label: 'Tracer claim (E7)', passed: (s) => s.verdicts.tracerSupported, late: (s) => `${s.tracerLate} of ${s.tracerScored}` },
];

const COLOR = { early: '#38bdf8', inside: '#34d399', late: '#fb7185' };
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;
const pct0 = (x: number) => `${Math.round(x * 100)}%`;
const span2 = ([a, b]: [number, number]) => `${a.toFixed(2)}–${b.toFixed(2)}`;

/** One mark per open forecast: ring = early, dot = inside, square = late (the unsafe direction). */
const CrossingMarks: React.FC<{ c: Counts; muted?: boolean }> = ({ c, muted }) => {
  const kinds: (keyof Counts)[] = [
    ...Array<keyof Counts>(c.early).fill('early'),
    ...Array<keyof Counts>(c.inside).fill('inside'),
    ...Array<keyof Counts>(c.late).fill('late'),
  ];
  const step = 11;
  return (
    <svg width={Math.max(step, kinds.length * step)} height={10} className="inline-block align-middle shrink-0" aria-hidden="true" opacity={muted ? 0.7 : 1}>
      {kinds.map((k, i) => {
        const cx = i * step + 5;
        if (k === 'early') return <circle key={i} cx={cx} cy={5} r={3.5} fill="none" stroke={COLOR.early} strokeWidth={1.4} />;
        if (k === 'inside') return <circle key={i} cx={cx} cy={5} r={4} fill={COLOR.inside} />;
        return <rect key={i} x={cx - 4} y={1} width={8} height={8} rx={1} fill={COLOR.late} />;
      })}
    </svg>
  );
};

const CrossingCell: React.FC<{ c: Counts; muted?: boolean }> = ({ c, muted }) => (
  <span className="inline-flex items-center gap-2">
    <CrossingMarks c={c} muted={muted} />
    <span>
      {c.early} · {c.inside} · {c.late}
    </span>
  </span>
);

export const AexCheckCard: React.FC = () => {
  const reg = AEX_CHECK.registered;
  const rep = AEX_CHECK.repeat;
  const corr = AEX_CHECK.correction;
  const portOnly = (s: AexRunSummary) => s.methods.MIDBED_ONLY.crossing;
  const portOnlyNeverLate = portOnly(reg).late === 0 && portOnly(rep).late === 0;

  return (
    <div id="aex-check" className="bg-[#0B1D30] border border-emerald-500/30 rounded-xl p-5 space-y-4 scroll-mt-44">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 max-w-3xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-emerald-400" />
            External check 3: EPA anion-exchange columns, pre-registered
          </h3>
          <p className="text-xs text-slate-400">
            {AEX_CHECK.trainPairs} duplicate pairs of laboratory lead-lag columns with a PFAS-selective anion-exchange resin ran
            for {Math.round(AEX_CHECK.months[0])}–{Math.round(AEX_CHECK.months[1])} months on a controlled influent: about 500
            ng/L of each of nine PFAS, without or with natural organic matter (Smith et al. 2026, Water Research; EPA dataset
            doi:10.23719/1532427, U.S. public domain). The lead-column effluent plays the mid-bed port and the lag effluent the
            outlet. The questions, the pass/fail rules and the analysis code were committed before the data were opened. The
            EPA workbook gives C/C0 only, so the event scored is the outlet crossing 10% of influent, not 4 ng/L.
          </p>
        </div>
        <span className="text-[10px] font-mono px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
          Real data • pre-registered • ion exchange
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#061320] border border-slate-800 rounded-xl p-3 text-xs">
          <div className="font-mono font-bold text-emerald-300 uppercase mb-2">
            PFOA at the outlet, cut-off K1, both directions ({reg.open} open forecasts)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left font-normal pb-1">Method</th>
                  <th className="text-left font-normal pb-1 pl-2">10% crossing: early · inside · late</th>
                  <th className="text-right font-normal pb-1 pl-2">Later samples</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(({ m, label, tone }) => (
                  <React.Fragment key={m}>
                    <tr className={`border-t border-slate-800/70 ${tone}`}>
                      <td className="pt-1.5 pr-2">{label}</td>
                      <td className="pt-1.5 pl-2 whitespace-nowrap">
                        <CrossingCell c={reg.methods[m].crossing} />
                      </td>
                      <td className="pt-1.5 pl-2 text-right whitespace-nowrap">{pct1(reg.methods[m].error)}</td>
                    </tr>
                    <tr className="text-slate-500 text-[10px]">
                      <td className="pb-1.5 pr-2 pl-3">↳ authors&apos; detailed data</td>
                      <td className="pb-1.5 pl-2 whitespace-nowrap">
                        <CrossingCell c={rep.methods[m].crossing} muted />
                      </td>
                      <td className="pb-1.5 pl-2 text-right whitespace-nowrap">{pct1(rep.methods[m].error)}</td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-[10px] font-mono">
            <span className="flex items-center gap-1.5" style={{ color: COLOR.early }}>
              <CrossingMarks c={{ early: 1, inside: 0, late: 0 }} /> early
            </span>
            <span className="flex items-center gap-1.5" style={{ color: COLOR.inside }}>
              <CrossingMarks c={{ early: 0, inside: 1, late: 0 }} /> inside the sampling interval
            </span>
            <span className="flex items-center gap-1.5" style={{ color: COLOR.late }}>
              <CrossingMarks c={{ early: 0, inside: 0, late: 1 }} /> late (unsafe)
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            First line: the registered result on EPA&apos;s workbook. Second line: the repeat with the authors&apos; detailed data.
            Later samples: PFOA error on the outlet samples after the cut-off, as % of influent; the duplicate trains differ by{' '}
            {(reg.scatter.min * 100).toFixed(1)}–{pct1(reg.scatter.max)} in the workbook and {(rep.scatter.min * 100).toFixed(1)}–
            {pct1(rep.scatter.max)} in the detailed data. Curves are in the asymmetric form wherever the decision rule uses it; the symmetric variants are in
            README Section 3.8.4.
          </p>
        </div>

        <div className="bg-[#061320] border border-slate-800 rounded-xl p-3 text-xs space-y-2">
          <div className="font-mono font-bold text-emerald-300 uppercase">Pre-registered verdicts</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left font-normal pb-1">Run</th>
                  {VERDICTS.map((v) => (
                    <th key={v.label} className="text-left font-normal pb-1 pl-2">
                      {v.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RUNS.map((run) => (
                  <tr
                    key={run.label}
                    className={run.secondary ? 'text-slate-500 text-[10px]' : 'border-t border-slate-800/70 text-slate-200'}
                  >
                    <td className={`py-1 pr-2 ${run.secondary ? 'pl-3' : ''}`}>
                      {run.secondary ? '↳ ' : ''}
                      {run.label}
                    </td>
                    {VERDICTS.map((v) => (
                      <td key={v.label} className="py-1 pl-2 whitespace-nowrap">
                        <span className={v.passed(run.s) ? 'text-emerald-300' : run.secondary ? 'text-rose-300/80' : 'text-rose-300 font-bold'}>
                          {v.passed(run.s) ? 'Yes' : 'No'}
                        </span>{' '}
                        · late {v.late(run.s)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500">
            Pass bar, fixed before the data were opened: at most {AEX_PASS_BAR_MAX_LATE} late forecasts of the PFOA outlet 10%
            crossing at cut-off K1 (the first port sample with PFOA at 10% or more). The two-point twin must also have fewer late
            cases than the twin. Tracer claim: PFOA outlet forecasts under natural organic matter from factors learned on PFBA and
            PFHxA only.
          </p>
          <p className="text-[10px] text-slate-500">
            <span className="text-slate-400">Times corrected:</span> our extraction had Experiment 2 run times off by{' '}
            {(corr.timeError[0] * 100).toFixed(1)}–{(corr.timeError[1] * 100).toFixed(1)}% per train. With them fixed,{' '}
            {corr.countsUnchanged ? 'no verdict and no early/inside/late count changed' : 'some counts changed (README Section 3.8.4)'}, and
            the errors moved by at most {(corr.maxErrorShift * 100).toFixed(2)} percentage points.
          </p>
          <p className="text-[10px] text-slate-500">
            <span className="text-slate-400">Authors&apos; detailed data:</span> a repeat with every sample in ng/L, shared by an
            EPA co-author after this check, each train normalized by its own measured influent (amendments A2–A3). It is not
            blind, because the experiment had been seen through the workbook, so it cannot test a model changed after these
            results. The 4 ng/L crossing is still not scorable: the files give no reporting limit.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="bg-[#061320] border border-emerald-500/30 rounded-xl p-3.5 space-y-2">
          <div className="font-mono font-bold text-emerald-300 uppercase">What these data support</div>
          <p className="text-slate-300 flex gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">The front spreads with depth (E8).</strong> The 50% point moved almost linearly with
              depth (median ratio to a linear mapping {span2(reg.e8.r50)}; repeat {span2(rep.e8.r50)}), but the outlet curves were
              flatter than the port curves (median slope ratio {span2(reg.e8.slope)}; repeat {span2(rep.e8.slope)}). A
              constant-shape mapping from the port therefore comes out late at the outlet, the failure first seen at full scale.
              The slope ratios are indicative only: the port fits reached the curve form&apos;s asymmetry limit.
            </span>
          </p>
          <p className="text-slate-300 flex gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">A measured outlet curve from a comparable bed was the best forecast:</strong>{' '}
              {pct1(reg.methods.STATIC_OUTLET_ASYM.error)} error ({pct1(rep.methods.STATIC_OUTLET_ASYM.error)} in the repeat), the
              same lesson as External check 1.
            </span>
          </p>
          <p className="text-slate-300 flex gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">
                The port-only curve, with no prior, was {portOnlyNeverLate ? 'never late' : `late in ${portOnly(reg).late} of ${reg.open}`}:
              </strong>{' '}
              early in {portOnly(reg).early} of {reg.open} cases ({portOnly(rep).early} of {rep.open} in the repeat), at a{' '}
              {pct0(reg.methods.MIDBED_ONLY.error)} error ({pct0(rep.methods.MIDBED_ONLY.error)}). A conservative, model-light guard.
            </span>
          </p>
        </div>
        <div className="bg-[#061320] border border-rose-500/30 rounded-xl p-3.5 space-y-2">
          <div className="font-mono font-bold text-rose-300 uppercase">What they do not support</div>
          <p className="text-slate-300 flex gap-2">
            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">
                The twin&apos;s outlet forecast: late in {reg.twinLate} of {reg.open} cases
              </strong>{' '}
              ({rep.twinLate} of {rep.open} in the repeat), against a pre-set bar of at most {AEX_PASS_BAR_MAX_LATE}. Learning at the
              port with a constant-shape mapping made it worse than the unchanged duplicate curve (
              {pct1(reg.methods.TWIN_ASYM.error)} vs {pct1(reg.methods.STATIC_ASYM.error)} error).
            </span>
          </p>
          <p className="text-slate-300 flex gap-2">
            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">The two-point twin as the fix:</strong> late in {reg.twopointLate} of {reg.open} (
              {rep.twopointLate} of {rep.open} in the repeat), although it cut the error from {pct1(reg.methods.TWIN_ASYM.error)} to{' '}
              {pct1(reg.methods.TWOPOINT_ASYM.error)}.
            </span>
          </p>
          <p className="text-slate-300 flex gap-2">
            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Short-chain tracers as carriers of the organic-matter effect on PFOA:</strong> with
              factors learned from PFBA and PFHxA only, the PFOA outlet forecasts were late in {reg.tracerLate} of{' '}
              {reg.tracerScored} ({rep.tracerLate} of {rep.tracerScored} in the repeat). The tracers remain an early alert, but they
              do not replace PFOA/PFOS data at the port (README Section 5).
            </span>
          </p>
        </div>
      </div>
      <p className="text-[10px] text-slate-500">
        Limits: one resin and one organic-matter source, synthetic water, laboratory columns, anion exchange rather than GAC,
        influent about 100 times the 4 ng/L level. What follows: the next model must let the front spread with depth and be tested
        on data not yet seen; the decision layer (model-free mid-bed guard plus operator sign-off) stays as it is. Protocol{' '}
        <code>simulation/protocols/smith2026_aex_protocol.md</code> (registered at commit {AEX_CHECK.commits.registration}); code{' '}
        <code>simulation/external_validation_aex.py</code> and <code>external_validation_aex_a2.py</code>.
      </p>
    </div>
  );
};
