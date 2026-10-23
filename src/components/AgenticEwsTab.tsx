import React, { useState } from 'react';
import {
  Bot,
  CheckCircle2,
  FileCheck2,
  Lock,
  Play,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Truck,
  Zap,
} from 'lucide-react';
import { FacilityProfile } from '../data/pfasPhysicsEngine';

interface AgenticEwsTabProps {
  facility: FacilityProfile;
  operatingDay: number;
  leadLagSwitched: boolean;
  setLeadLagSwitched: (v: boolean) => void;
  mitigatorDispatched: boolean;
  setMitigatorDispatched: (v: boolean) => void;
}

export const AgenticEwsTab: React.FC<AgenticEwsTabProps> = ({
  facility,
  operatingDay,
  leadLagSwitched,
  setLeadLagSwitched,
  mitigatorDispatched,
  setMitigatorDispatched,
}) => {
  const [activeAgentStep, setActiveAgentStep] = useState<number>(4);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);

  const executeFullAutonomousWorkflow = () => {
    setActiveAgentStep(1);
    setTimeout(() => setActiveAgentStep(2), 450);
    setTimeout(() => {
      setActiveAgentStep(3);
      setLeadLagSwitched(true);
    }, 950);
    setTimeout(() => {
      setActiveAgentStep(4);
      setMitigatorDispatched(true);
    }, 1450);
  };

  const agentNodes = [
    {
      step: 1,
      name: 'Agent 01 • Edge Telemetry & Anomaly Perception',
      role: 'Microfluidic MIP + YSI/WTW Matrix Fusion',
      status: 'COMPLETED (15-min cycle)',
      detail:
        'Detects short-chain PFBA/PFBS mass-transfer front crossing 3.1 ppt at Mid-Bed port (z/L = 0.50) while Effluent remains compliant at 0.68 ppt.',
      payload: `{"node":"MID_BED_02","species":"PFBA","c_mid_ppt":3.42,"ysi_ph":${facility.matrixDefaults.pH},"nom_mgl":${facility.matrixDefaults.nomMgL},"matrix_comp":"OK"}`,
    },
    {
      step: 2,
      name: 'Agent 02 • PINN Breakthrough Forecasting Engine',
      role: 'Xylem Vue Smart Water Engine (SWE)',
      status: 'COMPLETED (CI ±3.2 hrs)',
      detail:
        'Updates Thomas kinetic state (k_Th, q_0) with live Sensus flow telemetry (Q). Predicts 4.0 ppt EPA MCL breach in 11 days 14 hours if unmitigated.',
      payload: `{"model":"PINN_Thomas_v2.6","predicted_mcl_breach_hrs":278,"limiting_analyte":"PFBA_C4","recommended_action":"LEAD_LAG_SWITCH"}`,
    },
    {
      step: 3,
      name: 'Agent 03 • Autonomous SCADA Valve Control',
      role: 'Zero-Trust OPC-UA / Modbus PLC Bridge',
      status: leadLagSwitched ? 'EXECUTED (VALVE ACTUATED)' : 'READY TO ACTUATE',
      detail:
        'Commands motorized butterfly valves MV-104 & MV-105 to promote Fresh Lag Polishing Vessel to Primary Lead without human operator latency.',
      payload: `{"scada_cmd":"SET_LEAD_LAG_CONFIG","plc_tag":"MV_104_105","state":"POLISH_ENGAGED","cybersec_sig":"SHA256:9f84e2c1..."}`,
    },
    {
      step: 4,
      name: 'Agent 04 • Evoqua O&M & MitiGATOR™ Logistics + EPA Audit',
      role: 'Servitization ERP & Regulatory Compliance Ledger',
      status: mitigatorDispatched ? 'WORK ORDER & EPA AUDIT LOCKED' : 'STANDBY DISPATCH',
      detail:
        'Schedules Just-In-Time Evoqua GAC/IX media regeneration crew (saving 28% unused bed capacity) and logs an immutable EU 2026 / EPA 2027–2029 compliance record.',
      payload: `{"erp_ticket":"EVO-2026-8841","service":"JIT_MEDIA_REGEN","mitigator_fleet":"STANDBY_READY","epa_4ppt_audit":"COMPLIANT"}`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header aligned with Xylem Vue March 2026 Strategy Report */}
      <div className="bg-[#0B1D30] border border-cyan-500/30 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Bot className="w-4 h-4" />
              Xylem Vue 2026 Strategic Alignment • Agent-Based Early Warning System (EWS)
            </span>
            <h2 className="text-lg font-bold text-white mt-0.5">
              Autonomous Multi-Agent SCADA Control, MitiGATOR™ Dispatch &amp; Regulatory Ledger
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Aligned with Xylem Vue’s March 2026 report (<em>Five Digital Solutions Shaping the Path
              Towards Global Water Digitalization</em>): combining Generative/Agentic AI, Cybersecurity,
              Early Warning Systems, and Servitization PPPs.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={executeFullAutonomousWorkflow}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Full Autonomous Agent Sequence
            </button>
            <button
              onClick={() => setShowAuditModal(!showAuditModal)}
              className="px-3.5 py-2 rounded-lg bg-[#10263F] hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold text-xs flex items-center gap-1.5 transition-all"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              {showAuditModal ? 'Hide Compliance Certificate' : 'View EPA / EU Audit Report'}
            </button>
          </div>
        </div>
      </div>

      {/* 4-Stage Multi-Agent Pipeline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agentNodes.map((agent) => {
          const isActive = activeAgentStep >= agent.step;
          return (
            <div
              key={agent.step}
              onClick={() => setActiveAgentStep(agent.step)}
              className={`rounded-xl p-4 border transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#0B1D30] border-cyan-500/50 shadow-md'
                  : 'bg-[#061320]/70 border-slate-800 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-mono text-cyan-400 uppercase">
                    {agent.role}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-0.5">{agent.name}</h3>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    agent.step === 3 && leadLagSwitched
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : agent.step === 4 && mitigatorDispatched
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {agent.status}
                </span>
              </div>

              <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">{agent.detail}</p>

              <div className="mt-3 bg-[#061320] border border-slate-800 rounded-lg p-2.5 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                <span className="text-slate-500 select-none">$ </span>
                {agent.payload}
              </div>
            </div>
          );
        })}
      </div>

      {/* Immutable Regulatory Compliance Report & Evoqua Work Order */}
      <div className="bg-[#0B1D30] border border-emerald-500/40 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  Immutable Digital Compliance Record &amp; Just-In-Time Evoqua Work Order
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  VERIFIED SHA-256
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Auto-generated for US EPA April 2027/2029 National Primary Drinking Water Regulation &amp; EU 2026 Directive
              </p>
            </div>
          </div>

          <div className="text-right font-mono text-xs">
            <div className="text-slate-400">LEDGER TIMESTAMP</div>
            <div className="text-cyan-300 font-bold">2026-10-23T18:00:00Z (Day {operatingDay})</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs">
          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="font-mono text-[11px] text-cyan-400 uppercase font-bold">
              1. Regulatory Threshold Audit
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Facility ID:</span>
              <span className="font-mono text-white">{facility.shortName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">PFOA / PFOS Effluent:</span>
              <span className="font-mono text-emerald-400 font-bold">&lt; 0.85 ppt (MCL: 4.0)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Short-Chain PFBA/PFBS:</span>
              <span className="font-mono text-emerald-400 font-bold">Polished via Lag Bed</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Compliance Status:</span>
              <span className="font-mono text-emerald-300 font-bold">100% CONTINUOUS PASS</span>
            </div>
          </div>

          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="font-mono text-[11px] text-amber-400 uppercase font-bold">
              2. Evoqua Just-In-Time Media Dispatch
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Work Order #:</span>
              <span className="font-mono text-white">EVO-REGEN-88412</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Lead Vessel Utilisation:</span>
              <span className="font-mono text-amber-300 font-bold">96.4% (Optimal Exhaustion)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Unwasted Media Saved:</span>
              <span className="font-mono text-emerald-400 font-bold">2,540 kg GAC/IX Saved</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">MitiGATOR™ Mobile Unit:</span>
              <span className="font-mono text-cyan-300">
                {mitigatorDispatched ? 'ACTIVE ON-SITE' : 'GEOFENCED STANDBY'}
              </span>
            </div>
          </div>

          <div className="bg-[#061320] border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="font-mono text-[11px] text-emerald-400 uppercase font-bold">
              3. Environmental &amp; GHG Impact
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Secondary Hazardous Waste:</span>
              <span className="font-mono text-emerald-400 font-bold">-28.5% Reduction</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Reactivation Kiln CO₂e Saved:</span>
              <span className="font-mono text-emerald-400 font-bold">14.2 Metric Tons CO₂e/yr</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">LC-MS/MS Lab Trips Eliminated:</span>
              <span className="font-mono text-white">144 Courier Shipments/yr</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Xylem Net-Zero Alignment:</span>
              <span className="font-mono text-cyan-300 font-bold">Scope 3 Verified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
