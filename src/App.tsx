import React, { useState, useEffect } from 'react';
import {
  Activity,
  Award,
  Bot,
  Cpu,
  Droplets,
  Gauge,
  Layers,
  Microscope,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { XYLEM_FACILITIES, FacilityProfile } from './data/pfasPhysicsEngine';
import { CyberPhysicalTwinTab } from './components/CyberPhysicalTwinTab';
import { MipBiosensorTab } from './components/MipBiosensorTab';
import { PinnBreakthroughTab } from './components/PinnBreakthroughTab';
import { AgenticEwsTab } from './components/AgenticEwsTab';
import { BusinessAndPitchTab } from './components/BusinessAndPitchTab';

type TabId = 'twin' | 'biosensor' | 'pinn' | 'agentic' | 'business';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('twin');
  const [facilityId, setFacilityId] = useState<string>(XYLEM_FACILITIES[0].id);
  const facility: FacilityProfile =
    XYLEM_FACILITIES.find((f) => f.id === facilityId) || XYLEM_FACILITIES[0];

  const [operatingDay, setOperatingDay] = useState<number>(facility.currentOperatingDay);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedSpecies, setSelectedSpecies] = useState<'PFOA' | 'PFOS' | 'PFBS' | 'PFBA'>('PFBA');
  const [flowMultiplier, setFlowMultiplier] = useState<number>(1.0);
  const [c0Multiplier, setC0Multiplier] = useState<number>(1.0);
  const [leadLagSwitched, setLeadLagSwitched] = useState<boolean>(false);
  const [mitigatorDispatched, setMitigatorDispatched] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<
    'normal' | 'short-chain' | 'afff-surge' | 'matrix-storm'
  >('normal');

  // Time simulation loop when "Simulate Time" is active
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setOperatingDay((prev) => (prev >= 215 ? 30 : prev + 2));
    }, 650);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const handleFacilityChange = (newId: string) => {
    setFacilityId(newId);
    const found = XYLEM_FACILITIES.find((f) => f.id === newId);
    if (found) {
      setOperatingDay(found.currentOperatingDay);
      setFlowMultiplier(1.0);
      setC0Multiplier(1.0);
      setLeadLagSwitched(false);
      setMitigatorDispatched(false);
      setActiveScenario('normal');
    }
  };

  const handleTriggerScenario = (
    scenario: 'normal' | 'short-chain' | 'afff-surge' | 'matrix-storm'
  ) => {
    setActiveScenario(scenario);
    if (scenario === 'normal') {
      setOperatingDay(facility.currentOperatingDay);
      setFlowMultiplier(1.0);
      setC0Multiplier(1.0);
      setSelectedSpecies('PFBA');
      setLeadLagSwitched(false);
      setMitigatorDispatched(false);
    } else if (scenario === 'short-chain') {
      setOperatingDay(148);
      setFlowMultiplier(1.1);
      setC0Multiplier(1.15);
      setSelectedSpecies('PFBA');
      setLeadLagSwitched(false);
      setMitigatorDispatched(false);
    } else if (scenario === 'afff-surge') {
      setOperatingDay(162);
      setFlowMultiplier(1.35);
      setC0Multiplier(1.65);
      setSelectedSpecies('PFOS');
      setLeadLagSwitched(true);
      setMitigatorDispatched(true);
    } else if (scenario === 'matrix-storm') {
      setOperatingDay(138);
      setFlowMultiplier(1.25);
      setC0Multiplier(1.1);
      setSelectedSpecies('PFBS');
      setLeadLagSwitched(false);
      setMitigatorDispatched(false);
    }
  };

  const navTabs: { id: TabId; label: string; badge: string; icon: React.ReactNode }[] = [
    {
      id: 'twin',
      label: '1. Cyber-Physical Twin (SWE)',
      badge: 'Live SCADA',
      icon: <Gauge className="w-4 h-4" />,
    },
    {
      id: 'biosensor',
      label: '2. Microfluidic MIP & 3D CAD',
      badge: '4 ppt / 15m',
      icon: <Microscope className="w-4 h-4" />,
    },
    {
      id: 'pinn',
      label: '3. PINN Breakthrough Lab',
      badge: 'Thomas Kinetics',
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      id: 'agentic',
      label: '4. Agentic EWS & MitiGATOR™',
      badge: 'Autonomous',
      icon: <Bot className="w-4 h-4" />,
    },
    {
      id: 'business',
      label: '5. Servitization ROI & Pitch',
      badge: 'Grand Prize',
      icon: <Award className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#061320] text-slate-100 flex flex-col">
      {/* Top Industrial Header Bar */}
      <header className="sticky top-0 z-30 bg-[#061320]/95 backdrop-blur-md border-b border-slate-800/90 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand Logo & Xylem Vue Native Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-300/40">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-white">
                  PFAS-Sentinel™
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Xylem Vue SWE Compatible
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Challenge #2: Water Quality
                </span>
                <span className="hidden lg:inline-block px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  TRL 3 In-Silico Twin
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Microfluidic MIP-Electrochemical Biosensor &amp; Agentic PINN Digital Twin for Media Lifecycle Optimization
              </p>
            </div>
          </div>

          {/* Right Benchmark Facility Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400 hidden md:inline">
              Xylem Reference Twin:
            </span>
            <div className="flex items-center gap-1 bg-[#0B1D30] p-1 rounded-lg border border-slate-800">
              {XYLEM_FACILITIES.map((fac) => (
                <button
                  key={fac.id}
                  onClick={() => handleFacilityChange(fac.id)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    facilityId === fac.id
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                      : 'text-slate-300 hover:text-white'
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
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-200'
                      : 'bg-slate-800/90 text-slate-400'
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
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
            leadLagSwitched={leadLagSwitched}
            setLeadLagSwitched={setLeadLagSwitched}
            mitigatorDispatched={mitigatorDispatched}
            setMitigatorDispatched={setMitigatorDispatched}
            onTriggerScenario={handleTriggerScenario}
            activeScenario={activeScenario}
          />
        )}

        {activeTab === 'biosensor' && <MipBiosensorTab />}

        {activeTab === 'pinn' && (
          <PinnBreakthroughTab
            facility={facility}
            operatingDay={operatingDay}
            setOperatingDay={setOperatingDay}
          />
        )}

        {activeTab === 'agentic' && (
          <AgenticEwsTab
            facility={facility}
            operatingDay={operatingDay}
            selectedSpecies={selectedSpecies}
            flowMultiplier={flowMultiplier}
            c0Multiplier={c0Multiplier}
            leadLagSwitched={leadLagSwitched}
            setLeadLagSwitched={setLeadLagSwitched}
            mitigatorDispatched={mitigatorDispatched}
            setMitigatorDispatched={setMitigatorDispatched}
          />
        )}

        {activeTab === 'business' && <BusinessAndPitchTab />}
      </main>

      {/* Footer with Xylem Ecosystem Integration Badges */}
      <footer className="bg-[#0B1D30] border-t border-slate-800/90 px-4 lg:px-8 py-4 mt-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>
              <strong className="text-slate-200">PFAS-Sentinel</strong> • Xylem Global Student
              Innovation Challenge 2026 (Challenge #2: Water Quality)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded bg-[#061320] border border-slate-800 text-cyan-300">
              Xylem Vue (GoAigua SWE)
            </span>
            <span className="px-2 py-0.5 rounded bg-[#061320] border border-slate-800 text-emerald-300">
              Evoqua GAC &amp; Selective IX
            </span>
            <span className="px-2 py-0.5 rounded bg-[#061320] border border-slate-800 text-amber-300">
              MitiGATOR™ Mobile Fleet
            </span>
            <span className="px-2 py-0.5 rounded bg-[#061320] border border-slate-800 text-purple-300">
              YSI / WTW + Sensus Telemetry
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default App;
