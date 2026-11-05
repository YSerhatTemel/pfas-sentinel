import React, { useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Calendar,
  DollarSign,
  Leaf,
  Rocket,
  ShieldAlert,
  Target,
  TrendingDown,
  Video,
} from 'lucide-react';
import {
  EXTERNAL_TWIN_CHECK,
  HONEST_LIMITATIONS,
  REGULATORY_TIMELINE,
  US_MARKET_SIZING,
  STAKEHOLDER_VALIDATION_FINDINGS,
  COMPETITIVE_LANDSCAPE_2026,
} from '../data/pfasPhysicsEngine';
import { BASE_ECONOMICS, ECONOMIC_SCENARIOS, computeEconomics } from '../data/economics';
import validationReport from '../../simulation/validation_report.json';

export const BusinessAndPitchTab: React.FC = () => {
  const [utilityVessels, setUtilityVessels] = useState<number>(6);
  const [annualMediaCostPerVessel, setAnnualMediaCostPerVessel] = useState<number>(85000);
  const [savingsRatePct, setSavingsRatePct] = useState<number>(28);

  // Financial & environmental calculations (single source: src/data/economics.ts)
  const econ = computeEconomics({
    ...BASE_ECONOMICS,
    vessels: utilityVessels,
    mediaCostPerVesselYear: annualMediaCostPerVessel,
    bedLifeExtension: savingsRatePct / 100,
  });
  const pfasSentinelSubscriptionAnnual = econ.fee;
  const netAnnualUtilitySavings = Math.round(econ.net);
  const hazardousWasteAvoidedTons = Number(econ.mediaAvoidedTonnes.toFixed(1));
  const ghgAvoidedTonsCo2 = Number(econ.co2AvoidedTonnes.toFixed(1));
  const ops = validationReport.operational;
  const abl = validationReport.ablation as Record<string, { pfoaPfos: { maeDays: number } }>;
  const twinMae = Math.round(abl['jointPhysics (default)'].pfoaPfos.maeDays);
  const staticMae = Math.round(abl.staticPrior.pfoaPfos.maeDays);

  const pitchSections = [
    {
      part: 'Part 1 • 0:00 – 0:30',
      title: 'The Core Problem: 14-Day Lab Blindness & Premature Media Waste',
      criterion: 'Challenge Fit & Feasibility',
      script:
        '“Under the EU 2026 Directive and the US EPA’s binding 4 parts-per-trillion rule, water utilities must eliminate PFAS forever chemicals. Yet today’s Granular Activated Carbon and Ion Exchange vessels operate blind: off-site LC-MS/MS results typically take days to weeks and a few hundred dollars per sample. Without a forecast, media is changed on conservative schedules; our working hypothesis, to be confirmed with utilities, is that 20 to 30% of usable capacity is discarded to stay safe.”',
    },
    {
      part: 'Part 2 • 0:30 – 1:40',
      title: 'Core Innovation: Mid-Bed Sensor + Bed-Condition Twin',
      criterion: 'Innovation',
      script:
        '“Meet PFAS-Sentinel: a cyber-physical early warning module designed for Xylem Vue powered by GoAigua. Rather than requiring new treatment tanks, our reader pod retrofits directly onto the existing mid-bed sampling port (z/L = 0.50) of standard GAC and IX vessels. Inside, a proposed 32-channel microfluidic MIP-nanocarbon cartridge pairs 4 NIP blank channels with YSI/WTW sonde telemetry and 4×4 cross-selectivity deconvolution to target 1 to 4 ppt detection in 15 minutes. This mid-bed data feeds a physics-based twin built on the travelling-wave solution of the advection-sorption equation. Because PFBA and PFBS reach the mid-bed first, the twin learns the bed’s condition from them and forecasts when PFOA and PFOS will break through; the lead-lag switch is scheduled from that forecast, so media is used to the last safe day.”',
    },
    {
      part: 'Part 3 • 1:40 – 2:25',
      title: 'Engineering Integrity, In-Silico Evidence & Servitization ROI',
      criterion: 'Challenge Fit & Feasibility',
      script:
        `“We tested the twin honestly: a hidden virtual plant generates the data and the model never sees its parameters. Across 16 simulated plants it forecast the PFOA/PFOS breach with a ${twinMae}-day mean error versus ${staticMae} days for a vendor curve, and in a daily decision test it rotated a median ${Math.round(ops.twin.medianDays)} days before the breach, never after it. We then tested it, unchanged, on public measured data. At a full-scale lead-lag plant the mid-bed port crossed 4 ppt at ${Math.round(Math.min(...EXTERNAL_TWIN_CHECK.midbedLeadRatios) * 100)} to ${Math.round(Math.max(...EXTERNAL_TWIN_CHECK.midbedLeadRatios) * 100)}% of the outlet’s bed volumes — real early warning — but the twin’s outlet forecast came too late, so we report that openly and fix it next, with operator sign-off as the default. Commercially, PFAS-Sentinel eliminates upfront utility CAPEX by integrating into Evoqua media service contracts via a projected $11.80 disposable cartridge—saving a modeled $112,092 a year at a 6-vessel utility, with break-even at only 6% media-life extension, while retaining quarterly LC-MS/MS for statutory sign-off.”`,
    },
    {
      part: 'Part 4 • 2:25 – 3:00',
      title: 'Measurable Impact & TRL 3 → TRL 6 Validation Roadmap',
      criterion: 'Impact',
      script:
        '“If field tests confirm a 28% longer bed life, a typical 6-vessel plant (9.1-ton GAC vessels) avoids 15.3 tons of spent PFAS-laden media and about 37 tons of CO₂e a year. Our 12-month roadmap runs two tracks: a software-first Phase 0 that tests the forecast twin on a utility’s existing grab-sample records with no new hardware, and a sensor track from wet-lab calibration (TRL 4) through column testing (TRL 5) to a utility slipstream pilot (TRL 6) with Xylem mentors.”',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Market Intelligence Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-mono text-cyan-400 uppercase">US Systems Needing Treatment</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">4,000–6,600</div>
          <p className="text-xs text-slate-400 mt-1">
            ~6–10% of 66,000 public water systems (US EPA, 2024)
          </p>
        </div>

        <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-mono text-purple-400 uppercase">
            US Compliance Spend
          </span>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            $1.5–3.5B <span className="text-xs text-purple-300">/ yr</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            US EPA (2024) to AWWA 2024 update; $37–48B capital over 5 years
          </p>
        </div>

        <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-mono text-amber-400 uppercase">
            Addressable Revenue (US)
          </span>
          <div className="text-2xl font-bold font-mono text-white mt-1">$115–570M</div>
          <p className="text-xs text-slate-400 mt-1">
            4,000–6,600 systems × 2–6 vessels × $14,400 per vessel-year
          </p>
        </div>

        <div className="bg-[#0B1D30] border border-emerald-500/30 rounded-xl p-4">
          <span className="text-xs font-mono text-emerald-400 uppercase">
            Media Life Extension
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">28% <span className="text-xs text-emerald-400">modeled</span></div>
          <p className="text-xs text-slate-400 mt-1">
            Break-even at only 6% (bi-weekly lab baseline) or 12% (monthly)
          </p>
        </div>

        <div className="bg-[#0B1D30] border border-cyan-500/30 rounded-xl p-4">
          <span className="text-xs font-mono text-cyan-300 uppercase">Target Cartridge BOM</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            $11.80 <span className="text-xs text-emerald-400">(15 min)</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            vs. $300–$500 &amp; 10–14 day delay for centralized LC-MS/MS
          </p>
        </div>
      </div>

      {/* Regulatory Compliance Timeline (2024-2031) & Market Sizing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Regulatory Timeline (2024 - 2031) */}
        <div className="lg:col-span-6 bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
          <div className="mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Market Driver • Regulatory Compliance Timeline (2024 – 2031)
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">
              Binding US EPA (4.0 ppt) &amp; European Union Mandatory PFAS Deadlines
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {REGULATORY_TIMELINE.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#061320] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-cyan-300">{item.date}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        item.status === 'MANDATORY NOW'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : item.status === 'UPCOMING DEADLINE'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {item.authority}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white">{item.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{item.mandate}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 6 Cols: Market & Operational Structure (%) Bar Chart */}
        <div className="lg:col-span-6 bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
          <div className="mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              PFAS Treatment Market • Sourced Estimates
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">
              US Market Sizing from EPA &amp; AWWA Cost Analyses
            </h3>
          </div>

          <div className="space-y-3 bg-[#061320] p-3.5 rounded-xl border border-slate-800">
            {US_MARKET_SIZING.map((row, idx) => (
              <div key={idx} className="space-y-1 pb-2 border-b border-slate-800/70 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-200">{row.label}</span>
                  <span className="font-mono font-bold text-right" style={{ color: row.color }}>
                    {row.value}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Source: {row.source}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Servitization CAPEX / OPEX & Waste Calculator */}
      <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 block">
              Business Model Innovation • Performance-Based Servitization (Hardware-Enabled SaaS)
            </span>
            <h2 className="text-lg font-bold text-white mt-0.5">
              Interactive Utility CAPEX/OPEX &amp; Secondary Hazardous Waste Calculator
            </h2>
          </div>
          <span className="px-3 py-1 rounded-lg text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Zero Upfront Utility CAPEX • Evoqua O&amp;M Add-On
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left 5 Cols: Sliders */}
          <div className="lg:col-span-5 space-y-4 bg-[#061320] p-4 rounded-xl border border-slate-800">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Number of GAC / IX Vessels at Utility:</span>
                <span className="font-mono font-bold text-cyan-300">{utilityVessels} Vessels</span>
              </div>
              <input
                type="range"
                min={2}
                max={24}
                step={2}
                value={utilityVessels}
                onChange={(e) => setUtilityVessels(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Baseline Annual Media Replacement / Vessel:</span>
                <span className="font-mono font-bold text-cyan-300">
                  ${annualMediaCostPerVessel.toLocaleString('en-US')} / yr
                </span>
              </div>
              <input
                type="range"
                min={40000}
                max={160000}
                step={5000}
                value={annualMediaCostPerVessel}
                onChange={(e) => setAnnualMediaCostPerVessel(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Media Lifecycle Extension (break-even ≈ 6%):</span>
                <span className="font-mono font-bold text-emerald-300">{savingsRatePct}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={35}
                step={1}
                value={savingsRatePct}
                onChange={(e) => setSavingsRatePct(Number(e.target.value))}
                className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded"
              />
            </div>
          </div>

          {/* Right 7 Cols: Financial & Environmental Results */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#061320] border border-emerald-500/40 rounded-xl p-4">
              <DollarSign className="w-5 h-5 text-emerald-400 mb-1" />
              <span className="text-[11px] font-mono text-slate-400 uppercase block">
                Net Annual Utility OPEX Savings
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">
                ${netAnnualUtilitySavings.toLocaleString('en-US')}/yr
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">
                After ${pfasSentinelSubscriptionAnnual.toLocaleString('en-US')}/yr SaaS + Cartridge fee
              </span>
            </div>

            <div className="bg-[#061320] border border-cyan-500/40 rounded-xl p-4">
              <TrendingDown className="w-5 h-5 text-cyan-400 mb-1" />
              <span className="text-[11px] font-mono text-slate-400 uppercase block">
                Spent Hazardous Media Avoided
              </span>
              <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">
                {hazardousWasteAvoidedTons} Tons/yr
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">
                Prevents premature disposal of PFAS-laden GAC/IX
              </span>
            </div>

            <div className="bg-[#061320] border border-amber-500/40 rounded-xl p-4">
              <Leaf className="w-5 h-5 text-amber-400 mb-1" />
              <span className="text-[11px] font-mono text-slate-400 uppercase block">
                Scope 3 GHG Reduction
              </span>
              <div className="text-2xl font-bold font-mono text-amber-300 mt-1">
                {ghgAvoidedTonsCo2} tCO₂e/yr
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">
                Assumes {BASE_ECONOMICS.co2PerTonneMedia} tCO₂e per tonne (reactivated GAC; low end of the range implied by Vilén 2022)
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 bg-[#061320] border border-slate-800 rounded-xl p-4 overflow-x-auto">
            <div className="text-[11px] font-mono uppercase text-emerald-300 mb-2">
              Three scenarios (6 vessels) • break-even at {Math.round(econ.breakEvenExtension * 1000) / 10}% extension with these inputs
            </div>
            <table className="w-full text-xs font-mono">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left font-normal">Scenario</th>
                  <th className="text-right font-normal">Net / yr</th>
                  <th className="text-right font-normal">Media avoided</th>
                  <th className="text-right font-normal">CO₂e avoided</th>
                </tr>
              </thead>
              <tbody>
                {ECONOMIC_SCENARIOS.map((sc) => {
                  const r = computeEconomics(sc.inputs);
                  return (
                    <tr key={sc.id} className={sc.id === 'base' ? 'text-white' : 'text-slate-300'}>
                      <td className="py-1">{sc.label}</td>
                      <td className={`text-right ${r.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {r.net >= 0 ? '+' : '−'}${Math.abs(Math.round(r.net)).toLocaleString('en-US')}
                      </td>
                      <td className="text-right">{r.mediaAvoidedTonnes.toFixed(1)} t</td>
                      <td className="text-right">{r.co2AvoidedTonnes.toFixed(1)} t</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-500 mt-2">
              Inputs: ${BASE_ECONOMICS.mediaCostPerVesselYear.toLocaleString('en-US')} media per vessel-year, ${BASE_ECONOMICS.labCostPerSample}/sample,
              {Math.round(BASE_ECONOMICS.labReductionFraction * 100)}% fewer routine samples (quarterly compliance retained), ${BASE_ECONOMICS.feePerVesselYear.toLocaleString('en-US')} fee per
              vessel-year. All are assumptions to confirm with utilities.
            </p>
          </div>
          <div className="lg:col-span-5 bg-[#061320] border border-cyan-500/30 rounded-xl p-4 text-xs space-y-1.5">
            <div className="text-[11px] font-mono uppercase text-cyan-300">In-silico evidence behind the timing claim</div>
            <p className="text-slate-300">
              Daily decision simulation on {ops.plants} synthetic plants: rotation a median{' '}
              <strong className="text-white">{Math.round(ops.twin.medianDays)} days</strong> before the PFOA/PFOS lead-outlet breach (service
              window {ops.serviceLeadTimeDays} d), never after it. A static vendor curve was late in {ops.staticVendorCurve.afterBreach} of {ops.plants}.
            </p>
            <p className="text-slate-500">
              This supports the timing logic, not the 28% figure: bed-life extension depends on today&apos;s practice at each utility and must
              be measured in the pilot.
            </p>
            <p className="text-slate-500">
              On measured data the timing logic is not yet proven: at a full-scale plant the twin&apos;s lead-outlet 4 ng/L forecast was late in{' '}
              {EXTERNAL_TWIN_CHECK.fullScaleTwinLate} of {EXTERNAL_TWIN_CHECK.fullScaleFourNgLForecasts} cases, while the halfway port itself crossed 4 ng/L
              at {Math.round(Math.min(...EXTERNAL_TWIN_CHECK.midbedLeadRatios) * 100)}–{Math.round(Math.max(...EXTERNAL_TWIN_CHECK.midbedLeadRatios) * 100)}% of the
              outlet&apos;s bed volumes (Twin Lab tab, external checks).
            </p>
          </div>
        </div>
      </div>

      {/* Documented Regulatory, Industry & Literature Validation */}
      <div className="bg-[#0B1D30] border border-emerald-500/30 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              Problem &amp; Architecture Validation • Published Regulatory, Utility &amp; Literature Evidence
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">
              Grounded in US EPA Rulemaking, Xylem/Evoqua Municipal Case Studies &amp; Peer-Reviewed Journals
            </h3>
          </div>
          <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Verifiable Secondary Benchmarks
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STAKEHOLDER_VALIDATION_FINDINGS.map((st, idx) => (
            <div
              key={idx}
              className="bg-[#061320] border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-2.5"
            >
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h4 className="text-xs font-bold text-cyan-300">{st.group}</h4>
                  <span className="self-start sm:self-auto text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 sm:shrink-0">
                    {st.sampleSize}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1.5">{st.keyPainPointValidated}</p>
                <div className="mt-2 pl-2.5 border-l-2 border-amber-400/70 text-[11px] text-amber-200/90">
                  {st.interviewQuote}
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-emerald-400">
                Design Action: {st.designImpactOnPfasSentinel}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Honest Engineering Limitations Matrix */}
      <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
        <div className="mb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            Engineering Integrity • Honest Technical Limitations &amp; Mitigation Architecture
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">
            Transparent Boundary Conditions, Cross-Selectivity &amp; TRL 3 → TRL 6 Validation Plan
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HONEST_LIMITATIONS.map((lim, idx) => (
            <div
              key={idx}
              className="bg-[#061320] border border-slate-800 rounded-xl p-4 space-y-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <h4 className="text-xs font-bold text-amber-300">{lim.challenge}</h4>
                <span className="self-start text-[10px] font-mono bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30 sm:shrink-0 sm:max-w-[45%]">
                  {lim.trlTarget.split('→')[0]}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                <strong className="text-slate-200">Physical Root Cause:</strong> {lim.physicalCause}
              </p>
              <p className="text-xs text-emerald-300/90">
                <strong className="text-emerald-300">PFAS-Sentinel Mitigation:</strong>{' '}
                {lim.pfasSentinelMitigation}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Industry Competitive Landscape Matrix */}
      <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
        <div className="mb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Target className="w-4 h-4" />
            Competitive Benchmarking • Positioning Against Offline Labs, Field Kits &amp; Static Curves
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">
            Why In-Line Mid-Bed Sensing + a Breakthrough Twin Complements Quarterly LC-MS/MS
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[11px]">
                <th className="py-2.5 px-3">Solution / Benchmark</th>
                <th className="py-2.5 px-3">Trace Detection</th>
                <th className="py-2.5 px-3">Physical Treatment &amp; SCADA</th>
                <th className="py-2.5 px-3">Edge Calibration &amp; Twin</th>
                <th className="py-2.5 px-3">Xylem Ecosystem Fit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {COMPETITIVE_LANDSCAPE_2026.map((row, idx) => (
                <tr
                  key={idx}
                  className={
                    idx === 0
                      ? 'bg-cyan-950/30 border-l-2 border-cyan-400'
                      : 'hover:bg-[#10263F]/40'
                  }
                >
                  <td className="py-3 px-3">
                    <div className="font-bold text-white">{row.solutionName}</div>
                    <div className="text-[11px] font-mono text-cyan-400">{row.category}</div>
                  </td>
                  <td className="py-3 px-3 text-slate-300">{row.detectionCapability}</td>
                  <td className="py-3 px-3 text-slate-300">{row.physicalTreatmentIntegration}</td>
                  <td className="py-3 px-3 text-slate-300">{row.digitalTwinAndAi}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10px] block ${
                        idx === 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {row.xylemEcosystemFit}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Post-Challenge Validation Roadmap (TRL 3 -> TRL 6) */}
      <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
        <div className="mb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
            <Rocket className="w-4 h-4" />
            Post-Challenge Validation Roadmap • From TRL 2–3 Simulation to a TRL 6 Pilot
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">
            Proposed 12-Month Software, Hardware &amp; Pilot Verification Plan with Mentors &amp; Utility Partners
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-4xl">
            Two tracks run in parallel. The software track (Phase 0) needs no new hardware and can
            create value on its own; the sensor track de-risks the MIP cartridge step by step. If the
            sensor slips, the utility still benefits from the forecast twin.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-[#061320] border border-purple-500/40 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-purple-300">Months 1 – 4 (Phase 0)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300">
                Software-First, No New Hardware
              </span>
            </div>
            <h4 className="text-xs font-bold text-white">
              Forecast Twin on Existing Grab Samples &amp; Lab Data
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Utilities already take periodic mid-bed and effluent grab samples for LC-MS/MS. The twin
              learns from exactly this kind of sparse data — the current model is trained on only five
              mid-bed checkpoints. Run it in a Xylem Vue sandbox on a partner utility&apos;s historical
              records and score its PFOA/PFOS breakthrough forecasts against what actually happened.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Checks on public measured data (Twin Lab tab) already set the first tasks: a front that
              spreads with depth (the twin&apos;s 4 ng/L outlet forecast was late at a full-scale plant),
              starting values from an RSSCT in site water, and a model-free guard based on the
              mid-bed crossing.
            </p>
          </div>

          <div className="bg-[#061320] border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-cyan-300">Months 1 – 4 (TRL 3 → 4)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                Wet-Lab Spike Calibration
              </span>
            </div>
            <h4 className="text-xs font-bold text-white">
              Stand-Alone MIP Fabrication &amp; 4×4 Selectivity Matrix Benchmarking
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Fabricate prototype 32-channel COC/MIP microfluidic cartridges in university cleanroom
              facilities; quantify actual LOD, channel-to-channel CV, and 4×4 cross-selectivity against
              EPA Method 533 LC-MS/MS in spiked humic water matrices.
            </p>
          </div>

          <div className="bg-[#061320] border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-amber-300">Months 5 – 8 (TRL 4 → 5)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                Bench-Scale GAC Column
              </span>
            </div>
            <h4 className="text-xs font-bold text-white">
              Continuous Rapid Small-Scale Column Test (RSSCT) &amp; Twin Assimilation
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Mount in-line Influent, Mid-Bed (z/L = 0.50), and Effluent pods on bench-scale GAC/IX
              columns; validate 30-day cartridge indexing and live twin breakthrough forecasting
              under variable DOC and flow rates.
            </p>
          </div>

          <div className="bg-[#061320] border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-emerald-300">Months 9 – 12 (TRL 5 → 6)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                Utility Slipstream Pilot
              </span>
            </div>
            <h4 className="text-xs font-bold text-white">
              Municipal Slipstream Trial &amp; Xylem Vue SWE Telemetry Integration
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Connect a side-stream sensor pod to a partner utility GAC vessel’s 1/4&quot; NPT mid-bed
              sample tap; stream live OPC-UA/MQTT telemetry into Xylem Vue sandbox and measure the
              real media lifecycle extension (modeled 28%; break-even 6%).
            </p>
          </div>
        </div>
      </div>

      {/* Final Pitch Video Storyboard */}
      <div className="bg-[#0B1D30] border border-cyan-500/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Video className="w-4 h-4" />
              3-Minute Pitch Architecture (Aligned with Official Xylem Challenge Judging Criteria)
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">
              Focused Storyboard: Mid-Bed Sensing + Breakthrough Twin → Forecast-Gated Media Changeout
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pitchSections.map((sec, idx) => (
            <div
              key={idx}
              className="bg-[#061320] border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">{sec.part}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Criterion: {sec.criterion}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mb-2">{sec.title}</h4>
                <p className="text-xs text-slate-300 italic leading-relaxed">{sec.script}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
