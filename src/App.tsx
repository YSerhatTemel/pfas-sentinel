import React, { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, Bot, Droplets, Gauge, Microscope, ShieldCheck, TrendingUp } from 'lucide-react';
import { XYLEM_FACILITIES, FacilityProfile } from './data/pfasPhysicsEngine';
import { computeSituation, ScenarioId } from './data/situation';
import { AuditEvent, AuditSource, FaultInjection, NO_FAULTS, evaluateManualOverride } from './data/ewsDecision';
import { CyberPhysicalTwinTab } from './components/CyberPhysicalTwinTab';
import { MipBiosensorTab } from './components/MipBiosensorTab';
import { PinnBreakthroughTab } from './components/PinnBreakthroughTab';
import { AgenticEwsTab } from './components/AgenticEwsTab';
import { BusinessAndPitchTab } from './components/BusinessAndPitchTab';
import { GlossaryPanel } from './components/GlossaryPanel';

type TabId = 'twin' | 'biosensor' | 'pinn' | 'agentic' | 'business';
type SpeciesKey = 'PFOA' | 'PFOS' | 'PFBS' | 'PFBA';

const SCENARIO_PRESETS: Record<ScenarioId, { day?: number; flow: number; c0: number; species: SpeciesKey; label: string }> = {
  normal: { flow: 1.0, c0: 1.0, species: 'PFBA', label: 'Baseline operation' },
  'short-chain': { day: 148, flow: 1.1, c0: 1.15, species: 'PFBA', label: 'Short-chain PFBA/PFBS mid-bed alert' },
  'afff-surge': { day: 162, flow: 1.35, c0: 1.65, species: 'PFOS', label: 'AFFF plume surge (flow +35%, influent +65%)' },
  'matrix-storm': { day: 138, flow: 1.25, c0: 1.1, species: 'PFBS', label: 'High-NOM storm matrix (NOM x2.15)' },
};

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('twin');
  const [showGlossary, setShowGlossary] = useState<boolean>(false);
  const [facilityId, setFacilityId] = useState<string>(XYLEM_FACILITIES[0].id);
  const facility: FacilityProfile = XYLEM_FACILITIES.find((f) => f.id === facilityId) || XYLEM_FACILITIES[0];

  const [operatingDay, setOperatingDay] = useState<number>(facility.currentOperatingDay);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesKey>('PFBA');
  const [flowMultiplier, setFlowMultiplier] = useState<number>(1.0);
  const [c0Multiplier, setC0Multiplier] = useState<number>(1.0);
  const [activeScenario, setActiveScenario] = useState<ScenarioId>('normal');
  const [switchDay, setSwitchDay] = useState<number | null>(null);
  const [mitigatorDispatched, setMitigatorDispatched] = useState<boolean>(false);
  const [scadaMode, setScadaMode] = useState<'autonomous' | 'human-in-the-loop'>('human-in-the-loop');
  const [operatorApproved, setOperatorApproved] = useState<boolean>(false);
  const [faults, setFaults] = useState<FaultInjection>(NO_FAULTS);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);

  // Time simulation loop when "Simulate Time" is active
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setOperatingDay((prev) => (prev >= 395 ? 30 : prev + 3));
    }, 650);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const situation = useMemo(
    () =>
      computeSituation({
        facility,
        operatingDay,
        flowMultiplier,
        c0Multiplier,
        scenario: activeScenario,
        switchDay,
        scadaMode,
        operatorApproved,
        faults,
      }),
    [facility, operatingDay, flowMultiplier, c0Multiplier, activeScenario, switchDay, scadaMode, operatorApproved, faults]
  );

  const appendAudit = (source: AuditSource, action: string, details: string, actor = 'Operator (demo user)') => {
    setAuditLog((prev) =>
      [
        { id: (prev[0]?.id ?? 0) + 1, timestampIso: new Date().toISOString(), operatingDay, actor, source, action, details },
        ...prev,
      ].slice(0, 60)
    );
  };

  const resetPlantState = () => {
    setSwitchDay(null);
    setMitigatorDispatched(false);
    setFaults(NO_FAULTS);
  };

  const handleFacilityChange = (newId: string) => {
    const found = XYLEM_FACILITIES.find((f) => f.id === newId);
    if (!found) return;
    setFacilityId(newId);
    setOperatingDay(found.currentOperatingDay);
    setFlowMultiplier(1.0);
    setC0Multiplier(1.0);
    setActiveScenario('normal');
    resetPlantState();
    appendAudit('RESET', 'FACILITY_CHANGED', `Representative facility switched to ${found.shortName}; demo state reset.`);
  };

  // Scenario presets only change plant conditions; any valve action still goes through the EWS rules.
  const handleTriggerScenario = (scenario: ScenarioId) => {
    const preset = SCENARIO_PRESETS[scenario];
    setActiveScenario(scenario);
    setOperatingDay(preset.day ?? facility.currentOperatingDay);
    setFlowMultiplier(preset.flow);
    setC0Multiplier(preset.c0);
    setSelectedSpecies(preset.species);
    resetPlantState();
    appendAudit('SCENARIO_PRESET', scenario.toUpperCase(), `${preset.label}. Rotation and dispatch state reset.`);
  };

  const runEwsDecision = () => {
    const d = situation.decision;
    if (d.action === 'ACTUATE') {
      setSwitchDay(operatingDay);
      appendAudit(
        'EWS_DECISION',
        'ROTATE_LEAD_LAG',
        `${d.reasons.join(' ')} Evoqua media service work order raised for the exhausted vessel.`,
        scadaMode === 'autonomous' ? 'EWS (autonomous mode)' : 'Operator (demo user) via co-pilot sign-off'
      );
      if (d.mitigatorRecommended) {
        appendAudit('MITIGATOR_DISPATCH', 'RECOMMENDED', 'Breach inside the emergency lead time: MitiGATOR contingency recommended (dispatch needs operator confirmation).', 'EWS');
      }
      return;
    }
    appendAudit('EWS_DECISION', d.action, [...d.reasons, ...d.blockers].join(' '), 'EWS');
  };

  const toggleManualRotation = () => {
    if (situation.rotated) {
      setSwitchDay(null);
      appendAudit('RESET', 'UNDO_ROTATION', 'Demo reset: lead-lag rotation undone.');
      return;
    }
    const check = evaluateManualOverride(situation.interlockTelemetry);
    if (!check.allowed) {
      appendAudit('MANUAL_OVERRIDE', 'BLOCKED', check.blockers.join(' '));
      return;
    }
    setSwitchDay(operatingDay);
    appendAudit(
      'MANUAL_OVERRIDE',
      'ROTATE_LEAD_LAG',
      `Manual override: forecast rule bypassed (EWS state was ${situation.decision.action}). Hydraulic interlock passed.`
    );
  };

  const toggleMitigator = () => {
    appendAudit(
      'MITIGATOR_DISPATCH',
      mitigatorDispatched ? 'RECALL' : 'DISPATCH',
      mitigatorDispatched ? 'MitiGATOR mobile unit recalled.' : 'Operator dispatched a MitiGATOR mobile unit (contingency).'
    );
    setMitigatorDispatched(!mitigatorDispatched);
  };

  const navTabs: { id: TabId; label: string; badge: string; icon: React.ReactNode }[] = [
    { id: 'twin', label: '1. Cyber-Physical Twin', badge: 'Simulated plant', icon: <Gauge className="w-4 h-4" /> },
    { id: 'biosensor', label: '2. Microfluidic MIP & 3D CAD', badge: 'Target 4 ppt', icon: <Microscope className="w-4 h-4" /> },
    { id: 'pinn', label: '3. Breakthrough Twin Lab', badge: 'Validation', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'agentic', label: '4. Early-Warning System & MitiGATOR™', badge: 'Interlocked', icon: <Bot className="w-4 h-4" /> },
    { id: 'business', label: '5. Servitization ROI & Pitch', badge: 'Impact & ROI', icon: <Award className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#061320] text-slate-100 flex flex-col">
      {/* Top Industrial Header Bar */}
      <header className="relative md:sticky md:top-0 z-30 bg-[#061320]/95 backdrop-blur-md border-b border-slate-800/90 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand Logo & Xylem Vue Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-300/40">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-white">PFAS-Sentinel™</h1>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Designed for Xylem Vue (GoAigua SWE)
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Challenge #2: Water Quality
                </span>
                <span className="hidden lg:inline-block px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  TRL 2–3 In-Silico Twin
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Microfluidic MIP-electrochemical sensor concept &amp; physics-based breakthrough twin for media lifecycle optimization
              </p>
            </div>
          </div>

          {/* Right Facility Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400 hidden md:inline">Representative Facility:</span>
            <div className="flex items-center gap-1 bg-[#0B1D30] p-1 rounded-lg border border-slate-800">
              {XYLEM_FACILITIES.map((fac) => (
                <button
                  key={fac.id}
                  onClick={() => handleFacilityChange(fac.id)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    facilityId === fac.id ? 'bg-cyan-500 text-slate-950 font-bold shadow' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {fac.shortName}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-7xl mx-auto mt-3 pt-2 border-t border-slate-800/70 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-[#10263F] text-cyan-300 border-cyan-500/60 shadow-sm'
                    : 'bg-transparent text-slate-400 border-transparent hover:bg-[#0B1D30] hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    isActive ? 'bg-cyan-500/20 text-cyan-200' : 'bg-slate-800/90 text-slate-400'
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => setShowGlossary(!showGlossary)}
            className={`ml-auto flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
              showGlossary
                ? 'bg-amber-500/20 text-amber-200 border-amber-500/50'
                : 'bg-transparent text-amber-300 border-amber-500/30 hover:bg-amber-500/10'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Key Terms
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {showGlossary && <GlossaryPanel onClose={() => setShowGlossary(false)} />}
        {activeTab === 'twin' && (
          <CyberPhysicalTwinTab
            facility={facility}
            operatingDay={operatingDay}
            setOperatingDay={setOperatingDay}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            selectedSpecies={selectedSpecies}
            setSelectedSpecies={setSelectedSpecies}
            flowMultiplier={flowMultiplier}
            setFlowMultiplier={setFlowMultiplier}
            c0Multiplier={c0Multiplier}
            setC0Multiplier={setC0Multiplier}
            situation={situation}
            mitigatorDispatched={mitigatorDispatched}
            onToggleManualRotation={toggleManualRotation}
            onToggleMitigator={toggleMitigator}
            onTriggerScenario={handleTriggerScenario}
            activeScenario={activeScenario}
          />
        )}

        {activeTab === 'biosensor' && <MipBiosensorTab />}

        {activeTab === 'pinn' && (
          <PinnBreakthroughTab key={facility.id} facility={facility} operatingDay={operatingDay} setOperatingDay={setOperatingDay} />
        )}

        {activeTab === 'agentic' && (
          <AgenticEwsTab
            facility={facility}
            operatingDay={operatingDay}
            situation={situation}
            scadaMode={scadaMode}
            setScadaMode={setScadaMode}
            operatorApproved={operatorApproved}
            setOperatorApproved={setOperatorApproved}
            faults={faults}
            setFaults={setFaults}
            mitigatorDispatched={mitigatorDispatched}
            onRunDecision={runEwsDecision}
            onToggleManualRotation={toggleManualRotation}
            onToggleMitigator={toggleMitigator}
            auditLog={auditLog}
          />
        )}

        {activeTab === 'business' && <BusinessAndPitchTab />}
      </main>

      {/* Footer with Xylem Ecosystem Badges */}
      <footer className="bg-[#0B1D30] border-t border-slate-800/90 px-4 lg:px-8 py-4 mt-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>
              <strong className="text-slate-200">PFAS-Sentinel</strong> • Independent student project for the Xylem
              Global Student Innovation Challenge 2026 (Challenge #2: Water Quality) • Not developed or endorsed by Xylem
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded bg-[#061320] border border-slate-800 text-cyan-300">Xylem Vue (GoAigua SWE)</span>
            <span className="px-2 py-0.5 rounded bg-[#061320] border border-slate-800 text-emerald-300">Evoqua GAC &amp; Selective IX</span>
            <span className="px-2 py-0.5 rounded bg-[#061320] border border-slate-800 text-amber-300">MitiGATOR™ Mobile Units</span>
            <span className="px-2 py-0.5 rounded bg-[#061320] border border-slate-800 text-purple-300">YSI EXO2 + Sensus/MJK Telemetry</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default App;
