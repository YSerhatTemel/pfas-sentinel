import React, { useState } from 'react';
import {
  Award,
  BarChart3,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Leaf,
  Rocket,
  ShieldAlert,
  TrendingDown,
  Video,
} from 'lucide-react';
import { HONEST_LIMITATIONS } from '../data/pfasPhysicsEngine';

export const BusinessAndPitchTab: React.FC = () => {
  const [utilityVessels, setUtilityVessels] = useState<number>(6);
  const [annualMediaCostPerVessel, setAnnualMediaCostPerVessel] = useState<number>(85000);
  const [savingsRatePct, setSavingsRatePct] = useState<number>(28);

  // Financial & environmental calculations
  const baselineAnnualMediaOpex = utilityVessels * annualMediaCostPerVessel;
  const baselineLabTestingAnnual = utilityVessels * 26 * 420; // Bi-weekly LC-MS/MS ($420/sample)
  const totalBaselineAnnualOpex = baselineAnnualMediaOpex + baselineLabTestingAnnual;

  const pfasSentinelSubscriptionAnnual = utilityVessels * 14400; // $1,200/month per vessel Hardware-enabled SaaS + cartridges
  const mediaSavingsUsd = Math.round(baselineAnnualMediaOpex * (savingsRatePct / 100));
  const labSavingsUsd = Math.round(baselineLabTestingAnnual * 0.85); // Retain only quarterly regulatory validation LC-MS/MS
  const netAnnualUtilitySavings =
    mediaSavingsUsd + labSavingsUsd - pfasSentinelSubscriptionAnnual;

  const hazardousWasteAvoidedTons = Number(
    (utilityVessels * 9.1 * (savingsRatePct / 100)).toFixed(1)
  );
  const ghgAvoidedTonsCo2 = Number((hazardousWasteAvoidedTons * 2.4).toFixed(1));

  const pitchSections = [
    {
      part: 'Part 1 • 15% Duration (0:00 – 0:27)',
      title: 'Regulatory Crisis & Operational Blindness',
      criterion: 'Challenge Fit',
      script:
        '“By 2026 in the EU and 2027–2029 under US EPA’s binding 4 parts-per-trillion rule, water utilities must eliminate PFAS forever chemicals. Yet today’s Granular Activated Carbon and Ion Exchange vessels run blind: centralized LC-MS/MS lab tests take 14 days and cost $400 per sample. Because short-chain PFBA and PFBS break through carbon beds early, utilities either risk toxic leakage or prematurely dump millions of dollars of unexhausted media—driving 40 to 45% of total lifecycle cost.”',
    },
    {
      part: 'Part 2 • 40% Duration (0:27 – 1:40)',
      title: 'Cyber-Physical Innovation & Live Xylem Vue Demo',
      criterion: 'Innovation & UX',
      script:
        '“Meet PFAS-Sentinel: a native hardware-enabled SaaS module for Xylem Vue powered by GoAigua. At the edge, our 32-channel microfluidic cartridge pairs a Stand-Alone Molecularly Imprinted Polymer membrane with amine-functionalized nanocarbon electrodes—delivering 1 to 4 ppt sensitivity in 15 minutes. Fusing Xylem YSI and WTW water quality telemetry, our Edge AI eliminates matrix drift and feeds a Physics-Informed Neural Network (PINN) governed by the Thomas kinetic model. When the mid-bed sensor detects the mass-transfer front, our autonomous agent switches the SCADA lead-lag valve and dispatches Xylem’s Evoqua regeneration crew or MitiGATOR™ mobile fleet before effluent ever reaches 4 ppt.”',
    },
    {
      part: 'Part 3 • 25% Duration (1:40 – 2:25)',
      title: 'Unit Economics, Servitization & Field Validation',
      criterion: 'Feasibility',
      script:
        '“Instead of heavy upfront CAPEX, PFAS-Sentinel integrates directly into Xylem’s performance-based O&M and Evoqua media rental contracts using an $11.80 razor-and-blade cartridge. Across a 6-vessel utility like Xylem’s Maine KKWWD or Colorado SHWSD benchmark sites, extending bed life by 28% saves over $120,000 annually while openly addressing NOM fouling via differential NIP reference channels.”',
    },
    {
      part: 'Part 4 • 20% Duration (2:25 – 3:00)',
      title: 'Global Scalability & Xylem Ignite Incubator Roadmap',
      criterion: 'Impact',
      script:
        '“In the $16.2 billion PFAS treatment market, PFAS-Sentinel transforms media replacement from blind guesswork into autonomous precision. Over the 6-month Xylem Ignite Innovation Incubator, we will work with Xylem mentors to advance from TRL 3/4 lab validation to TRL 6 pilot testing on Evoqua GAC columns—protecting millions of citizens while cutting secondary hazardous waste and Scope 3 carbon emissions by 28%.”',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Market Intelligence Summary Row (Data from PDF Page 8 & 9) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-mono text-cyan-400 uppercase">2035 Total PFAS Market</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">$16.20B</div>
          <p className="text-xs text-slate-400 mt-1">
            Filtration tech doubles from $2.19B (2025) to $4.31B (2035)
          </p>
        </div>

        <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-mono text-amber-400 uppercase">
            Lifecycle Media &amp; O&amp;M Share
          </span>
          <div className="text-2xl font-bold font-mono text-white mt-1">40% – 45%</div>
          <p className="text-xs text-slate-400 mt-1">
            Of total system lifetime value is spent on GAC/IX replacement
          </p>
        </div>

        <div className="bg-[#0B1D30] border border-emerald-500/30 rounded-xl p-4">
          <span className="text-xs font-mono text-emerald-400 uppercase">
            PFAS-Sentinel Media Savings
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">25% – 30%</div>
          <p className="text-xs text-slate-400 mt-1">
            Eliminates premature &quot;blind breakthrough&quot; media disposal
          </p>
        </div>

        <div className="bg-[#0B1D30] border border-cyan-500/30 rounded-xl p-4">
          <span className="text-xs font-mono text-cyan-300 uppercase">Assay Cost &amp; Turnaround</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            $11.80 <span className="text-xs text-emerald-400">(15 min)</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            vs. $350–$500 &amp; 14-day delay for centralized LC-MS/MS
          </p>
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
                <span className="text-slate-300">PINN Lifecycle Extension Rate (25–30%):</span>
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

      {/* Honest Engineering Limitations Matrix (Winning Differentiator from PDF Page 5 & 17) */}
      <div className="bg-[#0B1D30] border border-slate-800 rounded-xl p-5">
        <div className="mb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            Engineering Integrity • Honest Technical Limitations &amp; Mitigation Architecture
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">
            Transparent Boundary Conditions &amp; Xylem Ignite Incubator (TRL 3 → TRL 6) Validation Plan
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

      {/* Final Pitch Video Storyboard (PDF Pages 18-19) */}
      <div className="bg-[#0B1D30] border border-cyan-500/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Video className="w-4 h-4" />
              Grand Prize Pitch Architecture (3-Minute BeMyApp Submission Blueprint)
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">
              4-Stage Jury Rubric Storyboard &amp; Teleprompter Script
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
                    Rubric: {sec.criterion}
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
