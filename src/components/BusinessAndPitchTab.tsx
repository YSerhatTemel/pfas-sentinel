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
  HONEST_LIMITATIONS,
  REGULATORY_TIMELINE,
  MARKET_OPERATIONAL_SHARES_2026,
  STAKEHOLDER_VALIDATION_FINDINGS,
  COMPETITIVE_LANDSCAPE_2026,
} from '../data/pfasPhysicsEngine';

export const BusinessAndPitchTab: React.FC = () => {
  const [utilityVessels, setUtilityVessels] = useState<number>(6);
  const [annualMediaCostPerVessel, setAnnualMediaCostPerVessel] = useState<number>(85000);
  const [savingsRatePct, setSavingsRatePct] = useState<number>(28);

  // Financial & environmental calculations
  const baselineAnnualMediaOpex = utilityVessels * annualMediaCostPerVessel;
  const baselineLabTestingAnnual = utilityVessels * 26 * 420; // Bi-weekly LC-MS/MS ($420/sample)

  const pfasSentinelSubscriptionAnnual = utilityVessels * 14400; // $1,200/month per vessel Hardware-enabled SaaS + cartridges
  const mediaSavingsUsd = Math.round(baselineAnnualMediaOpex * (savingsRatePct / 100));
  const labSavingsUsd = Math.round(baselineLabTestingAnnual * 0.85); // Retain quarterly regulatory certification LC-MS/MS
  const netAnnualUtilitySavings =
    mediaSavingsUsd + labSavingsUsd - pfasSentinelSubscriptionAnnual;

  const hazardousWasteAvoidedTons = Number(
    (utilityVessels * 9.1 * (savingsRatePct / 100)).toFixed(1)
  );
  const ghgAvoidedTonsCo2 = Number((hazardousWasteAvoidedTons * 2.4).toFixed(1));

  const pitchSections = [
    {
      part: 'Part 1 • 0:00 – 0:30',
      title: 'The Core Problem: 14-Day Lab Blindness & Premature Media Waste',
      criterion: 'Challenge Fit & Feasibility',
      script:
        '“Under the EU 2026 Directive and the US EPA’s binding 4 parts-per-trillion rule, water utilities must eliminate PFAS forever chemicals. Yet today’s Granular Activated Carbon and Ion Exchange vessels operate blind: off-site LC-MS/MS lab tests take 10 to 14 days and cost $400 per sample. Because short-chain PFBA and PFBS break through early and suffer chromatographic roll-up above influent levels, utilities are forced to dump 25 to 30% of their filtration media prematurely just to guarantee compliance—wasting millions in lifecycle O&M.”',
    },
    {
      part: 'Part 2 • 0:30 – 1:40',
      title: 'Core Innovation: Mid-Bed Retrofit Sensor + 1D Advection-Sorption PINN',
      criterion: 'Innovation & Creativity',
      script:
        '“Meet PFAS-Sentinel: a cyber-physical early warning module designed for Xylem Vue powered by GoAigua. Rather than requiring new treatment tanks, our reader pod retrofits directly onto the existing mid-bed sampling port (z/L = 0.50) of standard GAC and IX vessels. Inside, a proposed 32-channel microfluidic MIP-nanocarbon cartridge pairs 4 NIP blank channels with YSI/WTW sonde telemetry and 4×4 cross-selectivity deconvolution to target 1 to 4 ppt detection in 15 minutes. This mid-bed telemetry feeds a Physics-Informed Neural Network governed by the 1D Advection-Sorption PDE—tracking the mass-transfer wave and switching SCADA lead-lag valves weeks before effluent reaches 4 ppt.”',
    },
    {
      part: 'Part 3 • 1:40 – 2:25',
      title: 'Engineering Integrity, Literature Validation & Servitization ROI',
      criterion: 'Challenge Fit & Feasibility',
      script:
        '“Built as a rigorous TRL 3 in-silico digital twin, our kinetic model is benchmarked against published pilot-column breakthrough and C4 roll-up data from Water Research and Environmental Science & Technology. Commercially, PFAS-Sentinel eliminates upfront utility CAPEX by integrating into Evoqua media service contracts via a projected $11.80 disposable cartridge—saving over $120,000 annually across a 6-vessel utility while retaining quarterly LC-MS/MS for statutory sign-off.”',
    },
    {
      part: 'Part 4 • 2:25 – 3:00',
      title: 'Measurable Impact & TRL 3 → TRL 6 Validation Roadmap',
      criterion: 'Impact & Scalability',
      script:
        '“Across a typical 6-vessel municipal plant, extending bed utilization by 28% prevents 15 tons of spent PFAS-laden hazardous waste and 36 tons of Scope 3 CO₂ emissions every year. Following this challenge, our 6-month roadmap focuses on transitioning from TRL 3 numerical simulation to TRL 4–6 wet-lab spike calibration and pilot column testing with Xylem electrochemistry and filtration mentors.”',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Market Intelligence Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-mono text-cyan-400 uppercase">2035 Global PFAS Market</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">$16.20B</div>
          <p className="text-xs text-slate-400 mt-1">
            Filtration tech doubles from $2.19B (2025) to $4.31B (2035)
          </p>
        </div>

        <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-mono text-purple-400 uppercase">
            POE Systems (3.1% CAGR)
          </span>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            $205.4M <span className="text-xs text-purple-300">→ $254.3M</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Point-of-Entry PFAS treatment growth from 2026 base to 2033
          </p>
        </div>

        <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-mono text-amber-400 uppercase">
            Lifecycle Media &amp; O&amp;M Share
          </span>
          <div className="text-2xl font-bold font-mono text-white mt-1">40% – 45%</div>
          <p className="text-xs text-slate-400 mt-1">
            Of total system lifetime expenditure goes to GAC/IX replacement
          </p>
        </div>

        <div className="bg-[#0B1D30] border border-emerald-500/30 rounded-xl p-4">
          <span className="text-xs font-mono text-emerald-400 uppercase">
            Target Media Life Extension
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">25% – 30%</div>
          <p className="text-xs text-slate-400 mt-1">
            Eliminates premature &quot;blind breakthrough&quot; media changeouts
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

      {/* Regulatory Compliance Timeline (2024-2029) & Market/Operational Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Regulatory Timeline (2024 - 2029) */}
        <div className="lg:col-span-6 bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
          <div className="mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Market Driver • Regulatory Compliance Timeline (2024 – 2029)
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
              PFAS Treatment Market &amp; Operational Cost Structure (%)
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">
              Technology Dominance, Regional Share &amp; Recurring O&amp;M Lifetime Value
            </h3>
          </div>

          <div className="space-y-3 bg-[#061320] p-3.5 rounded-xl border border-slate-800">
            {MARKET_OPERATIONAL_SHARES_2026.map((bar, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{bar.label}</span>
                  <span className="font-mono font-bold" style={{ color: bar.color }}>
                    {bar.percentage}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${bar.percentage}%`, backgroundColor: bar.color }}
                  />
                </div>
                <p className="text-[11px] text-slate-400">{bar.detail}</p>
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
                  ${annualMediaCostPerVessel.toLocaleString()} / yr
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
                <span className="text-slate-300">Target PINN Lifecycle Extension (20–30%):</span>
                <span className="font-mono font-bold text-emerald-300">{savingsRatePct}%</span>
              </div>
              <input
                type="range"
                min={20}
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
                ${netAnnualUtilitySavings.toLocaleString()}/yr
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">
                After ${pfasSentinelSubscriptionAnnual.toLocaleString()}/yr SaaS + Cartridge fee
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
                Supports Xylem’s Net-Zero Servitization goals
              </span>
            </div>
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
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-cyan-300">{st.group}</h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
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
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-xs font-bold text-amber-300">{lim.challenge}</h4>
                <span className="text-[10px] font-mono bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30 shrink-0">
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
            Why In-Line Mid-Bed Sensing + PINN Digital Twin Complements Quarterly LC-MS/MS Certification
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
            Post-Challenge Validation Roadmap • Advancing from TRL 3 Simulation to TRL 6 Pilot
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">
            Proposed 6-Month Hardware &amp; Pilot Verification Plan with Mentors &amp; Utility Partners
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#061320] border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-cyan-300">Months 1 – 2 (TRL 3 → 4)</span>
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
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-300">Months 3 – 4 (TRL 4 → 5)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                Bench-Scale GAC Column
              </span>
            </div>
            <h4 className="text-xs font-bold text-white">
              Continuous Rapid Small-Scale Column Test (RSSCT) &amp; PINN Assimilation
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Mount in-line Influent, Mid-Bed (z/L = 0.50), and Effluent pods on bench-scale GAC/IX
              columns; validate 30-day cartridge indexing and live PINN breakthrough forecasting
              under variable DOC and flow rates.
            </p>
          </div>

          <div className="bg-[#061320] border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-emerald-300">Months 5 – 6 (TRL 5 → 6)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                Utility Slipstream Pilot
              </span>
            </div>
            <h4 className="text-xs font-bold text-white">
              Municipal Slipstream Trial &amp; Xylem Vue SWE Telemetry Integration
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Connect a side-stream sensor pod to a partner utility GAC vessel’s 1/4&quot; NPT mid-bed
              sample tap; stream live OPC-UA/MQTT telemetry into Xylem Vue sandbox and verify
              projected 25–30% media lifecycle extension.
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
              Focused Storyboard: Mid-Bed Real-Time Sensing + PINN Breakthrough Twin → ~28% Media Savings
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
